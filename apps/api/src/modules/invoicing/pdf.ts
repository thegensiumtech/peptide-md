/**
 * Invoice PDFs.
 *
 * Rendered with headless Chromium rather than a PDF library, which is the same
 * choice the lead-magnet guide makes. The reasoning is the same too: the
 * document is styled in the brand's own colour and type, and doing that in
 * HTML and CSS is honest work, whereas doing it through a drawing API is
 * arithmetic about text baselines.
 *
 * The scope names React PDF. This is a deliberate, agreed deviation: it avoids
 * a second way of making PDFs in one codebase and reuses a pipeline that
 * already produces brand-matched output.
 *
 * The browser is launched per render and closed afterwards. An invoice is
 * generated a handful of times a month, so a pooled browser would be a
 * long-lived process holding memory for something that almost never runs.
 */
import type { Browser } from 'playwright-core';
import { prisma } from '@peptide/database';
import { notFound } from '../../http/errors';
import { logger } from '../../logger';

/** Matches apps/web/src/app/globals.css. Restated because a PDF has no tokens. */
const BRAND = {
  ink: '#0C2D4C',
  inkSoft: '#294A66',
  muted: '#697D92',
  line: '#D8E3EA',
  accent: '#157490',
  paper: '#F5F8FA',
} as const;

const money = (minorUnits: number, currency: string): string =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minorUnits / 100);

const shortDate = (date: Date): string =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(date);

