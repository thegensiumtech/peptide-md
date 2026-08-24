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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = readFileSync(resolve(root, 'apps/api/src/guides/peptide-guide.ts'), 'utf8');
const LOGO = `data:image/png;base64,${readFileSync(resolve(root, 'apps/web/public/brand/peptide-md-white.png')).toString('base64')}`;

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

const chain = (opacity, w) => `<svg width="${w}" viewBox="0 0 60 420" fill="none" style="opacity:${opacity}">
  <path d="M30 10 L44 60 L18 110 L44 160 L18 210 L44 260 L18 310 L44 360 L30 410" stroke="currentColor" stroke-width="1.4"/>
  ${[10,60,110,160,210,260,310,360,410].map((y,i)=>`<circle cx="${i%2===0?(y===10||y===410?30:18):44}" cy="${y}" r="${6-i*0.25}" fill="currentColor"/>`).join('')}
</svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,300;1,6..72,400&family=Inter:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root { --ink:#0C2D4C; --deep:#08203A; --accent:#157490; --bright:#33BBC1; --muted:#697D92;
          --line:#D8E3EA; --paper:#F7FAFB; --sand:#EEF3F6; --amberish:#9A5B00; --danger:#9B2C1E; --green:#0E7C5A; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:Inter,sans-serif; color:var(--ink); font-size:10.5pt; line-height:1.72;
         -webkit-font-smoothing:antialiased; }

  /* ---------- Cover ---------- */
  .cover { position:relative; height:100vh; padding:26mm 24mm; color:#fff; overflow:hidden;
           background:radial-gradient(120% 90% at 12% 8%, #17608A 0%, #0C2D4C 45%, #08203A 100%);
           page-break-after:always; display:flex; flex-direction:column; }
  .cover .motif { position:absolute; right:-14mm; top:-10mm; color:var(--bright); }
  .cover .motif2 { position:absolute; right:26mm; bottom:-30mm; color:#fff; }
  .cover .logo { width:52mm; opacity:.96; }
  .cover .kicker { margin-top:auto; font-family:'IBM Plex Mono',monospace; font-size:7.5pt;
                   letter-spacing:.3em; text-transform:uppercase; color:var(--bright); }
  .cover h1 { font-family:Newsreader,serif; font-weight:300; font-size:46pt; line-height:1.02;
              letter-spacing:-.02em; margin:8mm 0 0; max-width:140mm; }
  .cover h1 em { font-style:italic; color:var(--bright); }
  .cover .sub { margin-top:9mm; font-size:12pt; font-weight:300; line-height:1.65; max-width:118mm; color:#CFE0E8; }
  .cover .stats { display:flex; gap:16mm; margin-top:14mm; padding-top:7mm; border-top:1px solid rgba(255,255,255,.18); }
  .cover .stats span { display:block; font-family:'IBM Plex Mono',monospace; font-size:7pt;
                       letter-spacing:.18em; text-transform:uppercase; color:#8FB3C4; margin-bottom:1.5mm; }
  .cover .stats strong { font-family:Newsreader,serif; font-weight:400; font-size:19pt; }
  .cover .foot { margin-top:10mm; font-size:9pt; color:#8FB3C4; font-style:italic; font-family:Newsreader,serif; }

  /* ---------- Contents ---------- */
  .contents { padding:26mm 24mm; page-break-after:always; }
  .contents .eyebrow { font-family:'IBM Plex Mono',monospace; font-size:7.5pt; letter-spacing:.3em;
                       text-transform:uppercase; color:var(--accent); }
  .contents h2 { font-family:Newsreader,serif; font-weight:300; font-size:32pt; margin:5mm 0 10mm; letter-spacing:-.02em; }
  .contents ol { list-style:none; margin:0; padding:0; }
  .contents li { display:flex; gap:8mm; padding:3.6mm 0; border-bottom:1px solid var(--line); }
  .contents .n { font-family:'IBM Plex Mono',monospace; font-size:8pt; color:var(--bright); padding-top:.8mm; min-width:7mm; }
  .contents b { font-weight:500; font-size:11pt; display:block; }
  .contents em { font-style:normal; color:var(--muted); font-size:9pt; display:block; margin-top:.8mm; }

  /* ---------- Section openers ---------- */
  .opener { page-break-before:always; position:relative; height:78mm; margin:0 0 12mm;
            padding:20mm 24mm 0; background:linear-gradient(120deg,var(--deep),var(--accent)); color:#fff; overflow:hidden; }
  .opener .num { position:absolute; right:14mm; top:2mm; font-family:Newsreader,serif; font-weight:300;
                 font-size:76pt; color:rgba(255,255,255,.13); }
  .opener h3 { font-family:Newsreader,serif; font-weight:300; font-size:28pt; margin:0; letter-spacing:-.02em; }
  .opener .lead { margin-top:5mm; font-size:10.5pt; font-weight:300; line-height:1.65; max-width:132mm; color:#CFE0E8; }

  /* ---------- Body ---------- */
  main { padding:0 24mm 18mm; }
  section { page-break-inside:avoid; margin-bottom:11mm; }
  h2 { font-family:Newsreader,serif; font-weight:400; font-size:19pt; line-height:1.2; letter-spacing:-.015em;
       margin:0 0 4mm; padding-top:5mm; }
  h2::before { content:''; display:block; width:14mm; height:2px; background:var(--bright); margin-bottom:4mm; }
  .standfirst { font-family:Newsreader,serif; font-style:italic; font-weight:300; font-size:12.5pt;
                line-height:1.55; color:var(--accent); margin:0 0 5mm; }
  p { margin:0 0 3.6mm; }
  section:first-of-type > p:first-of-type::first-letter {
    float:left; font-family:Newsreader,serif; font-size:34pt; line-height:.82; font-weight:400;
    padding:1mm 2.4mm 0 0; color:var(--accent);
  }
  ul { margin:4mm 0; padding:0; list-style:none; }
  ul li { position:relative; padding-left:6mm; margin-bottom:2.2mm; }
  ul li::before { content:''; position:absolute; left:0; top:2.4mm; width:2.4mm; height:2.4mm;
                  border-radius:50%; background:var(--bright); }
  .callout { position:relative; background:var(--sand); padding:6mm 7mm; margin:6mm 0; page-break-inside:avoid; }
  .callout::before { content:''; position:absolute; left:0; top:0; bottom:0; width:2px; background:var(--accent); }
  .callout .t { font-family:'IBM Plex Mono',monospace; font-size:7pt; letter-spacing:.2em;
                text-transform:uppercase; color:var(--accent); margin-bottom:2.5mm; }
  .callout p { margin:0; font-size:10pt; font-style:italic; font-family:Newsreader,serif; font-size:11.5pt; line-height:1.6; }

  /* ---------- Compound entries ---------- */
  .cmp { padding:5mm 0 5mm 7mm; border-top:1px solid var(--line); position:relative; page-break-inside:avoid; }
  .cmp::before { content:''; position:absolute; left:0; top:5mm; bottom:5mm; width:2px; background:var(--muted); }
  .cmp.tier-licensed::before { background:var(--green); }
  .cmp.tier-emerging::before { background:var(--amberish); }
  .cmp.tier-experimental::before { background:var(--danger); }
  .cmp header { display:flex; justify-content:space-between; align-items:baseline; gap:6mm; margin-bottom:3mm; }
  .cmp h4 { font-family:Newsreader,serif; font-weight:400; font-size:15pt; margin:0; letter-spacing:-.01em; }
  .cmp .aka { font-size:8.5pt; color:var(--muted); font-style:italic; font-family:Newsreader,serif; }
  .cmp .tier { font-family:'IBM Plex Mono',monospace; font-size:6.5pt; letter-spacing:.16em;
               text-transform:uppercase; white-space:nowrap; color:var(--muted); }
  .tier-licensed .tier { color:var(--green); }
  .tier-emerging .tier { color:var(--amberish); }
  .tier-experimental .tier { color:var(--danger); }
  .cmp dl { display:grid; grid-template-columns:20mm 1fr; gap:2mm 5mm; margin:0; font-size:9.5pt; }
  .cmp dt { font-family:'IBM Plex Mono',monospace; font-size:6.5pt; letter-spacing:.14em;
            text-transform:uppercase; color:var(--muted); padding-top:1.1mm; }
  .cmp dd { margin:0; line-height:1.6; }

  /* ---------- Closing ---------- */
  .end { page-break-before:always; position:relative; height:calc(100vh - 13mm); overflow:hidden;
         background:radial-gradient(120% 90% at 88% 12%, #17608A 0%, #0C2D4C 48%, #08203A 100%);
         color:#fff; padding:30mm 24mm; display:flex; flex-direction:column; }
  .end .motif { position:absolute; left:-16mm; bottom:-20mm; color:var(--bright); }
  .end .logo { width:46mm; opacity:.95; }
  .end h3 { font-family:Newsreader,serif; font-weight:300; font-size:32pt; line-height:1.12;
            margin:14mm 0 0; max-width:130mm; letter-spacing:-.02em; }
  .end h3 em { font-style:italic; color:var(--bright); }
  .end .price { margin-top:9mm; padding-top:7mm; border-top:1px solid rgba(255,255,255,.18);
                display:flex; gap:14mm; }
  .end .price span { display:block; font-family:'IBM Plex Mono',monospace; font-size:7pt;
                     letter-spacing:.18em; text-transform:uppercase; color:#8FB3C4; margin-bottom:1.5mm; }
  .end .price strong { font-family:Newsreader,serif; font-weight:400; font-size:18pt; }
  .end .cta { margin-top:auto; }
  .end .cta a { display:inline-block; background:var(--bright); color:var(--deep); padding:4mm 12mm;
                font-weight:600; letter-spacing:.02em; text-decoration:none; font-size:11pt; }
  .end .small { margin-top:6mm; font-size:8.5pt; color:#8FB3C4; line-height:1.6; max-width:120mm; }
</style></head><body>

<div class="cover">
  <div class="motif">${chain(0.22, '46mm')}</div>
  <div class="motif2">${chain(0.06, '30mm')}</div>
  <img class="logo" src="${LOGO}" alt="Peptide MD" />
  <div class="kicker">The honest briefing</div>
  <h1>${esc(TITLE).replace('honest', '<em>honest</em>')}</h1>
  <div class="sub">${esc(SUBTITLE)}</div>
  <div class="stats">
    <div><span>Compounds assessed</span><strong>${total}</strong></div>
    <div><span>Dosing protocols</span><strong>None</strong></div>
    <div><span>Products we sell</span><strong>None</strong></div>
  </div>
  <div class="foot">Written by a doctor with nothing to sell you.</div>
</div>

<div class="contents">
  <div class="eyebrow">Contents</div>
  <h2>What is inside</h2>
  <ol>
    ${OPENING.map((s, i) => `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><span><b>${esc(s.heading)}</b></span></li>`).join('')}
    ${GROUPS.map((g, i) => `<li><span class="n">${String(OPENING.length + i + 1).padStart(2, '0')}</span><span><b>${esc(g.title)}</b><em>${g.compounds.map((c) => esc(c.name)).join(' · ')}</em></span></li>`).join('')}
    ${CLOSING.map((s, i) => `<li><span class="n">${String(OPENING.length + GROUPS.length + i + 1).padStart(2, '0')}</span><span><b>${esc(s.heading)}</b></span></li>`).join('')}
  </ol>
  <div class="callout" style="margin-top:12mm">
    <div class="t">A note on what is not here</div>
    <p>No doses, and no protocols. A dose that suits one person can be unsafe for another taking a GLP-1, an antidepressant, or with undiagnosed thyroid disease, and a printed guide cannot know which the reader is.</p>
  </div>
</div>

<main>
${OPENING.map(section).join('')}
</main>

${GROUPS.map((g, i) => `<div class="opener">
  <div class="num">${String(i + 1).padStart(2, '0')}</div>
  <h3>${esc(g.title)}</h3>
  <p class="lead">${esc(g.intro)}</p>
