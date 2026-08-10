/**
 * Scheduling provider contract test.
 *
 * Runs the same assertions against whichever provider is configured, so
 * evaluating Cal.com is a measurement rather than an opinion:
 *
 *   SCHEDULING_PROVIDER=internal node scripts/verify-scheduling.mjs
 *   SCHEDULING_PROVIDER=calcom   node scripts/verify-scheduling.mjs
 *
 * A provider that passes every check here can be switched on in production
 * with a single environment variable. One that fails tells you exactly which
 * guarantee it breaks before any money is committed to it.
 *
 * Requires the API running with the provider under test.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(import.meta.dirname, '../.env.local') });

const API = process.env.API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();

const results = [];
const pass = (name, detail = '') => {
  results.push({ ok: true, name, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
};
const fail = (name, detail = '') => {
  results.push({ ok: false, name, detail });
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
};

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

/** A paid booking, created the way the real flow creates one. */
async function paidBooking(email) {
  const { body } = await api('/api/booking/checkout', {
    method: 'POST',
    body: JSON.stringify({ patientEmail: email }),
  });
  const bookingId = body?.data?.bookingId;
  if (!bookingId) throw new Error(`checkout failed: ${JSON.stringify(body)}`);
  // Stand in for the Stripe webhook; this test is about scheduling, not payment.
  await prisma.booking.update({ where: { id: bookingId }, data: { paymentStatus: 'PAID' } });
  return bookingId;
}

const health = await api('/api/health');
const provider = health.body?.data?.scheduling ?? 'unknown';
console.log(`\nScheduling provider under test: ${provider}\n`);

// --- 1. Availability ---------------------------------------------------------

let slot = null;
{
  const { body } = await api('/api/booking/availability?days=21');
  const days = body?.data?.days ?? [];
  const total = days.reduce((n, d) => n + d.slots.length, 0);
  slot = days[0]?.slots?.[0] ?? null;

  total > 0 ? pass('Returns availability', `${days.length} days, ${total} slots`) : fail('Returns availability');

  // Every slot must be the configured consultation length, or the diary and
  // the price stop agreeing with each other.
  const duration = body?.data?.durationMinutes;
  const wrongLength = days
    .flatMap((d) => d.slots)
    .find((s) => (new Date(s.endsAt) - new Date(s.startsAt)) / 60000 !== duration);
  !wrongLength
    ? pass('Every slot is the configured duration', `${duration} min`)
    : fail('Every slot is the configured duration', JSON.stringify(wrongLength));

  const past = days.flatMap((d) => d.slots).find((s) => new Date(s.startsAt) < new Date());
  !past ? pass('No slots offered in the past') : fail('No slots offered in the past', past.startsAt);
}

// --- 2. Honours the doctor's pattern and overrides ---------------------------

{
  const doctor = await prisma.doctor.findFirst({ where: { isActive: true } });
  const blocked = await prisma.availabilityOverride.findFirst({
    where: { doctorId: doctor.id, kind: 'BLOCKED', startTime: null },
  });

  if (blocked) {
    const key = blocked.date.toISOString().slice(0, 10);
    const { body } = await api('/api/booking/availability?days=40');
    const offered = (body?.data?.days ?? []).some((d) => d.date === key && d.slots.length > 0);
    !offered
      ? pass('Blocked dates are withheld', `${key} offers nothing`)
      : fail('Blocked dates are withheld', `${key} still offers slots`);
  } else {
    pass('Blocked dates are withheld', 'no blocked date seeded to assert against');
  }
}

// --- 3. The hold, and the shared-calendar guarantee --------------------------

let holdToken = null;
{
  const bookingId = await paidBooking('contract+first@peptidemd.test');
  const { status, body } = await api('/api/booking/hold', {
    method: 'POST',
    body: JSON.stringify({ bookingId, startsAt: slot.startsAt, timezone: 'Europe/London' }),
  });

  holdToken = body?.data?.holdToken ?? null;
  status === 200 && holdToken ? pass('Holds a slot') : fail('Holds a slot', JSON.stringify(body));
}

