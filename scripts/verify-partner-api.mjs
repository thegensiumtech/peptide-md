/**
 * The partner booking API.
 *
 * This is the one surface in the platform that another company builds against,
 * so it carries risks the rest of the codebase does not. Four of them are
 * checked here because each would be quiet if it broke:
 *
 *  - **Tenant separation.** A partner asking for another partner's booking must
 *    get the same answer as if it did not exist. Anything else lets them map
 *    who else we work with.
 *  - **Sandbox isolation.** A partner testing their integration must not be
 *    able to consume a real appointment. The isolation is the doctor id, so
 *    this checks the diaries really are different rather than trusting a flag.
 *  - **The rate limit.** Partner.rateLimitPerMinute is a number in a contract.
 *    It was stored and displayed and enforced nowhere.
 *  - **Rotation grace.** A rotated secret keeps working for 24 hours so a
 *    partner can cut over. If that lapsed, rotation would mean an outage.
 *
 *   node scripts/verify-partner-api.mjs
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(import.meta.dirname, '../.env.local') });

const API = process.env.API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();
const results = [];

const pass = (n, d = '') => { results.push(true); console.log(`  ✓ ${n}${d ? `, ${d}` : ''}`); };
const fail = (n, d = '') => { results.push(false); console.log(`  ✗ ${n}${d ? `, ${d}` : ''}`); };

const basic = (clientId, secret) =>
  `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`;

async function call(path, { method = 'GET', auth, body } = {}) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
}

// Seeded in packages/database/prisma/seed.ts. The secret is derived from the
// slug so this script can reconstruct it without the seed handing it back.
const NEWYOU = { id: 'pmd_live_ny_8f21c4a9', secret: 'new-you-peptides-dev-secret' };
const FIVE = { id: 'pmd_live_fp_2b70e5d3', secret: 'five-peptides-dev-secret' };
const SANDBOX = { id: 'pmd_live_ny_8f21c4a9_sandbox', secret: 'new-you-peptides-sandbox-secret' };
const SUSPENDED = { id: 'pmd_test_ax_5e93b118', secret: 'apex-labs-dev-secret' };

const newYouAuth = basic(NEWYOU.id, NEWYOU.secret);
const fiveAuth = basic(FIVE.id, FIVE.secret);
const sandboxAuth = basic(SANDBOX.id, SANDBOX.secret);

/**
 * Start from a known credential state.
 *
 * This suite deliberately expires and revokes credentials to prove the checks
 * work, and restores them afterwards. A run that dies in the middle, or is
 * interrupted, leaves one of them expired for good, and every later run then
 * fails somewhere unrelated to the change being tested. That is exactly what
 * happened: the sandbox credential sat expired for days and showed up as
 * "sandbox offers no availability", which points at the diary rather than at
 * the credential.
 *
 * Resetting at the start rather than only at the end makes the suite
 * self-healing.
 */
await prisma.partnerCredential.updateMany({
  where: { clientId: { in: [NEWYOU.id, FIVE.id, SANDBOX.id, SUSPENDED.id] } },
  data: { revokedAt: null, expiresAt: null },
});

// --- Authentication ---------------------------------------------------------

{
  const { status } = await call('/availability');
  status === 401 ? pass('No credentials refused', '401') : fail('No credentials refused', String(status));
}

{
  const { status } = await call('/availability', { auth: basic(NEWYOU.id, 'wrong-secret') });
  status === 401 ? pass('Wrong secret refused', '401') : fail('Wrong secret refused', String(status));
}

{
  const { status } = await call('/availability', { auth: basic('pmd_live_nope', 'anything') });
  status === 401
    ? pass('Unknown client id refused, same answer as a wrong secret', '401')
    : fail('Unknown client id refused', String(status));
}

{
  const { status } = await call('/availability', { auth: `Bearer ${NEWYOU.secret}` });
  status === 401 ? pass('A bearer token is not accepted here', '401') : fail('Bearer refused', String(status));
}

{
  // Apex Labs is seeded SUSPENDED. A suspended partner is a different case
  // from a bad credential and should say so.
  const { status } = await call('/availability', { auth: basic(SUSPENDED.id, SUSPENDED.secret) });
  status === 403
    ? pass('Suspended partner refused', '403, distinct from an invalid credential')
    : fail('Suspended partner refused', String(status));
}