</div>
<main style="padding-top:0">${g.compounds.map(compound).join('')}</main>`).join('')}

<main style="page-break-before:always; padding-top:18mm">
${CLOSING.map(section).join('')}
</main>

<div class="end">
  <div class="motif">${chain(0.16, '40mm')}</div>
  <img class="logo" src="${LOGO}" alt="Peptide MD" />
  <h3>Twenty minutes with a doctor who has <em>nothing to sell you</em>.</h3>
  <div class="price">
    <div><span>Consultation</span><strong>&pound;95</strong></div>
    <div><span>Length</span><strong>20 minutes</strong></div>
    <div><span>Registration</span><strong>GMC</strong></div>
  </div>
  <div class="cta">
    <a href="https://peptidemd.co.uk">Book a consultation</a>
    <p class="small">No products, no suppliers, no affiliates. If the honest answer is that you should not be taking anything, that is the answer you get.</p>
  </div>
</div>
</body></html>`;

const out = resolve(root, 'apps/web/public/guides');
mkdirSync(out, { recursive: true });

const pdfPath = resolve(out, 'peptide-md-guide.pdf');

const browser = await chromium.launch();

// A4 at 96dpi, so the cover screenshot below is framed exactly as it prints.
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: 0, bottom: '13mm', left: 0, right: 0 },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate:
    '<div style="width:100%;font-family:monospace;font-size:7pt;color:#697D92;padding:0 22mm;display:flex;justify-content:space-between;"><span>Peptide MD, general information, not medical advice. No compound is supplied or prescribed.</span><span class="pageNumber"></span></div>',
});

// The landing page shows the real cover rather than a mockup, so the two can
// never drift apart.
await page.locator('.cover').screenshot({ path: resolve(out, 'peptide-md-guide-cover.png') });
await browser.close();

// Page count is read back out of the PDF we just wrote. Every earlier version
// of this claim was a hand-typed number in the marketing copy, and it went
// stale the first time the guide grew.
const pages = (readFileSync(pdfPath).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

writeFileSync(
  resolve(root, 'packages/shared/src/guide.ts'),
  `/**
 * Generated by scripts/build-guide.mjs. Do not edit by hand.
 *
 * These numbers are read back out of the rendered PDF, so the marketing copy
 * and the file a lead actually receives cannot disagree.
 */
export const GUIDE = {
  pages: ${pages},
  compounds: ${total},
  categories: ${GROUPS.length},
} as const;

export const GUIDE_PDF_PATH = '/guides/peptide-md-guide.pdf';
export const GUIDE_COVER_PATH = '/guides/peptide-md-guide-cover.png';
`
);

console.log(`  written: ${total} compounds across ${GROUPS.length} categories, ${pages} pages`);
