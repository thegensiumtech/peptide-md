/**
 * The doctor's diary, driven through a real browser.
 *
 * The in-house approach rests on the doctor actually blocking time, so the
 * things that matter are: he can see the week, one tap takes a slot out, the
 * public calendar reflects it immediately, and a slot with a patient in it
 * cannot be blocked out from under them.
 *
 *   node scripts/verify-diary.mjs
 */
import { chromium } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(import.meta.dirname, '../.env.local') });

const WEB = 'http://localhost:3000';
const API = 'http://localhost:4000';
const prisma = new PrismaClient();
const results = [];

const pass = (n, d = '') => { results.push(true); console.log(`  ✓ ${n}${d ? `, ${d}` : ''}`); };
const fail = (n, d = '') => { results.push(false); console.log(`  ✗ ${n}${d ? `, ${d}` : ''}`); };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const crashes = [];
page.on('pageerror', (e) => crashes.push(e.message.slice(0, 120)));

// Signed in as the doctor, this is his screen, and it exercises the RBAC path.
await page.goto(`${WEB}/admin/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'mark@peptidemd.co.uk');
await page.fill('#password', 'peptide-dev-2026');
await Promise.all([
  page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20000 }),
  page.click('button[type=submit]'),
]);
pass('Doctor signed in');

await page.goto(`${WEB}/admin/availability`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// --- The diary renders -------------------------------------------------------

const slots = page.locator('button[aria-pressed], a[title^="Booked"]').filter({ hasText: /^\d{2}:\d{2}$/ });
const total = await slots.count();
total > 0 ? pass('Diary renders the week', `${total} slots`) : fail('Diary renders the week', 'no slots');

await page.screenshot({ path: resolve(import.meta.dirname, '../.e2e-shots/20-diary.png'), fullPage: true }).catch(() => {});

// --- One tap blocks ----------------------------------------------------------

const free = page.locator('button[aria-pressed="false"]').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
let blockedTime = null;

if (await free.count()) {
  blockedTime = (await free.innerText()).trim();
  await free.click();
  await page.waitForTimeout(1200);

  const nowPressed = await page
    .locator('button[aria-pressed="true"]')
    .filter({ hasText: blockedTime })
    .count();

  nowPressed > 0
    ? pass('One tap blocks a free slot', blockedTime)
    : fail('One tap blocks a free slot', blockedTime ?? '');
} else {
  fail('One tap blocks a free slot', 'no free slot found to click');
}

// --- It reaches the patient-facing calendar ----------------------------------

{
  const override = await prisma.availabilityOverride.findFirst({
    where: { kind: 'BLOCKED', note: 'Blocked from the diary' },
    orderBy: { createdAt: 'desc' },
  });

  if (override) {
    const response = await fetch(`${API}/api/booking/availability?days=21`);
    const body = await response.json();

    // The blocked slot must not be offered to a patient anywhere.
    const dateKey = override.date.toISOString().slice(0, 10);
    const day = (body?.data?.days ?? []).find((d) => d.date === dateKey);
    const stillOffered = (day?.slots ?? []).some((s) => {
      const local = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(new Date(s.startsAt));
      return local === override.startTime;
    });

    !stillOffered
      ? pass('Blocked time disappears from the public calendar', `${dateKey} ${override.startTime}`)
      : fail('Blocked time disappears from the public calendar', 'still bookable');
  } else {
    fail('Blocked time disappears from the public calendar', 'no override was created');
  }
}

// --- Tapping again frees it --------------------------------------------------

if (blockedTime) {
  const blocked = page.locator('button[aria-pressed="true"]').filter({ hasText: blockedTime }).first();
  await blocked.click();
  await page.waitForTimeout(1200);

  const freedAgain = await page
    .locator('button[aria-pressed="false"]')
    .filter({ hasText: blockedTime })
    .count();

  freedAgain > 0 ? pass('Tapping again frees the slot') : fail('Tapping again frees the slot');
}

// --- A booked slot cannot be blocked ----------------------------------------

{
  // Made rather than found. Relying on the seed meant this case quietly
  // reported "nothing to test against" once the seeded diary aged past today,
  // which reads like a failure but is really an absent test.
  const doctor = await prisma.doctor.findFirst();
  const patient = await prisma.patient.upsert({
    where: { email: 'verify+diary@peptidemd.co.uk' },
    update: {},
    create: {
      email: 'verify+diary@peptidemd.co.uk',
      name: 'Diary Fixture',
      phone: '+44 7700 900000',
      timezone: 'Europe/London',
    },
  });

  // Far enough out that it cannot collide with the slot the block/unblock
  // case above is playing with.
  const startsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  startsAt.setUTCMinutes(0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 20 * 60 * 1000);

  const booking = await prisma.booking.create({
    data: {
      reference: `PMD-DIARY-${startsAt.getTime()}`,
      doctorId: doctor.id,
      patientId: patient.id,
      channel: 'DIRECT',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      startsAt,
      endsAt,
      patientTimezone: 'Europe/London',
      amountPaid: 9500,
    },
  });

  {
    // Straight at the API, which is where the rule has to hold, the UI not
    // offering the button is presentation, not protection.
    const token = await context.cookies().then((cs) => cs.find((c) => c.name === 'pmd_access')?.value);
    const response = await fetch(`${API}/api/admin/doctor/${booking.doctorId}/slots/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
      }),
    });
    const body = await response.json();

    response.status === 409 && body.code === 'SLOT_BOOKED'
      ? pass('A booked slot cannot be blocked', body.error)
      : fail('A booked slot cannot be blocked', `${response.status} ${JSON.stringify(body)}`);
  }

  await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
}

// --- A doctor cannot touch another doctor's diary ----------------------------

{
  const token = await context.cookies().then((cs) => cs.find((c) => c.name === 'pmd_access')?.value);
  const response = await fetch(`${API}/api/admin/doctor/some-other-doctor-id/diary?days=7`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  response.status === 403
    ? pass("A doctor cannot open another doctor's diary", '403')
    : fail("A doctor cannot open another doctor's diary", String(response.status));
}

crashes.length === 0 ? pass('No runtime errors') : fail('No runtime errors', crashes[0]);

// --- Leave the diary as we found it ------------------------------------------

await prisma.availabilityOverride.deleteMany({ where: { note: 'Blocked from the diary' } });
await prisma.patient.deleteMany({ where: { email: 'verify+diary@peptidemd.co.uk' } }).catch(() => {});
await prisma.$disconnect();
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${'='.repeat(58)}`);
console.log(`${results.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
