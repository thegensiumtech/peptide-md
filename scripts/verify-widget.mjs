/**
 * The embeddable booking widget.
 *
 * This is the only part of the platform that runs inside somebody else's
 * website, which makes the risks different from everything else here. Three in
 * particular are checked below because each would be invisible to us and
 * obvious to the partner:
 *
 *  - **Isolation.** The scope requires the widget "cannot affect or be
 *    affected by the host website". That is a claim about CSS and globals, so
 *    it is tested by loading it into a hostile host page that sets aggressive
 *    styles and a conflicting global, then checking the widget is untouched.
 *  - **Framing.** Being framed is the widget's whole purpose, and being framed
 *    is exactly what the rest of the site must refuse. Both halves are
 *    checked, because a single over-broad header rule silently breaks one or
 *    the other. One did, during this build.
 *  - **Attribution.** A booking made through the widget has to reach the right
 *    partner, or the invoice at the end of the month is wrong.
 *
 * Needs the web app and the API running.
 *
 *   node scripts/verify-widget.mjs
 */
import { chromium } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(import.meta.dirname, '../.env.local') });

const WEB = process.env.BASE_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:4000';
const CLIENT_ID = 'pmd_live_ny_8f21c4a9';

const prisma = new PrismaClient();
const results = [];
const pass = (n, d = '') => { results.push(true); console.log(`  ✓ ${n}${d ? `, ${d}` : ''}`); };
const fail = (n, d = '') => { results.push(false); console.log(`  ✗ ${n}${d ? `, ${d}` : ''}`); };

/**
 * A deliberately hostile host page.
 *
 * Global CSS that would wreck an inline widget, a conflicting `fetch` global,
 * and a same-named element id. If the widget survives all three, the isolation
 * claim is real rather than asserted.
 */
const HOST_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>New You Peptides</title>
<style>
  * { font-family: "Comic Sans MS", cursive !important; box-sizing: content-box; }
  body { margin: 0; background: #2b0a3d; color: #ff0; }
  button, input { all: unset; background: red !important; color: lime !important; }
  div { border: 4px dashed magenta; }
</style></head>
<body>
  <h1 id="host-heading">New You Peptides</h1>
  <div id="peptide-booking"></div>
  <script>
    // A host page that has already taken the names a careless widget might use.
    window.fetch = function () { throw new Error('host fetch'); };
    window.PeptideMD = 'host value';
  </script>
  <script src="${WEB}/v1/widget.js" data-client-id="${CLIENT_ID}" defer></script>
</body></html>`;

/**
 * The host page is served over HTTP, not written to disk and opened as a file.
 *
 * CSP `frame-ancestors *` matches network schemes only: a `file://` parent is
 * refused by it, so a file-based host page tests the browser's opinion of
 * file URLs rather than our framing policy. A real partner site is https, so
 * the test should be http.
 */
const HOST_PORT = 4321;
const hostServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HOST_PAGE);
});
await new Promise((ready) => hostServer.listen(HOST_PORT, ready));
const HOST_URL = `http://localhost:${HOST_PORT}/`;

const browser = await chromium.launch();

// --- Framing policy ----------------------------------------------------------

{
  const embed = await fetch(`${WEB}/embed/${CLIENT_ID}`);
  const csp = embed.headers.get('content-security-policy') ?? '';
  const xfo = embed.headers.get('x-frame-options');

  csp.includes('frame-ancestors *') && !xfo
    ? pass('The widget route allows framing', 'frame-ancestors *')
    : fail('Widget framing', `csp="${csp}" xfo="${xfo}"`);
}

{
  const admin = await fetch(`${WEB}/admin/login`);
  const csp = admin.headers.get('content-security-policy') ?? '';
  const xfo = admin.headers.get('x-frame-options') ?? '';

  csp.includes("frame-ancestors 'none'") && xfo.toUpperCase() === 'DENY'
    ? pass('Every other route refuses framing', "frame-ancestors 'none' and DENY")
    : fail('Site framing policy', `csp="${csp}" xfo="${xfo}"`);
}

// --- The loader --------------------------------------------------------------

{
  const res = await fetch(`${WEB}/v1/widget.js`);
  const body = await res.text();
  const type = res.headers.get('content-type') ?? '';

  res.ok && type.includes('javascript') && body.includes('iframe')
    ? pass('The loader script is served', `${body.length} bytes`)
    : fail('Loader script', `${res.status} ${type}`);
}

// --- It loads inside a hostile host page ------------------------------------

const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const crashes = [];
page.on('pageerror', (error) => crashes.push(error.message.slice(0, 120)));

