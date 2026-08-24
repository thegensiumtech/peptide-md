/**
 * End-to-end verification against the running stack.
 *
 * Drives a real browser through every journey the scope describes: a patient
 * paying on Stripe's own hosted page and booking a time, staff signing in with
 * real credentials, and the access rules holding. Also checks form validation,
 * failure handling, and layout at six widths.
 *
 * Requires postgres, redis, the API on :4000 and the web app on :3000.
 *
 *   node scripts/e2e.mjs
 *   node scripts/e2e.mjs --headed      # watch it
 */
import { chromium, devices } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(import.meta.dirname, '../.env.local') });

// Point at a deployed environment with BASE_URL; defaults to local.
//   BASE_URL=https://100-29-81-212.sslip.io node scripts/e2e.mjs
const WEB = process.env.BASE_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? (process.env.BASE_URL ? `${process.env.BASE_URL}` : 'http://localhost:4000');

// The staging database sits inside a private VPC, so the direct-database
// assertions only run locally. Everything the browser can observe still runs.
const REMOTE = Boolean(process.env.BASE_URL);
const SHOTS = resolve(import.meta.dirname, '../.e2e-shots');
mkdirSync(SHOTS, { recursive: true });

const headed = process.argv.includes('--headed');
const prisma = new PrismaClient();
const results = [];
const started = Date.now();

const pass = (name, detail = '') => {
  results.push({ ok: true, name, detail });
  process.stdout.write(`  ✓ ${name}${detail ? `, ${detail}` : ''}\n`);
};
const fail = (name, detail = '') => {
  results.push({ ok: false, name, detail });
  process.stdout.write(`  ✗ ${name}${detail ? `, ${detail}` : ''}\n`);
};
const section = (title) => process.stdout.write(`\n${title}\n`);

const PASSWORD = 'peptide-dev-2026';
const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 120 : 0 });

/** Fails the run if a screen throws in the browser rather than handling it. */
function watchForCrashes(page, label) {
  const crashes = [];
  page.on('pageerror', (error) => crashes.push(`${label}: ${error.message.slice(0, 140)}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon')) {
      crashes.push(`${label}: ${message.text().slice(0, 140)}`);
    }
  });
  return crashes;
}

async function signIn(page, area, email) {
  await page.goto(`${WEB}/${area}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 }),
    page.click('button[type=submit]'),
  ]);
}

async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }).catch(() => {});
}

/**
 * Fail fast on a stale build.
 *
 * Running `pnpm build` while `next start` is up rewrites the chunk hashes on
 * disk while the server keeps serving HTML that points at the old ones. Every
 * page then dies with a ChunkLoadError, which reads like a hundred unrelated
 * bugs. Catching it here turns twenty confusing failures into one clear line.
 */
{
  const context = await browser.newContext();
  const page = await context.newPage();
  const broken = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/_next/static/')) broken.push(r.url().split('/').pop());
  });
  await page.goto(WEB, { waitUntil: 'networkidle' });
  await context.close();

  if (broken.length > 0) {
    console.error(
      `\nStale build: the server is serving HTML that references ${broken.length} chunk(s) ` +
        `no longer on disk (e.g. ${broken[0]}).\n` +
        `A build ran while the server was up. Restart it:\n\n` +
        `  pkill -f next-server && pnpm --filter @peptide/web start\n`
    );
    await browser.close();
    if (!REMOTE) await prisma.$disconnect();
    process.exit(1);
  }
}

// ===========================================================================
section('1. Patient booking journey, real Stripe Checkout');
// ===========================================================================

