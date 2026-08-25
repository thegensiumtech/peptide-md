/**
 * Daylight-saving correctness.
 *
 * This is the part of building our own scheduler that actually carries risk.
 * A doctor sets "09:00 Monday" once; the platform must turn that into the
 * right UTC instant every week of the year, on both sides of the UK and
 * Australian clock changes, or patients get sent to appointments an hour out.
 *
 * Tested through the real availability endpoint rather than against the helper
 * functions, so it exercises the path a patient actually hits.
 *
 *   node scripts/verify-timezones.mjs
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(import.meta.dirname, '../.env.local') });

const API = process.env.API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();
const results = [];

const pass = (name, detail = '') => {
  results.push(true);
  console.log(`  ✓ ${name}${detail ? `, ${detail}` : ''}`);
};
const fail = (name, detail = '') => {
  results.push(false);
  console.log(`  ✗ ${name}${detail ? `, ${detail}` : ''}`);
};

const doctor = await prisma.doctor.findFirst({ where: { isActive: true } });
const created = [];

/**
 * Ask for a doctor-local 09:00 on a given date and report the UTC instant the
 * platform actually offers. An EXTRA override is used because it adds capacity
 * on one specific date without touching the standing weekly pattern.
 */
/**
 * Refuses a date that has already passed.
 *
 * Availability never offers a past slot, so a hardcoded date here stops
 * testing anything the moment it ages out, and reports a clean pass or a
 * confusing failure rather than "this test has expired".
 */
function assertFuture(date) {
  if (new Date(`${date}T23:59:59.000Z`) <= new Date()) {
    console.error(
      `\n  This suite is anchored to ${date}, which has passed. Roll the dates`
    );
    console.error('  in verify-timezones.mjs forward to the next equivalent transition.\n');
    process.exit(1);
  }
  return date;
}

async function utcFor(date) {
  const override = await prisma.availabilityOverride.create({
    data: {
      doctorId: doctor.id,
      date: new Date(`${date}T00:00:00.000Z`),
      kind: 'EXTRA',
      startTime: '09:00',
      endTime: '10:00',
      note: 'timezone verification',
    },
  });
  created.push(override.id);

  // The availability cache would otherwise hide the override for a minute.
  const { default: Redis } = await import('ioredis');
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  const keys = await redis.keys('availability:*');
  if (keys.length) await redis.del(...keys);
  await redis.quit();

  // The endpoint caps the window at 60 days, so each date is queried from its
  // own start rather than by asking for a year at once.
  const from = new Date(`${date}T00:00:00.000Z`).toISOString();
  const response = await fetch(
    `${API}/api/booking/availability?from=${encodeURIComponent(from)}&days=2`
  );
  const body = await response.json();
  const day = (body?.data?.days ?? []).find((d) => d.date === date);
  return day?.slots?.[0]?.startsAt ?? null;
}

console.log(`\nDoctor timezone: ${doctor.timezone}\n`);

// --- United Kingdom ----------------------------------------------------------
// BST (UTC+1) ends 25 October 2026. 09:00 local is 08:00Z before, 09:00Z after.

{
  const during = await utcFor('2026-10-23'); // Friday, still BST
  during?.endsWith('08:00:00.000Z')
    ? pass('UK 09:00 during BST maps to 08:00Z', during)
    : fail('UK 09:00 during BST maps to 08:00Z', during ?? 'no slot returned');
}

{
  const after = await utcFor('2026-10-27'); // Tuesday, now GMT
  after?.endsWith('09:00:00.000Z')
    ? pass('UK 09:00 after the clocks go back maps to 09:00Z', after)
    : fail('UK 09:00 after the clocks go back maps to 09:00Z', after ?? 'no slot returned');
}

{
  // The transition weekend itself is where naive arithmetic breaks.
  const eve = await utcFor('2026-10-24');
  const morningAfter = await utcFor('2026-10-26');
  eve?.endsWith('08:00:00.000Z') && morningAfter?.endsWith('09:00:00.000Z')
    ? pass('The transition weekend is handled', `${eve} then ${morningAfter}`)
    : fail('The transition weekend is handled', `${eve} then ${morningAfter}`);
}

{
  // Spring forward. Uses the 2027 transition (BST begins 28 March 2027)
  // because the 2026 one has already passed and the provider correctly
  // refuses to offer slots in the past.
  const before = await utcFor('2027-03-26'); // GMT
  const afterSpring = await utcFor('2027-03-30'); // BST
  before?.endsWith('09:00:00.000Z') && afterSpring?.endsWith('08:00:00.000Z')
    ? pass('Spring forward is handled', `${before} then ${afterSpring}`)
    : fail('Spring forward is handled', `${before} then ${afterSpring}`);
}

// --- What the Australian patient sees ----------------------------------------
// Sydney is UTC+11 (AEDT) in late October, UTC+10 (AEST) in August. A doctor's
// late-evening UK slot has to land at a civilised Sydney hour either way.

{
  // Dates must be in the future: availability deliberately never offers a slot
  // in the past, so a date-anchored test like this one quietly reports "no
  // slot" once it ages past today. That is an expired fixture reading as a
  // failure, which is exactly what happened to 2026-08-21. assertFuture below
  // makes it say so plainly instead.
  const august = await utcFor(assertFuture('2027-08-20')); // London BST, Sydney AEST (+10)
  const october = await utcFor(assertFuture('2026-10-27')); // London GMT, Sydney AEDT (+11)

  const sydney = (iso) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Australia/Sydney',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));

  // The two zones shift independently, so the Sydney-local time of a fixed
  // London slot legitimately differs between these dates. What must hold is
  // that each converts correctly, not that they match.
  const augustSydney = august ? sydney(august) : null;
  const octoberSydney = october ? sydney(october) : null;

  augustSydney === '18:00' && octoberSydney === '20:00'
    ? pass('Sydney conversion tracks both clock changes', `Aug ${augustSydney}, Oct ${octoberSydney}`)
    : fail(
        'Sydney conversion tracks both clock changes',
        `expected Aug 18:00 / Oct 20:00, got Aug ${augustSydney} / Oct ${octoberSydney}`
      );
}

// --- Cleanup -----------------------------------------------------------------

await prisma.availabilityOverride.deleteMany({ where: { id: { in: created } } });
await prisma.$disconnect();

const failed = results.filter((r) => !r).length;
console.log(`\n${'='.repeat(58)}`);
console.log(`${results.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