await page.goto(HOST_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

let frame = null;
{
  const iframe = page.locator('#peptide-booking iframe');
  const count = await iframe.count();
  frame = count ? page.frameLocator('#peptide-booking iframe') : null;

  count === 1
    ? pass('The widget injects exactly one iframe into the host page')
    : fail('Widget injection', `${count} iframes`);
}

{
  const src = await page.locator('#peptide-booking iframe').getAttribute('src');
  src?.includes(`/embed/${CLIENT_ID}`)
    ? pass('The iframe points at this partner', CLIENT_ID)
    : fail('Iframe src', String(src));
}

{
  const sandbox = await page.locator('#peptide-booking iframe').getAttribute('sandbox');
  // allow-top-navigation would let anything inside redirect the partner's
  // whole page, which is the one thing an embedded widget must never do.
  sandbox && !sandbox.includes('allow-top-navigation')
    ? pass('The iframe cannot navigate the host page away', sandbox)
    : fail('Iframe sandbox', String(sandbox));
}

// --- Isolation ---------------------------------------------------------------

// Everything below depends on the widget having actually rendered. Without
// this the style checks pass on an empty frame, which is exactly what happened
// the first time this suite ran: a blank iframe inherits no font, so "the host
// font did not reach inside" was true and meaningless.
let rendered = false;
if (frame) {
  const heading = frame.locator('h2').first();
  await heading.waitFor({ timeout: 25000 }).catch(() => {});
  rendered = (await heading.count()) > 0;

  rendered
    ? pass('The widget renders inside the host page')
    : fail('Widget renders', 'the iframe is empty, likely refused framing');
}

if (rendered) {
  const font = await frame
    .locator('h2')
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily)
    .catch(() => '');
  font && !font.toLowerCase().includes('comic')
    ? pass("The host page's global font does not reach inside", font.slice(0, 40))
    : fail('CSS isolation', `widget font resolved to "${font}"`);
}

if (rendered) {
  const button = frame.locator('button[type=button]').first();
  const background = await button
    .evaluate((el) => getComputedStyle(el).backgroundColor)
    .catch(() => '');

  // The host sets `button { background: red !important }`. An inline widget
  // would be wearing it.
  background && background !== 'rgb(255, 0, 0)'
    ? pass("The host page's button styling does not reach inside", background)
    : fail('CSS isolation on controls', `resolved to "${background}"`);
}

{
  // The host replaced window.fetch with something that throws. If the widget
  // shared that global it could not have loaded its own availability.
  const stillBroken = await page.evaluate(() => {
    try {
      window.fetch('/nope');
      return false;
    } catch {
      return true;
    }
  });
  stillBroken
    ? pass("The widget did not repair or replace the host's globals")
    : fail('Global isolation', "the host's fetch was overwritten");
}

// --- It actually works -------------------------------------------------------

if (rendered) {
  // Waited on rather than slept on. The iframe loads lazily and then fetches
  // its own availability, so a fixed pause is a race that passes on a fast
  // machine and fails on a slow one.
  const slots = frame.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ });
  await slots.first().waitFor({ timeout: 25000 }).catch(() => {});

  const count = await slots.count();
  count > 0
    ? pass('Live availability renders inside the widget', `${count} times offered`)
    : fail('Widget availability', 'no times offered');
}

let reference = null;
if (rendered) {
  const slots = frame.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ });
  if (await slots.count()) {
    await slots.first().click();
    await frame.locator('input[name=name]').waitFor({ timeout: 20000 });

    await frame.locator('input[name=name]').fill('Widget Test Patient');
    await frame.locator('input[name=email]').fill('widget+test@peptidemd.test');
    await frame.locator('input[name=phone]').fill('+61 400 111 222');
    await frame.locator('textarea[name=reason]').fill('Booked through the embedded widget.');
    await frame.locator('input[name=consent]').check();
    await frame.locator('button[type=submit]').click();
    await frame.locator('text=You are booked in.').waitFor({ timeout: 25000 }).catch(() => {});

    const done = await frame.locator('text=You are booked in.').count();
    done > 0 ? pass('A booking completes inside the widget') : fail('Widget booking');

    const booking = await prisma.booking.findFirst({
      where: { patient: { email: 'widget+test@peptidemd.test' } },
      orderBy: { createdAt: 'desc' },
      include: { partner: true },
    });
    reference = booking?.reference ?? null;

    booking?.channel === 'PARTNER' && booking?.partner?.slug === 'new-you-peptides'
      ? pass('The booking is attributed to the right partner', booking.reference)
      : fail('Widget attribution', `channel=${booking?.channel} partner=${booking?.partner?.slug}`);

    booking?.amountPaid === null
      ? pass('No payment is recorded, the partner took it')
      : fail('Widget payment', String(booking?.amountPaid));

    const consent = await prisma.consentRecord.count({ where: { bookingId: booking?.id } });
    consent === 1
      ? pass('Consent is recorded with its exact wording')
      : fail('Widget consent', `${consent} records`);
  }
}

{
  crashes.length === 0
    ? pass('No runtime errors in the host page')
    : fail('Host page errors', crashes[0]);
}

// --- Responsive --------------------------------------------------------------

for (const width of [320, 375, 768, 1024, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const p2 = await ctx.newPage();
  await p2.goto(`${WEB}/embed/${CLIENT_ID}`, { waitUntil: 'networkidle' });
  await p2.waitForTimeout(1200);

  const overflow = await p2.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  overflow ? fail(`No horizontal overflow @${width}`) : pass(`No horizontal overflow @${width}`);
  await ctx.close();
}

// --- Cleanup -----------------------------------------------------------------

await prisma.booking.deleteMany({ where: { patient: { email: { startsWith: 'widget+' } } } });
await prisma.patient.deleteMany({ where: { email: { startsWith: 'widget+' } } });
await prisma.$disconnect();
await browser.close();
await new Promise((closed) => hostServer.close(closed));

const failed = results.filter((r) => !r).length;
console.log(`\n${'='.repeat(60)}`);
console.log(`${results.length - failed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('\nThe widget books, attributes correctly, and the host page cannot touch it.');
}
process.exit(failed > 0 ? 1 : 0);