let bookingReference = null;

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const crashes = watchForCrashes(page, 'booking');

  await page.goto(WEB, { waitUntil: 'networkidle' });
  const heroText = await page.locator('h1').first().innerText();
  heroText.toLowerCase().includes('nothing to sell you')
    ? pass('Homepage renders')
    : fail('Homepage renders', heroText);

  await page.click('header >> text=Book a consultation');
  await page.waitForURL(/\/book$/, { timeout: 15000 });

  // The price on the booking screen must come from the database, not a copy.
  const bookBody = await page.locator('main').innerText();
  bookBody.includes('£95')
    ? pass('Consultation price read live from the API', '£95 from the database')
    : fail('Consultation price live', bookBody.slice(0, 80));

  await page.click('text=Continue to payment');
  await page.waitForURL(/\/book\/payment/, { timeout: 15000 });
  await shot(page, '01-payment');

  // --- Validation before anything is charged ---
  await page.click('button[type=submit]');
  await page.waitForTimeout(300);
  let error = await page.locator('text=Enter the email address').count();
  error > 0 ? pass('Payment: empty email blocked') : fail('Payment: empty email blocked');

  await page.fill('#email', 'not-an-email');
  await page.click('button[type=submit]');
  await page.waitForTimeout(300);
  error = await page.locator('text=/not valid/').count();
  error > 0 ? pass('Payment: malformed email blocked') : fail('Payment: malformed email blocked');

  // --- Real Stripe Checkout ---
  const patientEmail = `e2e+${Date.now()}@peptidemd.test`;
  await page.fill('#email', patientEmail);
  await page.click('button[type=submit]');

  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 45000 }).then(
    () => pass('Redirected to Stripe Checkout', 'hosted payment page'),
    () => fail('Redirected to Stripe Checkout', `stuck at ${page.url()}`)
  );

  if (page.url().includes('checkout.stripe.com')) {
    await shot(page, '02-stripe');

    // Stripe's own page. Test card 4242 4242 4242 4242.
    await page.waitForSelector('#cardNumber', { timeout: 45000 });
    await page.fill('#cardNumber', '4242424242424242');
    await page.fill('#cardExpiry', '12 / 30');
    await page.fill('#cardCvc', '123');
    await page.fill('#billingName', 'E2E Patient');
    const postcode = page.locator('#billingPostalCode');
    if (await postcode.count()) await postcode.fill('SW1A 1AA');

    await page.click('button[data-testid="hosted-payment-submit-button"]');

    await page.waitForURL(/\/book\/slot/, { timeout: 90000 }).then(
      () => pass('Stripe payment completed', 'returned to slot selection'),
      () => fail('Stripe payment completed', `stuck at ${page.url()}`)
    );
  }

  if (page.url().includes('/book/slot')) {
    // Payment must be verified server-side before any calendar appears.
    await page.waitForSelector('text=Payment received', { timeout: 30000 }).then(
      () => pass('Payment verified server-side', 'calendar unlocked'),
      () => fail('Payment verified server-side')
    );
    await shot(page, '03-slot');

    const slots = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ });
    const count = await slots.count();
    count > 0 ? pass('Live availability rendered', `${count} times`) : fail('Live availability');

    await slots.first().click();
    await page.click('text=Hold this time');
    await page.waitForURL(/\/book\/intake/, { timeout: 20000 }).then(
      () => pass('Slot held'),
      () => fail('Slot held', page.url())
    );
  }

  if (page.url().includes('/book/intake')) {
    await shot(page, '04-intake');

    // --- Intake validation ---
    await page.click('button:has-text("Confirm my appointment")');
    await page.waitForTimeout(400);
    const stillHere = page.url().includes('/book/intake');
    const shownErrors = await page.locator('.text-danger').count();
    stillHere && shownErrors > 0
      ? pass('Intake: empty submit blocked', `${shownErrors} field errors shown`)
      : fail('Intake: empty submit blocked');

    await page.fill('#name', 'E2E Patient');
    await page.fill('#email', 'bad-email');
    await page.fill('#phone', '+44 7700 900000');
    await page.fill('#concern', 'End-to-end verification of the booking journey.');
    await page.fill('#compounds', 'None');
    await page.fill('#history', 'None');
    await page.click('button:has-text("Confirm my appointment")');
    await page.waitForTimeout(400);
    (await page.locator('text=/email address is not valid/').count()) > 0
      ? pass('Intake: malformed email blocked')
      : fail('Intake: malformed email blocked');

    await page.fill('#email', patientEmail);
    await page.click('button:has-text("Confirm my appointment")');
    await page.waitForTimeout(400);
    (await page.locator('text=/[Cc]onsent/').count()) > 0
      ? pass('Intake: consent required')
      : fail('Intake: consent required');

    await page.check('#consentClinical');
    await page.check('#consentTerms');
    await page.click('button:has-text("Confirm my appointment")');

    await page.waitForURL(/\/book\/confirmed/, { timeout: 30000 }).then(
      () => pass('Booking confirmed'),
      () => fail('Booking confirmed', page.url())
    );
  }

  if (page.url().includes('/book/confirmed')) {
    await shot(page, '05-confirmed');
    const body = await page.locator('main').innerText();
    const match = body.match(/PMD-\d+/);
    bookingReference = match?.[0] ?? null;
    bookingReference
      ? pass('Confirmation shows the real reference', bookingReference)
      : fail('Confirmation shows the real reference');
  }

  crashes.length === 0
    ? pass('Booking journey: no runtime errors')
    : fail('Booking journey: no runtime errors', crashes[0]);

  await context.close();
}