{
  const { status, body } = await call('/availability', { auth: newYouAuth });
  status === 200 && Array.isArray(body?.data?.days)
    ? pass('Valid credentials accepted', `${body.data.days.length} days offered`)
    : fail('Valid credentials accepted', `${status} ${JSON.stringify(body).slice(0, 120)}`);
}

// --- Rotation grace ---------------------------------------------------------

{
  // A rotated credential carries expiresAt rather than being deleted. Until it
  // passes, both secrets work. Simulated by setting expiresAt directly.
  await prisma.partnerCredential.update({
    where: { clientId: NEWYOU.id },
    data: { expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  const during = await call('/availability', { auth: newYouAuth });

  await prisma.partnerCredential.update({
    where: { clientId: NEWYOU.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const after = await call('/availability', { auth: newYouAuth });

  await prisma.partnerCredential.update({
    where: { clientId: NEWYOU.id },
    data: { expiresAt: null },
  });

  during.status === 200 && after.status === 401
    ? pass('Rotated secret works during the grace window and stops after it')
    : fail('Rotation grace', `during=${during.status} after=${after.status}`);
}

{
  await prisma.partnerCredential.update({
    where: { clientId: FIVE.id },
    data: { revokedAt: new Date() },
  });
  const { status } = await call('/availability', { auth: fiveAuth });
  await prisma.partnerCredential.update({
    where: { clientId: FIVE.id },
    data: { revokedAt: null },
  });

  status === 401 ? pass('Revoked credential refused', '401') : fail('Revoked credential refused', String(status));
}

// --- Sandbox isolation ------------------------------------------------------

let sandboxDoctorId = null;
let liveDoctorId = null;

{
  const sandboxDoctor = await prisma.doctor.findFirst({ where: { gmcNumber: 'SANDBOX' } });
  const liveDoctor = await prisma.doctor.findFirst({ where: { isActive: true } });
  sandboxDoctorId = sandboxDoctor?.id ?? null;
  liveDoctorId = liveDoctor?.id ?? null;

  sandboxDoctorId && liveDoctorId && sandboxDoctorId !== liveDoctorId
    ? pass('Sandbox books a different doctor from the live diary')
    : fail('Sandbox diary separate', `sandbox=${sandboxDoctorId} live=${liveDoctorId}`);
}

{
  const { body } = await call('/availability', { auth: sandboxAuth });
  body?.data?.sandbox === true
    ? pass('Sandbox credential is reported as sandbox')
    : fail('Sandbox flagged in the response', JSON.stringify(body?.data?.sandbox));
}

// --- The booking path -------------------------------------------------------

let liveBookingId = null;
let liveSlot = null;

{
  const { body } = await call('/availability?days=21', { auth: newYouAuth });
  liveSlot = body?.data?.days?.[0]?.slots?.[0] ?? null;
  liveSlot ? pass('Availability returns bookable times') : fail('Availability returns bookable times', 'none');
}

let holdToken = null;
if (liveSlot) {
  const { status, body } = await call('/holds', {
    method: 'POST',
    auth: newYouAuth,
    body: { startsAt: liveSlot.startsAt },
  });
  holdToken = body?.data?.holdToken ?? null;
  status === 200 && holdToken
    ? pass('Partner can hold a slot', `expires ${body.data.expiresAt}`)
    : fail('Partner can hold a slot', `${status} ${JSON.stringify(body).slice(0, 140)}`);
}

if (liveSlot) {
  // The whole commercial model rests on one diary. A second partner reaching
  // for the same instant must lose.
  const { status, body } = await call('/holds', {
    method: 'POST',
    auth: fiveAuth,
    body: { startsAt: liveSlot.startsAt },
  });
  status === 409 && body?.code === 'SLOT_TAKEN'
    ? pass('A slot held by one partner is refused to another', 'SLOT_TAKEN')
    : fail('Cross-partner slot contention', `${status} ${JSON.stringify(body).slice(0, 140)}`);
}

if (holdToken) {
  const { status, body } = await call('/bookings', {
    method: 'POST',
    auth: newYouAuth,
    body: {
      holdToken,
      reference: 'NY-TEST-1',
      patient: {
        name: 'Partner Test Patient',
        email: 'partner+live@peptidemd.test',
        phone: '+61 400 000 000',
        timezone: 'Australia/Sydney',
      },
      intake: [{ question: 'What would you like to discuss?', answer: 'Verification run.' }],
    },
  });
  liveBookingId = body?.data?.id ?? null;

  status === 201 && body?.data?.status === 'confirmed'
    ? pass('Hold becomes a confirmed booking', body.data.reference)
    : fail('Hold becomes a booking', `${status} ${JSON.stringify(body).slice(0, 160)}`);

  body?.data?.partnerReference === 'NY-TEST-1'
    ? pass('The partner reference is echoed back for reconciliation')
    : fail('Partner reference echoed', JSON.stringify(body?.data?.partnerReference));
}

if (liveBookingId) {
  const booking = await prisma.booking.findUnique({ where: { id: liveBookingId } });
  const partner = await prisma.partner.findUnique({ where: { slug: 'new-you-peptides' } });

  booking?.channel === 'PARTNER' && booking?.partnerId === partner?.id
    ? pass('Booking is attributed to the partner', 'channel=PARTNER')
    : fail('Attribution written', `channel=${booking?.channel} partnerId=${booking?.partnerId}`);

  booking?.amountPaid === null
    ? pass('No money is recorded against a partner booking', 'the partner took payment')
    : fail('amountPaid null on partner bookings', String(booking?.amountPaid));

  booking?.isSandbox === false
    ? pass('A live credential produces a live booking')
    : fail('Live booking not flagged sandbox', String(booking?.isSandbox));

  booking?.doctorId === liveDoctorId
    ? pass('Live booking lands in the real diary')
    : fail('Live booking doctor', `${booking?.doctorId} vs ${liveDoctorId}`);
}

// --- Reusing a hold ---------------------------------------------------------

if (holdToken) {
  const { status, body } = await call('/bookings', {
    method: 'POST',
    auth: newYouAuth,
    body: {
      holdToken,
      patient: {
        name: 'Second Attempt',
        email: 'partner+second@peptidemd.test',
        phone: '+61 400 000 001',
        timezone: 'Australia/Sydney',
      },
    },
  });
  status === 409 && body?.code === 'HOLD_ALREADY_USED'
    ? pass('A hold cannot be spent twice', 'HOLD_ALREADY_USED')
    : fail('Hold reuse refused', `${status} ${JSON.stringify(body).slice(0, 140)}`);
}

// --- Cross-partner access ---------------------------------------------------

if (liveBookingId) {
  const { status, body } = await call(`/bookings/${liveBookingId}`, {
    method: 'PATCH',
    auth: fiveAuth,
    body: { startsAt: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString() },
  });
  status === 404
    ? pass("Another partner cannot move this partner's booking", '404, not 403, so ids cannot be probed')
    : fail('Cross-partner reschedule refused', `${status} ${JSON.stringify(body).slice(0, 140)}`);
}

if (liveBookingId) {
  const { status } = await call(`/bookings/${liveBookingId}`, { method: 'DELETE', auth: fiveAuth });
  status === 404
    ? pass("Another partner cannot cancel this partner's booking", '404')
    : fail('Cross-partner cancel refused', String(status));
}

{
  const { body } = await call('/bookings?limit=100', { auth: fiveAuth });
  const list = body?.data?.bookings ?? [];
  const five = await prisma.partner.findUnique({ where: { slug: 'five-peptides' } });
  const ids = list.map((b) => b.id);
  const leaked = ids.length
    ? await prisma.booking.count({ where: { id: { in: ids }, partnerId: { not: five?.id } } })
    : 0;

  leaked === 0
    ? pass('A partner listing returns only their own bookings', `${list.length} rows, 0 leaked`)
    : fail('Partner listing scoped', `${leaked} rows belonged to someone else`);
}

// --- Sandbox does not touch the real diary ----------------------------------

let sandboxBookingId = null;
{
  const { body: availability } = await call('/availability?days=7', { auth: sandboxAuth });
  const slot = availability?.data?.days?.[0]?.slots?.[0] ?? null;

  if (!slot) {
    fail('Sandbox offers availability', 'none returned');
  } else {
    const { body: held } = await call('/holds', {
      method: 'POST',
      auth: sandboxAuth,
      body: { startsAt: slot.startsAt },
    });

    const { status, body } = await call('/bookings', {
      method: 'POST',
      auth: sandboxAuth,
      body: {
        holdToken: held?.data?.holdToken,
        patient: {
          name: 'Sandbox Patient',
          email: 'partner+sandbox@peptidemd.test',
          phone: '+61 400 000 002',
          timezone: 'Australia/Sydney',
        },
      },
    });
    sandboxBookingId = body?.data?.id ?? null;

    status === 201 ? pass('Sandbox booking succeeds') : fail('Sandbox booking', `${status}`);

    if (sandboxBookingId) {
      const booking = await prisma.booking.findUnique({ where: { id: sandboxBookingId } });
      booking?.isSandbox === true && booking?.doctorId === sandboxDoctorId
        ? pass('Sandbox booking is flagged and lands on the sandbox doctor')
        : fail('Sandbox booking isolated', `isSandbox=${booking?.isSandbox} doctor=${booking?.doctorId}`);
    }
  }
}

// --- Rate limiting ----------------------------------------------------------

{
  const partner = await prisma.partner.findUnique({ where: { slug: 'five-peptides' } });
  const original = partner.rateLimitPerMinute;

  await prisma.partner.update({ where: { id: partner.id }, data: { rateLimitPerMinute: 3 } });
  // Clear any counter already accumulated by the checks above.
  const { default: Redis } = await import('ioredis');
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true });
  await redis.connect().catch(() => {});
  await redis.del(`ratelimit:client:${FIVE.id}`).catch(() => {});

  const codes = [];
  for (let i = 0; i < 6; i += 1) {
    const { status } = await call('/availability?days=1', { auth: fiveAuth });
    codes.push(status);
  }

  await prisma.partner.update({ where: { id: partner.id }, data: { rateLimitPerMinute: original } });
  await redis.del(`ratelimit:client:${FIVE.id}`).catch(() => {});
  await redis.quit().catch(() => {});

  const limited = codes.filter((c) => c === 429).length;
  limited > 0 && codes.slice(0, 3).every((c) => c === 200)
    ? pass("The partner's configured limit is enforced", `first 3 allowed, ${limited} of 6 refused`)
    : fail('Rate limit enforced', codes.join(','));
}

// --- Contract shape ---------------------------------------------------------

{
  const { body } = await call('/availability?days=1', { auth: newYouAuth });
  const shapeOk =
    typeof body?.success === 'boolean' &&
    'data' in body &&
    'error' in body &&
    typeof body?.data?.timezone === 'string' &&
    typeof body?.data?.durationMinutes === 'number';

  shapeOk
    ? pass('Responses keep the documented envelope')
    : fail('Response envelope', JSON.stringify(body).slice(0, 160));
}

{
  const { status, body } = await call('/holds', {
    method: 'POST',
    auth: newYouAuth,
    body: { startsAt: 'not-a-date' },
  });
  status === 400 ? pass('Malformed input is refused with 400', body?.error?.slice(0, 60)) : fail('Validation', String(status));
}

{
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const { status, body } = await call('/holds', { method: 'POST', auth: newYouAuth, body: { startsAt: past } });
  status === 400 && body?.code === 'SLOT_IN_PAST'
    ? pass('A time in the past is refused', 'SLOT_IN_PAST')
    : fail('Past slot refused', `${status} ${body?.code}`);
}

// --- Cancel returns the time ------------------------------------------------

if (liveBookingId) {
  const { status } = await call(`/bookings/${liveBookingId}`, {
    method: 'DELETE',
    auth: newYouAuth,
    body: { reason: 'Verification run.' },
  });
  const booking = await prisma.booking.findUnique({ where: { id: liveBookingId } });

  status === 200 && booking?.status === 'CANCELLED'
    ? pass('Partner can cancel their own booking')
    : fail('Partner cancel', `${status} status=${booking?.status}`);

  booking?.refundStatus === 'NONE'
    ? pass('No refund is raised, we never took the money')
    : fail('No refund on a partner cancellation', String(booking?.refundStatus));
}

// --- Cleanup ----------------------------------------------------------------

await prisma.booking.deleteMany({ where: { patient: { email: { startsWith: 'partner+' } } } });
await prisma.patient.deleteMany({ where: { email: { startsWith: 'partner+' } } });
await prisma.$disconnect();

const failed = results.filter((r) => !r).length;
console.log(`\n${'='.repeat(60)}`);
console.log(`${results.length - failed} passed, ${failed} failed`);
if (failed === 0) console.log('\nPartner separation, sandbox isolation and the rate limit all hold.');
process.exit(failed > 0 ? 1 : 0);
