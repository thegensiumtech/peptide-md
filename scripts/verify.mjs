/**
 * End-to-end verification.
 *
 * Builds nothing and assumes `pnpm build` has run and the app is up.
 *
 * This used to start its own server on port 3100 to isolate itself from a
 * stale build. That traded one problem for two. The API's CORS allowlist is a
 * single origin, so every client-side fetch from a page served on 3100 was
 * blocked, and two `next start` processes sharing one .next directory served
 * mismatched chunk hashes anyway. Both showed up as a wall of unrelated
 * failures on screens that were perfectly fine.
 *
 * So it now points at the running server like every other suite, and guards
 * against the stale build directly instead.
 *
 *   pnpm verify
 *   BASE_URL=https://peptidemd.co.uk node scripts/verify.mjs
 */
import { chromium } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(import.meta.dirname, '../.env.local') });

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const prisma = new PrismaClient();

const results = [];
const pass = (name, detail = '') => results.push({ ok: true, name, detail });
const fail = (name, detail = '') => results.push({ ok: false, name, detail });

// --- Routes ------------------------------------------------------------------

const PUBLIC = [
  '/', '/how-it-works', '/about-peptides', '/the-doctor', '/faq', '/contact',
  '/privacy', '/terms', '/medical-disclaimer', '/admin/login', '/partner/login',
];

/**
 * Detail routes are resolved from the database, not hardcoded.
 *
 * These used to be fixture ids (`bkg_pmd_4871`, `ptr_newyou`,
 * `inv_2026_08_newyou`). Those screens read live data now, so every one of
 * them was a guaranteed 404 dressed up as a route check: the crawl proved the
 * not-found page renders cleanly and nothing else.
 */
const [sampleBookings, samplePartners, sampleInvoices] = await Promise.all([
  prisma.booking.findMany({ take: 2, select: { id: true }, orderBy: { createdAt: 'desc' } }),
  prisma.partner.findMany({ take: 3, select: { id: true }, orderBy: { name: 'asc' } }),
  prisma.invoice.findMany({ take: 3, select: { id: true }, orderBy: { period: 'desc' } }),
]);

const ADMIN = [
  '/admin', '/admin/bookings', '/admin/doctor-profile', '/admin/availability',
  '/admin/settings', '/admin/partners', '/admin/partners/new', '/admin/invoices',
  '/admin/leads', '/admin/no-access',
  ...sampleBookings.map((b) => `/admin/bookings/${b.id}`),
  ...samplePartners.map((p) => `/admin/partners/${p.id}`),
  ...sampleInvoices.map((i) => `/admin/invoices/${i.id}`),
];

const DOCTOR = [
  '/admin', '/admin/bookings', '/admin/availability', '/admin/doctor-profile',
  ...sampleBookings.slice(0, 1).map((b) => `/admin/bookings/${b.id}`),
];
const PARTNER = ['/partner', '/partner/bookings', '/partner/invoices', '/partner/api-credentials'];

// --- Server ------------------------------------------------------------------

const reachable = await fetch(BASE)
  .then((r) => r.ok)
  .catch(() => false);

if (!reachable) {
  console.error(`Nothing is serving ${BASE}. Run "pnpm build" then "pnpm start".`);
  await prisma.$disconnect();
  process.exit(1);
}

const browser = await chromium.launch();

/**
 * Stale build guard, same reasoning as scripts/e2e.mjs.
 *
 * Running `pnpm build` while `next start` is up rewrites the chunk hashes on
 * disk while the server keeps serving HTML pointing at the old ones. Every page
 * then dies with a ChunkLoadError, which reads like a hundred unrelated bugs.
 */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const broken = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/_next/static/')) broken.push(r.url().split('/').pop());
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await ctx.close();

  if (broken.length > 0) {
    console.error(
      `\nStale build: the server is serving HTML referencing ${broken.length} chunk(s) ` +
        `no longer on disk (e.g. ${broken[0]}).\nA build ran while the server was up. Restart it:\n\n` +
        '  pkill -f next-server && pnpm --filter @peptide/web start\n'
    );
    await browser.close();
    await prisma.$disconnect();
    process.exit(1);
  }
}

// The seeded development password. This used to be any string at all, because
// the login accepted anything outside production; that shortcut was removed
// when it turned out to be reachable on the live site, so the real password is
// needed here. It matches DEV_PASSWORD in packages/database/prisma/seed.ts.
const PASSWORD = 'peptide-dev-2026';

async function signIn(page, area, email) {
  await page.goto(`${BASE}/${area}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 }),
    page.click('button[type=submit]'),
  ]);
}

// --- 1. Every route loads without a client-side exception --------------------

async function crawl(label, paths, setup) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const broken = [];

  page.on('pageerror', (e) => broken.push(`${page.url()} :: ${e.message.slice(0, 120)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') broken.push(`${page.url()} :: ${m.text().slice(0, 120)}`);
  });

  if (setup) await setup(page);

  for (const path of paths) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(200);
    const body = await page.locator('body').innerText().catch(() => '');
    if (/Application error|client-side exception|Internal Server Error/i.test(body)) {
      broken.push(`${path} :: error boundary rendered`);
    }
    if ((res?.status() ?? 0) >= 400) broken.push(`${path} :: HTTP ${res.status()}`);
  }

  await ctx.close();
  broken.length === 0
    ? pass(`${label}: ${paths.length} routes load clean`)
    : fail(`${label} routes`, [...new Set(broken)].slice(0, 3).join(' | '));
}