// --- Persisted correctly? --------------------------------------------------

if (bookingReference && !REMOTE) {
  const booking = await prisma.booking.findUnique({
    where: { reference: bookingReference },
    include: { intakeResponses: true, payments: true, emails: true, patient: true },
  });

  booking?.status === 'CONFIRMED' && booking.paymentStatus === 'PAID'
    ? pass('Booking persisted as confirmed and paid')
    : fail('Booking persisted', `status=${booking?.status} payment=${booking?.paymentStatus}`);

  booking?.amountPaid === 9500
    ? pass('Amount recorded', '£95.00')
    : fail('Amount recorded', String(booking?.amountPaid));

  booking?.payments.some((p) => p.type === 'SUCCEEDED' && p.stripePaymentIntentId)
    ? pass('Stripe payment intent recorded')
    : fail('Stripe payment intent recorded');

  booking?.intakeResponses.length >= 3
    ? pass('Intake answers stored', `${booking.intakeResponses.length}`)
    : fail('Intake answers stored');

  const consents = await prisma.consentRecord.count({ where: { bookingId: booking?.id } });
  consents === 2 ? pass('Both consents recorded') : fail('Both consents recorded', String(consents));

  booking?.emails.some((e) => e.type === 'PATIENT_CONFIRMATION' && e.sentAt)
    ? pass('Confirmation email sent')
    : fail('Confirmation email sent');

  booking?.emails.some((e) => e.type === 'DOCTOR_NOTIFICATION' && e.sentAt)
    ? pass('Doctor notified')
    : fail('Doctor notified');
}

// ===========================================================================
section('2. Guards and failure handling');
// ===========================================================================