const longPeriod = (period: string): string =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${period}-01T00:00:00.000Z`)
  );

const escape = (value: string): string =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface InvoiceDocument {
  number: string;
  filename: string;
  pdf: Buffer;
}

/**
 * Builds the HTML for one invoice.
 *
 * Exported so a test can assert on the figures without launching a browser,
 * which is the slow and flaky part.
 */
export async function renderInvoiceHtml(invoiceId: string): Promise<{ html: string; number: string }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      partner: true,
      lines: {
        include: { booking: { include: { patient: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!invoice) throw notFound('That invoice could not be found.');

  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  const issuedOn = invoice.issuedAt ?? invoice.createdAt;

  const rows = invoice.lines
    .map((line) => {
      const when = shortDate(line.booking.startsAt);
      return `<tr>
        <td>${escape(when)}</td>
        <td class="mono">${escape(line.booking.reference)}</td>
        <td>${escape(line.booking.patient.name)}</td>
        <td class="right mono">${escape(money(line.amount, invoice.currency))}</td>
      </tr>`;
    })
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:wght@400;500&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 18mm 16mm;
    /* Real fallbacks: the render host may have no network for Google Fonts. */
    font-family: Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: ${BRAND.ink};
    font-size: 10pt;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
  }
  .mono { font-family: 'IBM Plex Mono', ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; }
  .right { text-align: right; }

  header { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { font-family: Newsreader, Georgia, serif; font-size: 20pt; letter-spacing: -0.01em; }
  .brand small { display: block; font-family: 'IBM Plex Mono', monospace; font-size: 7pt;
                 letter-spacing: 0.22em; text-transform: uppercase; color: ${BRAND.muted}; margin-top: 2mm; }
  .doc { text-align: right; }
  .doc h1 { font-family: Newsreader, Georgia, serif; font-weight: 400; font-size: 18pt; margin: 0; }
  .doc .number { font-family: 'IBM Plex Mono', monospace; font-size: 10pt; color: ${BRAND.accent}; margin-top: 1mm; }

  .rule { height: 2px; background: ${BRAND.accent}; margin: 8mm 0 7mm; }

  .parties { display: flex; gap: 14mm; margin-bottom: 9mm; }
  .parties section { flex: 1; }
  .label { font-family: 'IBM Plex Mono', monospace; font-size: 7pt; letter-spacing: 0.18em;
           text-transform: uppercase; color: ${BRAND.muted}; margin-bottom: 2mm; }
  .parties strong { display: block; font-size: 11pt; }
  .parties span { display: block; color: ${BRAND.inkSoft}; }

  .summary { display: flex; gap: 8mm; background: ${BRAND.paper}; border: 1px solid ${BRAND.line};
             border-radius: 4px; padding: 6mm 7mm; margin-bottom: 9mm; }
  .summary div { flex: 1; }
  .summary strong { display: block; font-family: Newsreader, Georgia, serif; font-size: 15pt; font-weight: 500; }

  table { width: 100%; border-collapse: collapse; }
  thead th { text-align: left; font-family: 'IBM Plex Mono', monospace; font-size: 7pt;
             letter-spacing: 0.16em; text-transform: uppercase; color: ${BRAND.muted};
             border-bottom: 1px solid ${BRAND.line}; padding: 0 0 3mm; }
  thead th.right { text-align: right; }
  tbody td { padding: 3mm 0; border-bottom: 1px solid ${BRAND.line}; vertical-align: top; }
  tbody tr:last-child td { border-bottom: 0; }

  .totals { margin-top: 6mm; margin-left: auto; width: 72mm; }
  .totals div { display: flex; justify-content: space-between; padding: 2.4mm 0; }
  .totals .grand { border-top: 2px solid ${BRAND.ink}; margin-top: 2mm; padding-top: 3mm;
                   font-family: Newsreader, Georgia, serif; font-size: 14pt; font-weight: 500; }

  footer { margin-top: 12mm; padding-top: 5mm; border-top: 1px solid ${BRAND.line};
           font-size: 8.5pt; color: ${BRAND.muted}; line-height: 1.65; }
</style></head><body>

<header>
  <div class="brand">Peptide MD<small>Medical consultations</small></div>
  <div class="doc">
    <h1>Invoice</h1>
    <div class="number mono">${escape(invoice.number)}</div>
  </div>
</header>

<div class="rule"></div>

<div class="parties">
  <section>
    <div class="label">Billed to</div>
    <strong>${escape(invoice.partner.name)}</strong>
    <span>${escape(invoice.partner.contactName)}</span>
    <span>${escape(invoice.partner.billingEmail)}</span>
  </section>
  <section>
    <div class="label">From</div>
    <strong>Peptide MD</strong>
    <span>${escape(settings?.emailFromAddress ?? 'appointments@peptidemd.co.uk')}</span>
    <span>peptidemd.co.uk</span>
  </section>
  <section>
    <div class="label">Dates</div>
    <span>Issued ${escape(shortDate(issuedOn))}</span>
    ${invoice.dueAt ? `<span>Due ${escape(shortDate(invoice.dueAt))}</span>` : ''}
    <span>Period ${escape(longPeriod(invoice.period))}</span>
  </section>
</div>

<div class="summary">
  <div><div class="label">Appointments</div><strong class="mono">${invoice.appointmentCount}</strong></div>
  <div><div class="label">Rate each</div><strong class="mono">${escape(money(invoice.ratePerAppointment, invoice.currency))}</strong></div>
  <div><div class="label">Total due</div><strong class="mono">${escape(money(invoice.totalAmount, invoice.currency))}</strong></div>
</div>

<div class="label">Appointments in this period</div>
<table>
  <thead><tr><th>Date</th><th>Reference</th><th>Patient</th><th class="right">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="totals">
  <div><span>${invoice.appointmentCount} appointments</span><span class="mono">${escape(money(invoice.totalAmount, invoice.currency))}</span></div>
  <div class="grand"><span>Total due</span><span class="mono">${escape(money(invoice.totalAmount, invoice.currency))}</span></div>
</div>

<footer>
  Consultations delivered by a GMC-registered doctor. Peptide MD does not supply,
  prescribe or dispense any compound.<br>
  Every appointment above was booked through ${escape(invoice.partner.name)} and is
  billed at the rate agreed with them. Queries to ${escape(settings?.emailFromAddress ?? 'appointments@peptidemd.co.uk')}.
</footer>

</body></html>`;

  return { html, number: invoice.number };
}

export async function renderInvoicePdf(invoiceId: string): Promise<InvoiceDocument> {
  const { html, number } = await renderInvoiceHtml(invoiceId);

  let browser: Browser | null = null;
  try {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();

    // 'load' rather than 'networkidle': the only network here is the font
    // stylesheet, and a host without outbound access would otherwise hang
    // until timeout before falling back to the system stack.
    await page.setContent(html, { waitUntil: 'load', timeout: 15_000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, bottom: '12mm', left: 0, right: 0 },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        `<div style="width:100%;font-family:monospace;font-size:7pt;color:${BRAND.muted};padding:0 16mm;display:flex;justify-content:space-between;"><span>${escape(
          number
        )}</span><span class="pageNumber"></span></div>`,
    });

    return { number, filename: `${number}.pdf`, pdf };
  } catch (error) {
    // The likeliest cause by far is a host with no Chromium binary. Say so,
    // because "browserType.launch failed" sends people looking in the wrong place.
    logger.error(
      { err: error instanceof Error ? error.message : error, invoiceId },
      'Invoice PDF render failed'
    );
    throw new Error(
      'Could not render the invoice PDF. If this is a fresh server, Chromium is probably missing: run "npx playwright install --with-deps chromium".'
    );
  } finally {
    await browser?.close().catch(() => {});
  }
}
