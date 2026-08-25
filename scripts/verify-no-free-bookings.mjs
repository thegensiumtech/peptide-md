/**
 * Adversarial: can anyone get a consultation without paying?
 *
 * This is the question a public booking link cannot answer safely. If the
 * calendar lives on someone else's domain, the URL is shareable and whoever
 * has it can book. Here the calendar is only a list of free times, taking one
 * requires a booking the server has independently confirmed as paid.
 *
 * Every attempt below is what someone would actually try after opening dev
 * tools. All of them must fail.
 *
 *   node scripts/verify-no-free-bookings.mjs
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(import.meta.dirname, '../.env.local') });

const API = process.env.API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();
const results = [];

const blocked = (name, detail = '') => {
  results.push(true);
  console.log(`  ✓ blocked  ${name}${detail ? `, ${detail}` : ''}`);
};
const leaked = (name, detail = '') => {
  results.push(false);
  console.log(`  ✗ LEAKED   ${name}${detail ? `, ${detail}` : ''}`);
};

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

const created = [];
async function unpaidBooking(email) {
  const { body } = await api('/api/booking/checkout', {
    method: 'POST',
    body: JSON.stringify({ patientEmail: email }),
  });
  created.push(body.data.bookingId);
  return body.data;
}

const { body: avail } = await api('/api/booking/availability?days=21');
const slot = avail.data.days[0].slots[0];

console.log('\nTrying to book a £95 consultation without paying:\n');

// 1. The obvious one: create a booking, skip Stripe, grab a slot.
{
  const booking = await unpaidBooking('attack+direct@peptidemd.test');
  const { status, body } = await api('/api/booking/hold', {
    method: 'POST',
    body: JSON.stringify({ bookingId: booking.bookingId, startsAt: slot.startsAt, timezone: 'Europe/London' }),
  });
  status === 400 && body.code === 'PAYMENT_REQUIRED'
    ? blocked('Hold a slot on an unpaid booking', 'PAYMENT_REQUIRED')
    : leaked('Hold a slot on an unpaid booking', `${status} ${JSON.stringify(body)}`);
}

// 2. Skip the hold entirely and post straight to intake with a made-up token.
{
  const booking = await unpaidBooking('attack+intake@peptidemd.test');
  const { status, body } = await api('/api/booking/intake', {
    method: 'POST',
    body: JSON.stringify({
      bookingId: booking.bookingId,
      holdToken: 'a'.repeat(48),
      name: 'Freeloader',
      email: 'attack+intake@peptidemd.test',
      phone: '+44 7700 900000',
      timezone: 'Europe/London',
      answers: [{ question: 'Q', answer: 'A' }],
      consentClinical: true,
      consentTerms: true,
    }),
  });
  status >= 400
    ? blocked('Confirm with a forged hold token', `${status} ${body?.code ?? body?.error ?? ''}`)
    : leaked('Confirm with a forged hold token', JSON.stringify(body));
}

// 3. Claim payment using a session id that is not ours.
{
  const booking = await unpaidBooking('attack+session@peptidemd.test');
  const { status, body } = await api('/api/booking/verify-payment', {
    method: 'POST',
    body: JSON.stringify({ bookingId: booking.bookingId, sessionId: 'cs_test_forged_session_id' }),
  });
  status >= 400
    ? blocked('Claim payment with an invented Stripe session', `${status}`)
    : leaked('Claim payment with an invented Stripe session', JSON.stringify(body));
}

// 4. Point someone else's real Stripe session at your own unpaid booking.
//    This is the receipt-sharing attack: two people start checkout, one pays,
//    and the other tries to claim that payment. The session carries the
//    booking it was created for in its metadata, so it cannot be reassigned.
{
  const victim = await unpaidBooking('attack+victim@peptidemd.test');
  const attacker = await unpaidBooking('attack+thief@peptidemd.test');

  const { status, body } = await api('/api/booking/verify-payment', {
    method: 'POST',
    body: JSON.stringify({ bookingId: attacker.bookingId, sessionId: victim.sessionId }),
  });

  status === 400 && body?.code === 'PAYMENT_MISMATCH'
    ? blocked("Claim another booking's Stripe session", 'PAYMENT_MISMATCH')
    : leaked("Claim another booking's Stripe session", `${status} ${JSON.stringify(body)}`);
}

// 5. Forge the Stripe webhook that marks a booking paid.
{
  const booking = await unpaidBooking('attack+webhook@peptidemd.test');
  const response = await fetch(`${API}/api/webhooks/stripe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
    body: JSON.stringify({
      id: `evt_forged_${Date.now()}`,
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_forged', metadata: { bookingId: booking.bookingId }, amount_total: 9500 } },
    }),
  });

  const after = await prisma.booking.findUnique({ where: { id: booking.bookingId } });
  response.status === 400 && after.paymentStatus === 'UNPAID'
    ? blocked('Forge the Stripe webhook', 'signature rejected, booking untouched')
    : leaked('Forge the Stripe webhook', `${response.status}, payment=${after.paymentStatus}`);
}

// 6. Is there any public link that books without going through us at all?
{
  const publicPaths = ['/api/booking/confirm', '/api/booking/book', '/api/booking/create'];
  const reachable = [];
  for (const path of publicPaths) {
    const { status } = await api(path, { method: 'POST', body: JSON.stringify({}) });
    if (status < 400) reachable.push(path);
  }
  reachable.length === 0
    ? blocked('No unguarded booking endpoint', 'availability is read-only')
    : leaked('No unguarded booking endpoint', reachable.join(', '));
}

// 7. Confirm nothing above actually created a bookable appointment.
{
  const confirmed = await prisma.booking.count({
    where: { id: { in: created }, status: 'CONFIRMED' },
  });
  confirmed === 0
    ? blocked('No appointment exists from any attempt', `${created.length} attempts, 0 confirmed`)
    : leaked('No appointment exists from any attempt', `${confirmed} got through`);
}

// Delete through the relation rather than the ids we happened to capture. An
// attempt that is refused before its id comes back still leaves a booking row,
// and deleting the patient first then fails on the foreign key.
await prisma.booking.deleteMany({ where: { patient: { email: { startsWith: 'attack+' } } } });
await prisma.patient.deleteMany({ where: { email: { startsWith: 'attack+' } } });
await prisma.$disconnect();

const failed = results.filter((r) => !r).length;
console.log(`\n${'='.repeat(60)}`);
console.log(`${results.length - failed} attempts blocked, ${failed} leaked`);
if (failed === 0) console.log('\nNo route to a consultation without a real Stripe payment.');
process.exit(failed > 0 ? 1 : 0);