{
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${WEB}/book/intake`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  page.url().includes('/book/payment')
    ? pass('Deep link into intake redirects to payment')
    : fail('Deep link into intake', page.url());

  // Arriving at the calendar with no paid booking must be refused.
  await page.goto(`${WEB}/book/slot`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const refused =
    page.url().includes('/book/payment') ||
    (await page.locator('text=/could not confirm|not been paid|could not find/i').count()) > 0;
  refused ? pass('Unpaid visitor cannot reach the calendar') : fail('Unpaid visitor blocked', page.url());

  // Cancelling out of Stripe.
  await page.goto(`${WEB}/book/payment?cancelled=1`, { waitUntil: 'networkidle' });
  (await page.locator('text=/came back without paying/i').count()) > 0
    ? pass('Stripe cancellation explained')
    : fail('Stripe cancellation explained');

  await page.goto(`${WEB}/admin`, { waitUntil: 'networkidle' });
  page.url().includes('/admin/login')
    ? pass('Unauthenticated admin redirected to login')
    : fail('Unauthenticated admin redirected', page.url());

  // Wrong credentials.
  await page.fill('#email', 'ross@peptidemd.co.uk');
  await page.fill('#password', 'definitely-wrong');
  await page.click('button[type=submit]');
  await page.waitForTimeout(1500);
  (await page.locator('text=/do not match/i').count()) > 0
    ? pass('Wrong password rejected with a clear message')
    : fail('Wrong password rejected');

  // A forged cookie must not grant access, the API verifies the signature.
  await context.addCookies([
    { name: 'pmd_access', value: 'forged.token.value', domain: 'localhost', path: '/' },
  ]);
  await page.goto(`${WEB}/admin`, { waitUntil: 'networkidle' });
  page.url().includes('/admin/login')
    ? pass('Forged session cookie rejected')
    : fail('Forged session cookie rejected', page.url());

  await context.close();
}

// ===========================================================================
section('3. Admin, live data and RBAC');
// ===========================================================================

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const crashes = watchForCrashes(page, 'admin');

  await signIn(page, 'admin', 'ross@peptidemd.co.uk');
  await shot(page, '06-admin-dashboard');
  pass('Admin signed in with real credentials');

  // The booking just made must be visible to the admin.
  await page.goto(`${WEB}/admin/bookings`, { waitUntil: 'networkidle' });
  if (bookingReference) {
    (await page.locator(`text=${bookingReference}`).count()) > 0
      ? pass('New booking visible in the admin list', bookingReference)
      : fail('New booking visible in the admin list', bookingReference);
  }
  await shot(page, '07-admin-bookings');

  await page.selectOption('#channel', 'partner');
  await page.waitForTimeout(900);
  page.url().includes('channel=partner')
    ? pass('Filters persist to the URL')
    : fail('Filters persist to the URL', page.url());

  const firstRow = page.locator('tbody tr a').first();
  if (await firstRow.count()) {
    await firstRow.click();
    await page.waitForURL(/\/admin\/bookings\/[^/]+$/, { timeout: 15000 });
    // A route-level skeleton renders first now, so wait for the real content
    // rather than asserting against the loading state.
    await page
      .waitForSelector('text=Patient intake', { timeout: 15000 })
      .then(
        () => pass('Booking detail shows intake answers'),
        () => fail('Booking detail shows intake answers', 'not shown within 15s')
      );
    page.url().includes('channel=partner')
      ? pass('Filters carried into detail for the return trip')
      : fail('Filters carried into detail');
    await shot(page, '08-admin-booking-detail');
  }

  for (const [path, name] of [
    ['/admin/doctor-profile', 'Doctor profile'],
    ['/admin/availability', 'Availability'],
    ['/admin/settings', 'Settings'],
    ['/admin/partners', 'Partners'],
    ['/admin/invoices', 'Invoices'],
  ]) {
    await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle' });
    const broken = await page.locator('text=/Application error|Internal Server Error/i').count();
    broken === 0 ? pass(`${name} loads`) : fail(`${name} loads`, 'error boundary');
  }
  await shot(page, '09-admin-settings');

  crashes.length === 0 ? pass('Admin: no runtime errors') : fail('Admin: no runtime errors', crashes[0]);
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await signIn(page, 'admin', 'james@peptidemd.co.uk');
  pass('Doctor signed in through the shared admin door');

  const nav = await page.locator('nav[aria-label=Admin]').innerText();
  !/Partners|Invoices|Settings/.test(nav)
    ? pass('Doctor nav hides commercial sections')
    : fail('Doctor nav hides commercial sections', nav.replace(/\n/g, ' '));

  for (const path of ['/admin/settings', '/admin/invoices', '/admin/partners']) {
    await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle' });
    page.url().includes('/admin/no-access')
      ? pass(`Doctor blocked from ${path}`)
      : fail(`Doctor blocked from ${path}`, page.url());
  }

  await page.goto(`${WEB}/admin/bookings`, { waitUntil: 'networkidle' });
  const headers = await page.locator('thead').innerText();
  !/Paid|Source/i.test(headers)
    ? pass('Doctor sees no commercial columns')
    : fail('Doctor sees no commercial columns', headers.replace(/\n/g, ' '));

  await page.goto(`${WEB}/partner/bookings`, { waitUntil: 'networkidle' });
  page.url().includes('/admin')
    ? pass('Doctor bounced out of the partner portal')
    : fail('Doctor bounced out of the partner portal', page.url());

  await shot(page, '10-doctor');
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await signIn(page, 'partner', 'dana@newyoupeptides.com.au');
  pass('Partner signed in');

  const body = await page.locator('main').innerText();
  !body.includes('Five Peptides')
    ? pass('Partner sees only their own data')
    : fail('Partner sees only their own data', 'another partner leaked');

  await page.goto(`${WEB}/admin`, { waitUntil: 'networkidle' });
  page.url().includes('/partner/')
    ? pass('Partner bounced out of the admin panel')
    : fail('Partner bounced out of the admin panel', page.url());

  await shot(page, '11-partner');
  await context.close();
}

// ===========================================================================
section('4. Patient self-service, /manage');
// ===========================================================================

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const crashes = watchForCrashes(page, 'manage');

  await page.goto(`${WEB}/manage`, { waitUntil: 'networkidle' });

  await page.click('button[type=submit]');
  await page.waitForTimeout(400);
  (await page.locator('.text-danger, [role=alert]').count()) > 0
    ? pass('Manage: empty email blocked')
    : fail('Manage: empty email blocked');

  // An unknown address must not reveal whether it is a patient.
  await page.fill('input[type=email]', 'nobody-here@example.com');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2000);
  const afterUnknown = await page.locator('body').innerText();
  !/no account|not found|does not exist/i.test(afterUnknown)
    ? pass('Manage: unknown address does not disclose patient status')
    : fail('Manage: unknown address discloses patient status');

  await shot(page, '12-manage');
  crashes.length === 0 ? pass('Manage: no runtime errors') : fail('Manage: no runtime errors', crashes[0]);
  await context.close();
}

// ===========================================================================
section('5. Responsive, six widths, public and signed-in');
// ===========================================================================

const WIDTHS = [320, 375, 414, 768, 1024, 1440];

// One sign-in, reused at every width.
const authContext = await browser.newContext();
const authPage = await authContext.newPage();
await signIn(authPage, 'admin', 'ross@peptidemd.co.uk');
const adminSession = await authContext.storageState();
await authContext.close();

for (const width of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    storageState: adminSession,
  });
  const page = await context.newPage();
  const offenders = [];

  const publicPaths = ['/', '/how-it-works', '/about-peptides', '/the-doctor', '/faq', '/contact', '/book', '/book/payment', '/manage', '/privacy'];
  for (const path of publicPaths) {
    await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      if (doc.scrollWidth <= window.innerWidth + 1) return null;
      // Name the widest offending element so a failure is actionable.
      let worst = null;
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > window.innerWidth + 1 && r.width > 0) {
          if (!worst || r.right > worst.right) {
            worst = { right: Math.round(r.right), tag: el.tagName, cls: String(el.className).slice(0, 60) };
          }
        }
      });
      return { scrollWidth: doc.scrollWidth, worst };
    });
    if (overflow) offenders.push(`${path} (${overflow.scrollWidth}px, ${overflow.worst?.tag}.${overflow.worst?.cls})`);
  }

  for (const path of ['/admin', '/admin/bookings', '/admin/settings', '/admin/availability', '/admin/partners', '/admin/invoices']) {
    await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      if (doc.scrollWidth <= window.innerWidth + 1) return null;
      let worst = null;
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > window.innerWidth + 1 && r.width > 0) {
          if (!worst || r.right > worst.right) {
            worst = { right: Math.round(r.right), tag: el.tagName, cls: String(el.className).slice(0, 60) };
          }
        }
      });
      return { scrollWidth: doc.scrollWidth, worst };
    });
    if (overflow) offenders.push(`${path} (${overflow.scrollWidth}px, ${overflow.worst?.tag}.${overflow.worst?.cls})`);
  }

  if (width <= 414) await shot(page, `13-admin-${width}`);

  offenders.length === 0
    ? pass(`No horizontal overflow @${width}`, `${publicPaths.length + 6} screens`)
    : fail(`No horizontal overflow @${width}`, offenders.slice(0, 2).join(' | '));

  await context.close();
}

// Touch targets on a real phone profile.
{
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  await page.goto(WEB, { waitUntil: 'networkidle' });

  // WCAG 2.2 SC 2.5.8 (AA): a target is at least 24x24 CSS px. Links sitting
  // inline within a sentence are explicitly exempt, as are elements hidden
  // until focused, so both are skipped here.
  const tooSmall = await page.evaluate(() => {
    const MIN = 24;
    const bad = [];
    document.querySelectorAll('a, button, [role=button]').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return;
      // sr-only: clipped to a pixel until focused.
      if (style.clip !== 'auto' || style.clipPath !== 'none') return;
      // Inline links flowing inside a paragraph are exempt.
      if (style.display === 'inline' && el.closest('p, li, dd')) return;

      if (rect.height < MIN || rect.width < MIN) {
        bad.push(`${el.tagName}:${(el.textContent || '').trim().slice(0, 24)} (${Math.round(rect.width)}x${Math.round(rect.height)})`);
      }
    });
    return bad.slice(0, 5);
  });

  tooSmall.length === 0
    ? pass('Touch targets meet WCAG 2.2 (24px) on iPhone')
    : fail('Touch targets meet WCAG 2.2 (24px) on iPhone', tooSmall.join(', '));

  const menu = page.locator('button[aria-controls=site-menu]');
  if (await menu.count()) {
    await menu.click();
    await page.waitForTimeout(300);
    (await page.locator('#site-menu').isVisible())
      ? pass('Mobile navigation opens')
      : fail('Mobile navigation opens');
    await shot(page, '14-mobile-nav');
  }

  await context.close();
}

// ===========================================================================
// Report
// ===========================================================================

await browser.close();

// Leave the database as it was found.
if (bookingReference && !REMOTE) {
  const booking = await prisma.booking.findUnique({ where: { reference: bookingReference } });
  if (booking) {
    await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
    await prisma.patient.deleteMany({ where: { email: { contains: '@peptidemd.test' } } }).catch(() => {});
  }
}
await prisma.$disconnect();

const failed = results.filter((r) => !r.ok);
const seconds = Math.round((Date.now() - started) / 1000);

process.stdout.write(`\n${'='.repeat(64)}\n`);
process.stdout.write(`${results.length - failed.length} passed, ${failed.length} failed  (${seconds}s)\n`);
if (failed.length) {
  process.stdout.write('\nFailures:\n');
  failed.forEach((f) => process.stdout.write(`  ✗ ${f.name}${f.detail ? `, ${f.detail}` : ''}\n`));
}
process.stdout.write(`\nScreenshots: ${SHOTS}\n`);
process.exit(failed.length > 0 ? 1 : 0);