await crawl('public', PUBLIC);
await crawl('admin', ADMIN, (p) => signIn(p, 'admin', 'ross@peptidemd.co.uk'));
await crawl('doctor', DOCTOR, (p) => signIn(p, 'admin', 'mark@peptidemd.co.uk'));
await crawl('partner', PARTNER, (p) => signIn(p, 'partner', 'dana@newyoupeptides.com.au'));

// --- 2. The booking flow's entry conditions ---------------------------------

/**
 * Not the whole paid journey.
 *
 * This used to click "Card declined" and "Payment succeeds" on a mock payment
 * screen, then walk through slot, intake and confirmation. Those buttons went
 * when Stripe Checkout was wired in for real, so the block was testing a UI
 * that no longer exists and failing on the first click.
 *
 * The real journey now leaves our origin for Stripe's hosted page, which needs
 * a test card typed into somebody else's form. scripts/e2e.mjs does exactly
 * that and asserts the booking, payment intent and confirmation afterwards.
 * Duplicating it here would make this suite slow and flaky for no extra cover,
 * so what stays is the part e2e cannot cheaply repeat: that the flow refuses to
 * start in the wrong place.
 */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // The calendar is never reachable before payment. This is the rule the whole
  // scheduling design rests on, so it is worth asserting on every run.
  for (const deepLink of ['/book/intake', '/book/slot']) {
    await page.goto(`${BASE}${deepLink}`, { waitUntil: 'networkidle' });
    await page.waitForURL(/\/book\/payment/, { timeout: 6000 }).then(
      () => pass('Booking guard', `${deepLink} with no payment → /book/payment`),
      () => fail('Booking guard', `${deepLink} landed on ${page.url()}`)
    );
  }

  await page.goto(`${BASE}/book/payment`, { waitUntil: 'networkidle' });

  const payButton = page.locator('button:has-text("Pay ")');
  (await payButton.count()) > 0
    ? pass('Payment screen offers the Stripe handoff')
    : fail('Payment screen', 'no pay button rendered');

  const body = await page.locator('main').innerText();
  /Stripe/.test(body) && !/card number/i.test(body)
    ? pass('Card details are never collected on our own page')
    : fail('Payment screen', 'the page looks like it takes card details itself');

  errors.length === 0 ? pass('Booking entry', 'no runtime errors') : fail('Booking entry', errors[0]);
  await ctx.close();
}

// --- 3. Access control -------------------------------------------------------

{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  page.url().includes('/admin/login')
    ? pass('Unauthenticated admin', 'redirected to login')
    : fail('Unauthenticated admin', page.url());

  await signIn(page, 'admin', 'mark@peptidemd.co.uk');
  const nav = await page.locator('nav[aria-label=Admin]').innerText();
  !/Partners|Invoices|Settings/.test(nav)
    ? pass('Doctor nav', 'commercial items hidden')
    : fail('Doctor nav', nav.replace(/\n/g, ' '));

  for (const path of ['/admin/settings', '/admin/invoices', '/admin/partners']) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    page.url().includes('/admin/no-access')
      ? pass(`Doctor blocked from ${path}`)
      : fail(`Doctor blocked from ${path}`, page.url());
  }

  await page.goto(`${BASE}/partner/bookings`, { waitUntil: 'networkidle' });
  page.url().includes('/admin') ? pass('Doctor → partner area', 'bounced') : fail('Doctor → partner area', page.url());
  await ctx.close();
}

{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, 'partner', 'dana@newyoupeptides.com.au');

  const body = await page.locator('main').innerText();
  !body.includes('Five Peptides')
    ? pass('Partner scoping', 'only their own data')
    : fail('Partner scoping', 'another partner leaked');

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  page.url().includes('/partner/')
    ? pass('Partner → admin area', 'bounced')
    : fail('Partner → admin area', page.url());
  await ctx.close();
}

// --- 4. Responsive -----------------------------------------------------------

for (const width of [320, 375, 768, 1024, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const overflowPublic = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );

  await signIn(page, 'admin', 'ross@peptidemd.co.uk');
  await page.goto(`${BASE}/admin/bookings`, { waitUntil: 'networkidle' });
  const overflowAdmin = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );

  !overflowPublic && !overflowAdmin
    ? pass(`No horizontal overflow @${width}`)
    : fail(`No horizontal overflow @${width}`, `public=${overflowPublic} admin=${overflowAdmin}`);
  await ctx.close();
}

await browser.close();
await prisma.$disconnect();

// --- Report ------------------------------------------------------------------

for (const r of results) {
  console.log(`${r.ok ? 'PASS ' : 'FAIL '} ${r.name}${r.detail ? `, ${r.detail}` : ''}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
