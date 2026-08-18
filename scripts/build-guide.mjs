/**
 * Render the lead-magnet guide to a PDF.
 *
 * Typeset in the brand's own type and colour so the download looks like the
 * site rather than a generic export. Playwright is already a dependency for
 * the E2E suite, so no PDF library is added for this.
 *
 *   node scripts/build-guide.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = readFileSync(resolve(root, 'apps/api/src/guides/peptide-guide.ts'), 'utf8');

// The guide is authored as TypeScript so the API can also render it as HTML.
// Rather than add a build step, the literals are lifted out here.
const pick = (name) => {
  const m = src.match(new RegExp(`export const ${name} =\\s*([\\s\\S]*?);\\n`));
  return m ? eval(m[1]) : null;
};
const TITLE = pick('GUIDE_TITLE');
const SUBTITLE = pick('GUIDE_SUBTITLE');
const SECTIONS = eval(src.slice(src.indexOf('export const GUIDE_SECTIONS')).replace(/^export const GUIDE_SECTIONS: GuideSection\[\] =/, '').replace(/;\s*$/, ''));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root { --ink:#0C2D4C; --accent:#157490; --bright:#33BBC1; --muted:#697D92; --line:#D8E3EA; --paper:#F5F8FA; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:Inter,sans-serif; color:var(--ink); font-size:10.5pt; line-height:1.65; }
  .cover { height:100vh; display:flex; flex-direction:column; justify-content:center; padding:0 22mm;
           background:linear-gradient(160deg,#0C2D4C 0%,#157490 100%); color:#fff; page-break-after:always; }
  .cover .eyebrow { font-family:'IBM Plex Mono',monospace; font-size:8pt; letter-spacing:.22em; text-transform:uppercase; opacity:.8; }
  .cover h1 { font-family:Newsreader,serif; font-size:34pt; line-height:1.1; font-weight:500; margin:14mm 0 6mm; }
  .cover p { font-size:12pt; line-height:1.6; opacity:.85; max-width:130mm; }
  .cover .rule { width:28mm; height:2px; background:var(--bright); margin:12mm 0; }
  .cover .foot { margin-top:auto; padding-bottom:6mm; font-family:'IBM Plex Mono',monospace; font-size:8pt; letter-spacing:.14em; text-transform:uppercase; opacity:.75; }
  main { padding:20mm 22mm; }
  section { page-break-inside:avoid; margin-bottom:11mm; }
  h2 { font-family:Newsreader,serif; font-size:17pt; font-weight:500; line-height:1.2; margin:0 0 3mm;
       padding-top:4mm; border-top:1px solid var(--line); }
  .standfirst { font-family:Newsreader,serif; font-style:italic; font-size:11.5pt; color:var(--accent); margin:0 0 4mm; }
  p { margin:0 0 3.5mm; }
  ul { margin:4mm 0; padding-left:5mm; }
  li { margin-bottom:2mm; }
  li::marker { color:var(--bright); }
  .callout { background:var(--paper); border-left:3px solid var(--accent); padding:4mm 5mm; margin:5mm 0; }
  .callout .t { font-family:'IBM Plex Mono',monospace; font-size:8pt; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin-bottom:2mm; }
  .callout p { margin:0; font-size:10pt; }
  .end { margin-top:14mm; padding:6mm; border:1px solid var(--line); text-align:center; }
  .end h3 { font-family:Newsreader,serif; font-size:15pt; font-weight:500; margin:0 0 3mm; }
  .end p { color:var(--muted); font-size:10pt; margin:0 0 4mm; }
  .end .cta { display:inline-block; background:var(--accent); color:#fff; padding:3mm 7mm; font-weight:500; }
</style></head><body>
<div class="cover">
  <div class="eyebrow">Peptides MD · Medical Consultations</div>
  <h1>${esc(TITLE)}</h1>
  <div class="rule"></div>
  <p>${esc(SUBTITLE)}</p>
  <div class="foot">Written by a doctor with nothing to sell you</div>
</div>
<main>
${SECTIONS.map((s) => `<section>
  <h2>${esc(s.heading)}</h2>
  ${s.standfirst ? `<p class="standfirst">${esc(s.standfirst)}</p>` : ''}
  ${s.body.map((b) => `<p>${esc(b)}</p>`).join('')}
  ${s.list ? `<ul>${s.list.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
  ${s.callout ? `<div class="callout"><div class="t">${esc(s.callout.title)}</div><p>${esc(s.callout.body)}</p></div>` : ''}
</section>`).join('')}
<div class="end">
  <h3>Twenty minutes with a doctor who has nothing to sell you</h3>
  <p>£95 · GMC-registered · no products, no suppliers, no affiliates</p>
  <div class="cta">peptidesmd.com</div>
</div>
</main></body></html>`;

const out = resolve(root, 'apps/web/public/guides');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.pdf({
  path: resolve(out, 'peptides-md-guide.pdf'),
  format: 'A4',
  printBackground: true,
  margin: { top: 0, bottom: '14mm', left: 0, right: 0 },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate:
    '<div style="width:100%;font-family:monospace;font-size:7pt;color:#697D92;padding:0 22mm;display:flex;justify-content:space-between;"><span>Peptides MD — general information, not medical advice</span><span class="pageNumber"></span></div>',
});
await browser.close();
console.log(`  written: apps/web/public/guides/peptides-md-guide.pdf (${SECTIONS.length} sections)`);
