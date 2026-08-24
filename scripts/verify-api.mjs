/**
 * API verification.
 *
 * Exercises the money path end to end against Stripe test mode, and the
 * guarantees the scope calls out by name: payment before calendar, one winner
 * on a contended slot, and partner data separation.
 *
 *   pnpm --filter @peptide/api dev      # in one terminal
 *   node scripts/verify-api.mjs
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(import.meta.dirname, '../.env.local') });

const API = process.env.API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const results = [];
const pass = (name, detail = '') => results.push({ ok: true, name, detail });
const fail = (name, detail = '') => results.push({ ok: false, name, detail });

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function login(email, password = 'peptide-dev-2026') {
  const { body } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return body?.data?.accessToken ?? null;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// --- Auth and RBAC -----------------------------------------------------------

const adminToken = await login('ross@peptidemd.co.uk');
adminToken ? pass('Admin login', 'bcrypt verified, JWT issued') : fail('Admin login');

const doctorToken = await login('james@peptidemd.co.uk');
doctorToken ? pass('Doctor login') : fail('Doctor login');

{
  const { body } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'ross@peptidemd.co.uk', password: 'wrong' }),
  });
  !body.success ? pass('Wrong password rejected') : fail('Wrong password rejected');
}

{
  const { status } = await api('/api/admin/bookings');
  status === 401 ? pass('Unauthenticated admin blocked', '401') : fail('Unauthenticated admin blocked', `got ${status}`);
}

{
  const { body } = await api('/api/admin/bookings?limit=1', { headers: auth(doctorToken) });
  body.data[0]?.amountPaid === null
    ? pass('Doctor sees no commercial data', 'amountPaid withheld')
    : fail('Doctor sees no commercial data', `amountPaid=${body.data[0]?.amountPaid}`);
}

{
  const { status } = await api('/api/admin/settings', { headers: auth(doctorToken) });
  status === 403 ? pass('Doctor blocked from settings', '403') : fail('Doctor blocked from settings', `got ${status}`);
}

{
  const { body } = await api('/api/admin/bookings?channel=partner&limit=50', { headers: auth(adminToken) });
  const allPartner = body.data.every((b) => b.channel === 'partner');
  allPartner ? pass('Booking filters', `${body.meta.total} partner bookings`) : fail('Booking filters');
}

// --- Public booking data -----------------------------------------------------

{
  const { body } = await api('/api/booking/consultation');
  body.data?.priceAmount === 9500 && body.data?.durationMinutes === 20
    ? pass('Consultation endpoint', `£${body.data.priceAmount / 100}, ${body.data.durationMinutes} min`)
    : fail('Consultation endpoint', JSON.stringify(body.data));
}

let firstSlot = null;
{
  const { body } = await api('/api/booking/availability?days=21');
  const days = body.data?.days ?? [];
  firstSlot = days[0]?.slots?.[0] ?? null;
  days.length > 0
    ? pass('Availability', `${days.length} days, ${days.reduce((n, d) => n + d.slots.length, 0)} slots`)
    : fail('Availability', 'no days returned');
}

// --- The money path ----------------------------------------------------------

let bookingId = null;
{
  const { body } = await api('/api/booking/checkout', {
    method: 'POST',
    body: JSON.stringify({ patientEmail: 'verify+patient@peptidemd.co.uk' }),
  });
  bookingId = body.data?.bookingId ?? null;
  body.data?.checkoutUrl?.startsWith('https://checkout.stripe.com')
    ? pass('Stripe Checkout session created', body.data.reference)
    : fail('Stripe Checkout session created', JSON.stringify(body));
}

{
  // The scope's central guarantee: no slot can be held before payment clears.
  const { status, body } = await api('/api/booking/hold', {
    method: 'POST',
    body: JSON.stringify({ bookingId, startsAt: firstSlot.startsAt, timezone: 'Europe/London' }),
  });
  status === 400 && body.code === 'PAYMENT_REQUIRED'
    ? pass('Unpaid booking cannot hold a slot', 'PAYMENT_REQUIRED')
    : fail('Unpaid booking cannot hold a slot', `${status} ${JSON.stringify(body)}`);
}

// Stand in for the webhook: the API only ever trusts the webhook, so the test
// sets PAID the same way the handler does.
await prisma.booking.update({ where: { id: bookingId }, data: { paymentStatus: 'PAID' } });

let holdToken = null;
{
  const { body } = await api('/api/booking/hold', {
    method: 'POST',
    body: JSON.stringify({ bookingId, startsAt: firstSlot.startsAt, timezone: 'Australia/Sydney' }),
  });
  holdToken = body.data?.holdToken ?? null;
  holdToken ? pass('Paid booking holds a slot', `expires ${body.data.expiresAt}`) : fail('Paid booking holds a slot', JSON.stringify(body));
}

{
  // Two channels reaching for the same time. Exactly one may win.
  const { body: second } = await api('/api/booking/checkout', {
    method: 'POST',
    body: JSON.stringify({ patientEmail: 'verify+rival@peptidemd.co.uk' }),
  });
  await prisma.booking.update({
    where: { id: second.data.bookingId },
    data: { paymentStatus: 'PAID' },
  });

  const { status, body } = await api('/api/booking/hold', {
    method: 'POST',
    body: JSON.stringify({
      bookingId: second.data.bookingId,
      startsAt: firstSlot.startsAt,
      timezone: 'Europe/London',
    }),
  });

  status === 409 && body.code === 'SLOT_TAKEN'
    ? pass('Contended slot resolves to one winner', 'second attempt refused with SLOT_TAKEN')
    : fail('Contended slot resolves to one winner', `${status} ${JSON.stringify(body)}`);

  await prisma.booking.delete({ where: { id: second.data.bookingId } }).catch(() => {});
}

{
  const { body } = await api('/api/booking/availability?days=21');
  const stillOffered = body.data.days.some((d) => d.slots.some((s) => s.startsAt === firstSlot.startsAt));
  !stillOffered
    ? pass('Held slot disappears from availability', 'across every channel')
    : fail('Held slot disappears from availability', 'still offered');
}

{
  const { body } = await api('/api/booking/intake', {
    method: 'POST',
    body: JSON.stringify({
      bookingId,
      holdToken,
      name: 'Verification Patient',
      email: 'verify+patient@peptidemd.co.uk',
      phone: '+44 7700 900000',
      timezone: 'Australia/Sydney',
      answers: [
        { question: 'What would you like to discuss with the doctor?', answer: 'Verification run.' },
        { question: 'Are you currently using any peptides or compounds?', answer: 'None' },
      ],
      consentClinical: true,
      consentTerms: true,
    }),
  });

  body.data?.status === 'confirmed'
    ? pass('Intake confirms the booking', body.data.reference)
    : fail('Intake confirms the booking', JSON.stringify(body));
}

{
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { intakeResponses: true, emails: true },
  });
  const consents = await prisma.consentRecord.count({ where: { bookingId } });

  booking?.status === 'CONFIRMED' && booking.intakeResponses.length === 2 && consents === 2
    ? pass('Booking persisted', 'intake + both consents recorded')
    : fail('Booking persisted', `status=${booking?.status} intake=${booking?.intakeResponses.length} consents=${consents}`);

  booking.emails.some((e) => e.type === 'PATIENT_CONFIRMATION' && e.sentAt)
    ? pass('Confirmation email sent and logged')
    : fail('Confirmation email sent and logged', JSON.stringify(booking.emails.map((e) => e.type)));

  booking.emails.some((e) => e.type === 'DOCTOR_NOTIFICATION' && e.sentAt)
    ? pass('Doctor notified')
    : fail('Doctor notified');
}

// --- Webhook safety ----------------------------------------------------------

{
  const res = await fetch(`${API}/api/webhooks/stripe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 'bogus' },
    body: JSON.stringify({ id: 'evt_forged', type: 'checkout.session.completed' }),
  });
  res.status === 400
    ? pass('Forged webhook rejected', 'signature verification enforced')
    : fail('Forged webhook rejected', `got ${res.status}`);
}

// --- Stripe reachability -----------------------------------------------------

{
  try {
    const balance = await stripe.balance.retrieve();
    pass('Stripe credentials valid', `livemode=${balance.livemode}`);
  } catch (error) {
    fail('Stripe credentials valid', error.message);
  }
}

// --- Cleanup -----------------------------------------------------------------

await prisma.booking.deleteMany({ where: { patient: { email: { startsWith: 'verify+' } } } });
await prisma.patient.deleteMany({ where: { email: { startsWith: 'verify+' } } });
await prisma.$disconnect();

for (const r of results) console.log(`${r.ok ? 'PASS ' : 'FAIL '} ${r.name}${r.detail ? `, ${r.detail}` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