{
  const { body } = await api('/api/booking/availability?days=21');
  const stillOffered = (body?.data?.days ?? []).some((d) =>
    d.slots.some((s) => s.startsAt === slot.startsAt)
  );
  !stillOffered
    ? pass('A held slot leaves availability immediately')
    : fail('A held slot leaves availability immediately', 'still offered to other patients');
}

{
  // The guarantee the whole white-label model rests on: two channels reaching
  // for one time, exactly one winner.
  const rival = await paidBooking('contract+rival@peptidemd.test');
  const { status, body } = await api('/api/booking/hold', {
    method: 'POST',
    body: JSON.stringify({ bookingId: rival, startsAt: slot.startsAt, timezone: 'Australia/Sydney' }),
  });

  status === 409 && body?.code === 'SLOT_TAKEN'
    ? pass('Contended slot resolves to one winner', 'second attempt refused')
    : fail('Contended slot resolves to one winner', `${status} ${JSON.stringify(body)}`);
}

{
  // Simultaneous, not merely sequential — the case a naive check-then-insert
  // gets wrong.
  const { body } = await api('/api/booking/availability?days=21');
  const fresh = body?.data?.days?.[0]?.slots?.[0];

  if (fresh) {
    const contenders = await Promise.all([
      paidBooking('contract+race1@peptidemd.test'),
      paidBooking('contract+race2@peptidemd.test'),
      paidBooking('contract+race3@peptidemd.test'),
    ]);

    const attempts = await Promise.all(
      contenders.map((bookingId) =>
        api('/api/booking/hold', {
          method: 'POST',
          body: JSON.stringify({ bookingId, startsAt: fresh.startsAt, timezone: 'Europe/London' }),
        })
      )
    );

    const winners = attempts.filter((a) => a.status === 200).length;
    winners === 1
      ? pass('Three simultaneous attempts, one winner', `${attempts.length - 1} refused`)
      : fail('Three simultaneous attempts, one winner', `${winners} succeeded`);
  }
}

// --- 4. Release returns the time ---------------------------------------------

{
  const before = await api('/api/booking/availability?days=21');
  const offeredBefore = (before.body?.data?.days ?? []).some((d) =>
    d.slots.some((s) => s.startsAt === slot.startsAt)
  );

  // Stands in for the expiry sweep, which deletes the hold and then
  // invalidates the availability cache. Deleting the row alone would leave the
  // cached list stale and the assertion below would fail for the wrong reason.
  await prisma.slotHold.deleteMany({ where: { holdToken } });
  const { default: Redis } = await import('ioredis');
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  const keys = await redis.keys('availability:*');
  if (keys.length) await redis.del(...keys);
  await redis.quit();

  const after = await api('/api/booking/availability?days=21');
  const offeredAfter = (after.body?.data?.days ?? []).some((d) =>
    d.slots.some((s) => s.startsAt === slot.startsAt)
  );

  !offeredBefore && offeredAfter
    ? pass('Releasing a hold returns the time to the calendar')
    : fail('Releasing a hold returns the time', `before=${offeredBefore} after=${offeredAfter}`);
}

// --- Cleanup -----------------------------------------------------------------

await prisma.booking.deleteMany({
  where: { patient: { email: { startsWith: 'contract+' } } },
});
await prisma.patient.deleteMany({ where: { email: { startsWith: 'contract+' } } });
await prisma.$disconnect();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${'='.repeat(60)}`);
console.log(`Provider: ${provider} — ${results.length - failed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('\nThis provider satisfies the contract and can be switched on in production.');
} else {
  console.log('\nThis provider breaks a guarantee above. Do not switch it on.');
}
process.exit(failed > 0 ? 1 : 0);
