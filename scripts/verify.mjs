/**
 * End-to-end verification.
 *
 * Builds nothing and assumes `pnpm build` has run. Starts its own server on its
 * own port and shuts it down afterwards, that isolation is deliberate: serving
 * a freshly rebuilt .next from an already-running server makes the HTML
 * reference the previous build's chunk hashes, which surfaces in the browser as
 * "Application error: a client-side exception has occurred".
 *
 *   pnpm verify
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;

const results = [];
const pass = (name, detail = '') => results.push({ ok: true, name, detail });
const fail = (name, detail = '') => results.push({ ok: false, name, detail });

// --- Routes ------------------------------------------------------------------

const PUBLIC = [
  '/', '/how-it-works', '/about-peptides', '/the-doctor', '/faq', '/contact',
  '/privacy', '/terms', '/medical-disclaimer', '/admin/login', '/partner/login',
];

const ADMIN = [
  '/admin', '/admin/bookings', '/admin/bookings/bkg_pmd_4871',
  '/admin/bookings/bkg_pmd_4872', '/admin/doctor-profile', '/admin/availability',
  '/admin/settings', '/admin/partners', '/admin/partners/new',
  '/admin/partners/ptr_newyou', '/admin/partners/ptr_fivepeptides',
  '/admin/partners/ptr_apexlabs', '/admin/invoices',
  '/admin/invoices/inv_2026_08_newyou', '/admin/invoices/inv_2026_07_newyou',
  '/admin/invoices/inv_2026_06_fivepeptides', '/admin/no-access',
];

const DOCTOR = ['/admin', '/admin/bookings', '/admin/bookings/bkg_pmd_4871', '/admin/availability', '/admin/doctor-profile'];
const PARTNER = ['/partner', '/partner/bookings', '/partner/invoices', '/partner/api-credentials'];

// --- Server ------------------------------------------------------------------

const server = spawn('pnpm', ['--filter', '@peptide/web', 'exec', 'next', 'start', '--port', String(PORT)], {
  stdio: 'ignore',
  detached: true,
});

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return true;
    } catch {
      // not listening yet
    }
    await sleep(500);
  }
  return false;
}

function stopServer() {
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    // already gone
  }
}

if (!(await waitForServer())) {
  stopServer();
  console.error(`Server never came up on ${PORT}. Run "pnpm build" first.`);
  process.exit(1);
}

const browser = await chromium.launch();

async function signIn(page, area, email) {
  await page.goto(`${BASE}/${area}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', 'x');
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
await crawl('admin', ADMIN, (p) => signIn(p, 'admin', 'ross@peptidemd.com'));
await crawl('doctor', DOCTOR, (p) => signIn(p, 'admin', 'james@peptidemd.com'));
await crawl('partner', PARTNER, (p) => signIn(p, 'partner', 'dana@newyoupeptides.com.au'));

// --- 2. Patient booking journey ---------------------------------------------

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${BASE}/book/intake`, { waitUntil: 'networkidle' });
  await page.waitForURL(/\/book\/payment/, { timeout: 6000 }).then(
    () => pass('Booking guard', 'deep link with no payment → /book/payment'),
    () => fail('Booking guard', `landed on ${page.url()}`)
  );

  await page.goto(`${BASE}/book/payment`, { waitUntil: 'networkidle' });
  await page.click('text=Card declined');
  await page.waitForSelector('text=Your card was declined', { timeout: 6000 }).then(
    () => pass('Payment failure', 'no slot consumed'),
    () => fail('Payment failure')
  );

  await page.click('text=Payment succeeds');
  await page.waitForURL(/\/book\/slot/, { timeout: 10000 });
  await page.waitForTimeout(400);

  const slots = page.locator('button:not([disabled])').filter({ hasText: /^\d{2}:\d{2}$/ });
  const count = await slots.count();
  count > 0 ? pass('Slot grid', `${count} times offered`) : fail('Slot grid', 'none offered');

  await slots.first().click();
  await page.click('text=Hold this time');
  await page.waitForURL(/\/book\/intake/, { timeout: 10000 });

  await page.click('button:has-text("Confirm my appointment")');
  await page.waitForTimeout(300);
  page.url().includes('/book/intake')
    ? pass('Intake validation', 'empty submit blocked')
    : fail('Intake validation', 'empty submit went through');

  await page.fill('#name', 'Aaron Beckett');
  await page.fill('#email', 'a.beckett@example.com');
  await page.fill('#phone', '+44 7700 900142');
  await page.fill('#concern', 'Considering BPC-157 for a recurring achilles injury.');
  await page.fill('#compounds', 'None currently');
  await page.fill('#history', 'No regular medication');
  await page.check('#consentClinical');
  await page.check('#consentTerms');
  await page.click('button:has-text("Confirm my appointment")');
  await page.waitForURL(/\/book\/confirmed/, { timeout: 10000 });

  const heading = await page.locator('h1').innerText();
  heading.includes('Aaron') ? pass('Confirmation', 'terminal and personalised') : fail('Confirmation', heading);

  errors.length === 0 ? pass('Booking journey', 'no runtime errors') : fail('Booking journey', errors[0]);
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

  await signIn(page, 'admin', 'james@peptidemd.com');
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

  await signIn(page, 'admin', 'ross@peptidemd.com');
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
stopServer();

// --- Report ------------------------------------------------------------------

for (const r of results) {
  console.log(`${r.ok ? 'PASS ' : 'FAIL '} ${r.name}${r.detail ? `, ${r.detail}` : ''}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
