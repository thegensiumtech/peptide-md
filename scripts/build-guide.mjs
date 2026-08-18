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

// Authored as TypeScript so the API can render it as HTML too; the literals
// are lifted out here rather than adding a build step for one file.
const between = (start, end) => {
  const a = src.indexOf(start);
  const b = end ? src.indexOf(end, a) : src.length;
  // Parenthesised: eval reads a bare {...} as a block, not an object literal.
  return `(${src.slice(a + start.length, b).replace(/;\s*$/, '').trim()})`;
};
const TITLE = eval(between('export const GUIDE_TITLE =', '\nexport const GUIDE_SUBTITLE'));
const SUBTITLE = eval(between('export const GUIDE_SUBTITLE =', '\nexport const TIER_LABEL'));
const TIER_LABEL = eval(between('export const TIER_LABEL: Record<Tier, string> =', '\nexport const OPENING'));
const OPENING = eval(between('export const OPENING: GuideSection[] =', '\nexport const GROUPS'));
const GROUPS = eval(between('export const GROUPS: CompoundGroup[] =', '\nexport const CLOSING'));
const CLOSING = eval(between('export const CLOSING: GuideSection[] ='));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const section = (s) => `<section>
  <h2>${esc(s.heading)}</h2>
  ${s.standfirst ? `<p class="standfirst">${esc(s.standfirst)}</p>` : ''}
  ${s.body.map((b) => `<p>${esc(b)}</p>`).join('')}
  ${s.list ? `<ul>${s.list.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
  ${s.callout ? `<div class="callout"><div class="t">${esc(s.callout.title)}</div><p>${esc(s.callout.body)}</p></div>` : ''}
</section>`;

const compound = (c) => `<article class="cmp tier-${c.tier}">
  <header>
    <div>
      <h4>${esc(c.name)}</h4>
      ${c.aka ? `<div class="aka">also sold as ${esc(c.aka)}</div>` : ''}
    </div>
    <span class="tier">${esc(TIER_LABEL[c.tier])}</span>
  </header>
  <dl>
    <dt>Claimed to</dt><dd>${esc(c.claim)}</dd>
    <dt>Evidence</dt><dd>${esc(c.evidence)}</dd>
    <dt>UK status</dt><dd>${esc(c.ukStatus)}</dd>
    <dt class="risk">Worth knowing</dt><dd class="risk">${esc(c.risk)}</dd>
  </dl>
</article>`;

const total = GROUPS.reduce((n, g) => n + g.compounds.length, 0);

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root { --ink:#0C2D4C; --accent:#157490; --bright:#33BBC1; --muted:#697D92; --line:#D8E3EA; --paper:#F5F8FA; --amberish:#9A5B00; --danger:#9B2C1E; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:Inter,sans-serif; color:var(--ink); font-size:10pt; line-height:1.6; }

  .cover { height:100vh; display:flex; flex-direction:column; justify-content:center; padding:0 22mm;
           background:linear-gradient(155deg,#0C2D4C 0%,#125A78 55%,#157490 100%); color:#fff; page-break-after:always; }
  .cover .eyebrow { font-family:'IBM Plex Mono',monospace; font-size:8pt; letter-spacing:.24em; text-transform:uppercase; opacity:.8; }
  .cover h1 { font-family:Newsreader,serif; font-size:38pt; line-height:1.05; font-weight:500; margin:16mm 0 0; }
  .cover .rule { width:30mm; height:2px; background:var(--bright); margin:10mm 0; }
  .cover .sub { font-size:12pt; line-height:1.6; opacity:.9; max-width:125mm; }
  .cover .stats { display:flex; gap:14mm; margin-top:14mm; }
  .cover .stats div span { display:block; font-family:'IBM Plex Mono',monospace; font-size:8pt; letter-spacing:.16em; text-transform:uppercase; opacity:.7; }
  .cover .stats div strong { font-family:Newsreader,serif; font-size:20pt; font-weight:500; }
  .cover .foot { margin-top:auto; padding-bottom:6mm; font-family:'IBM Plex Mono',monospace; font-size:8pt; letter-spacing:.14em; text-transform:uppercase; opacity:.75; }

  .contents { padding:22mm; page-break-after:always; }
  .contents h2 { font-family:Newsreader,serif; font-size:22pt; font-weight:500; margin:0 0 8mm; }
  .contents ol { list-style:none; margin:0; padding:0; }
  .contents li { display:flex; justify-content:space-between; gap:6mm; border-bottom:1px solid var(--line); padding:3mm 0; }
  .contents .n { font-family:'IBM Plex Mono',monospace; font-size:8pt; color:var(--bright); min-width:8mm; }
  .contents .t { flex:1; }
  .contents .t b { display:block; font-weight:500; }
  .contents .t em { font-style:normal; color:var(--muted); font-size:9pt; }

  main { padding:18mm 22mm; }
  section { page-break-inside:avoid; margin-bottom:9mm; }
  h2 { font-family:Newsreader,serif; font-size:17pt; font-weight:500; line-height:1.2; margin:0 0 3mm; padding-top:4mm; border-top:1px solid var(--line); }
  .standfirst { font-family:Newsreader,serif; font-style:italic; font-size:11pt; color:var(--accent); margin:0 0 4mm; }
  p { margin:0 0 3mm; }
  ul { margin:3mm 0; padding-left:5mm; }
  li { margin-bottom:1.6mm; }
  li::marker { color:var(--bright); }
  .callout { background:var(--paper); border-left:3px solid var(--accent); padding:4mm 5mm; margin:4mm 0; page-break-inside:avoid; }
  .callout .t { font-family:'IBM Plex Mono',monospace; font-size:7.5pt; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin-bottom:1.5mm; }
  .callout p { margin:0; font-size:9.5pt; }

  .divider { page-break-before:always; padding-top:6mm; }
  .divider h3 { font-family:Newsreader,serif; font-size:24pt; font-weight:500; margin:0 0 3mm; }
  .divider .lead { color:var(--muted); font-size:10.5pt; max-width:140mm; margin-bottom:7mm; }
  .divider .bar { width:26mm; height:2px; background:var(--bright); margin-bottom:6mm; }

  .cmp { border:1px solid var(--line); border-left:3px solid var(--muted); padding:4mm 5mm; margin-bottom:4mm; page-break-inside:avoid; }
  .cmp.tier-licensed { border-left-color:#0E7C5A; }
  .cmp.tier-emerging { border-left-color:var(--amberish); }
  .cmp.tier-experimental { border-left-color:var(--danger); }
  .cmp header { display:flex; justify-content:space-between; align-items:flex-start; gap:5mm; margin-bottom:2.5mm; }
  .cmp h4 { font-family:Newsreader,serif; font-size:14pt; font-weight:500; margin:0; }
  .cmp .aka { font-size:8.5pt; color:var(--muted); margin-top:.6mm; }
  .cmp .tier { font-family:'IBM Plex Mono',monospace; font-size:6.8pt; letter-spacing:.1em; text-transform:uppercase;
               white-space:nowrap; padding:1mm 2.5mm; border:1px solid var(--line); color:var(--muted); }
  .tier-licensed .tier { color:#0E7C5A; border-color:#0E7C5A55; }
  .tier-emerging .tier { color:var(--amberish); border-color:#9A5B0055; }
  .tier-experimental .tier { color:var(--danger); border-color:#9B2C1E55; }
  .cmp dl { display:grid; grid-template-columns:22mm 1fr; gap:1.2mm 4mm; margin:0; font-size:9pt; }
  .cmp dt { font-family:'IBM Plex Mono',monospace; font-size:7pt; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); padding-top:.7mm; }
  .cmp dd { margin:0; }
  .cmp dt.risk { color:var(--danger); }
  .cmp dd.risk { color:var(--ink); }

  .end { margin-top:10mm; padding:8mm; background:linear-gradient(155deg,#0C2D4C,#157490); color:#fff; text-align:center; page-break-inside:avoid; }
  .end h3 { font-family:Newsreader,serif; font-size:17pt; font-weight:500; margin:0 0 2mm; }
  .end p { opacity:.85; font-size:10pt; margin:0 0 5mm; }
  .end .cta { display:inline-block; background:var(--bright); color:#0C2D4C; padding:3mm 8mm; font-weight:600; }
</style></head><body>

<div class="cover">
  <div class="eyebrow">Peptides MD · Medical Consultations</div>
  <h1>${esc(TITLE)}</h1>
  <div class="rule"></div>
  <div class="sub">${esc(SUBTITLE)}</div>
  <div class="stats">
    <div><span>Compounds covered</span><strong>${total}</strong></div>
    <div><span>Dosing protocols</span><strong>None</strong></div>
    <div><span>Products we sell</span><strong>None</strong></div>
  </div>
  <div class="foot">Written by a doctor with nothing to sell you</div>
</div>

<div class="contents">
  <h2>What is inside</h2>
  <ol>
    ${OPENING.map((s, i) => `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t"><b>${esc(s.heading)}</b></span></li>`).join('')}
    ${GROUPS.map((g, i) => `<li><span class="n">${String(OPENING.length + i + 1).padStart(2, '0')}</span><span class="t"><b>${esc(g.title)}</b><em>${g.compounds.map((c) => esc(c.name)).join(' · ')}</em></span></li>`).join('')}
    ${CLOSING.map((s, i) => `<li><span class="n">${String(OPENING.length + GROUPS.length + i + 1).padStart(2, '0')}</span><span class="t"><b>${esc(s.heading)}</b></span></li>`).join('')}
  </ol>
  <div class="callout" style="margin-top:8mm">
    <div class="t">A note on what is not here</div>
    <p>No doses, and no protocols. A dose that suits one person can be actively unsafe for another taking a GLP-1, an antidepressant, or with undiagnosed thyroid disease — and a printed guide cannot know which you are. Each compound instead gets what the evidence supports, its UK legal status, and the specific risk worth knowing.</p>
  </div>
</div>

<main>
${OPENING.map(section).join('')}

${GROUPS.map((g) => `<div class="divider">
  <h3>${esc(g.title)}</h3>
  <div class="bar"></div>
  <p class="lead">${esc(g.intro)}</p>
  ${g.compounds.map(compound).join('')}
</div>`).join('')}

<div style="page-break-before:always">
${CLOSING.map(section).join('')}
</div>

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
  margin: { top: 0, bottom: '13mm', left: 0, right: 0 },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate:
    '<div style="width:100%;font-family:monospace;font-size:7pt;color:#697D92;padding:0 22mm;display:flex;justify-content:space-between;"><span>Peptides MD — general information, not medical advice. No compound is supplied or prescribed.</span><span class="pageNumber"></span></div>',
});
await browser.close();
console.log(`  written: ${total} compounds across ${GROUPS.length} categories`);
