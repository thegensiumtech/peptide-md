/**
 * Invoicing accuracy.
 *
 * This is the only part of the platform that tells a partner what to pay, and
 * a wrong invoice is not a bug you get to fix quietly: it is a conversation
 * about whether the numbers can be trusted at all. So the checks here are
 * about arithmetic and about history holding still, not about endpoints
 * returning 200.
 *
 * Five things carry real risk:
 *
 *  - **Double billing.** Generation runs on a schedule and can be re-run by
 *    hand after a failure. A second run must not add a second invoice or a
 *    second line.
 *  - **History moving.** An invoice captures the rate at generation. Changing a
 *    partner's rate afterwards must not restate an invoice already raised,
 *    otherwise an old invoice is worthless as a record.
 *  - **Counting the wrong things.** Cancelled appointments, sandbox bookings
 *    and other months must not appear on a partner's bill.
 *  - **Period boundaries.** The portal used to count with no upper bound, so a
 *    booking months out was billed this month.
 *  - **Tenant separation.** A partner must not be able to fetch another
 *    partner's invoice PDF by id.
 *
 *   node scripts/verify-invoicing.mjs
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(import.meta.dirname, '../.env.local') });

const API = process.env.API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();
const results = [];

const pass = (n, d = '') => { results.push(true); console.log(`  ✓ ${n}${d ? `, ${d}` : ''}`); };
const fail = (n, d = '') => { results.push(false); console.log(`  ✗ ${n}${d ? `, ${d}` : ''}`); };

async function login(email = 'ross@peptidemd.co.uk') {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'peptide-dev-2026' }),
  });
  const body = await res.json();
  return body?.data?.accessToken ?? null;
}

const token = await login();
const auth = { Authorization: `Bearer ${token}` };

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...auth, ...options.headers },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// --- A period of our own, so nothing here touches the seeded months ---------

// Far enough back that no seeded booking or invoice can land in it.
const PERIOD = '2019-04';
const periodStart = new Date(`${PERIOD}-01T10:00:00.000Z`);

const partner = await prisma.partner.findUnique({ where: { slug: 'five-peptides' } });
const otherPartner = await prisma.partner.findUnique({ where: { slug: 'new-you-peptides' } });
const doctor = await prisma.doctor.findFirst({ where: { isActive: true } });
const sandboxDoctor = await prisma.doctor.findFirst({ where: { gmcNumber: 'SANDBOX' } });

async function cleanFixtures() {
  await prisma.invoiceLine.deleteMany({ where: { invoice: { period: PERIOD } } });
  await prisma.invoice.deleteMany({ where: { period: PERIOD } });
  await prisma.booking.deleteMany({ where: { patient: { email: { startsWith: 'invoicing+' } } } });
  await prisma.patient.deleteMany({ where: { email: { startsWith: 'invoicing+' } } });
}

await cleanFixtures();

async function makeBooking({ hour, status = 'CONFIRMED', isSandbox = false, partnerId = partner.id, tag }) {
  const patient = await prisma.patient.upsert({
    where: { email: `invoicing+${tag}@peptidemd.test` },
    update: {},
    create: {
      email: `invoicing+${tag}@peptidemd.test`,
      name: `Invoicing ${tag}`,
      phone: '+44 7700 900000',
      timezone: 'Europe/London',
    },
  });

  const startsAt = new Date(periodStart);
  startsAt.setUTCDate(2);
  startsAt.setUTCHours(hour, 0, 0, 0);

  return prisma.booking.create({
    data: {
      reference: `PMD-INV-${tag}`,
      doctorId: isSandbox ? sandboxDoctor.id : doctor.id,
      patientId: patient.id,
      channel: 'PARTNER',
      partnerId,
      isSandbox,
      status,
      paymentStatus: 'PAID',
      amountPaid: null,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 20 * 60_000),
      patientTimezone: 'Europe/London',
    },
  });
}

// Three that should be billed, and three that should not.
await makeBooking({ hour: 9, tag: 'a' });
await makeBooking({ hour: 10, tag: 'b' });
await makeBooking({ hour: 11, tag: 'c' });
await makeBooking({ hour: 12, tag: 'cancelled', status: 'CANCELLED' });
await makeBooking({ hour: 13, tag: 'sandbox', isSandbox: true });
await makeBooking({ hour: 14, tag: 'other', partnerId: otherPartner.id });

// One in the following month, which is the bug the portal used to have.
{
  const patient = await prisma.patient.upsert({
    where: { email: 'invoicing+nextmonth@peptidemd.test' },
    update: {},
    create: {
      email: 'invoicing+nextmonth@peptidemd.test',
      name: 'Invoicing NextMonth',
      phone: '+44 7700 900000',
      timezone: 'Europe/London',
    },
  });
  const startsAt = new Date('2019-05-02T09:00:00.000Z');
  await prisma.booking.create({
    data: {
      reference: 'PMD-INV-next',
      doctorId: doctor.id,
      patientId: patient.id,
      channel: 'PARTNER',
      partnerId: partner.id,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 20 * 60_000),
      patientTimezone: 'Europe/London',
    },
  });
}

const rateAtGeneration = partner.ratePerAppointment;

// --- Generation --------------------------------------------------------------

{
  const { status, body } = await api('/api/admin/invoices/generate', {
    method: 'POST',
    body: JSON.stringify({ period: PERIOD }),
  });
  status === 200 && body?.data?.created >= 1
    ? pass('Generation raises invoices for the period', `${body.data.created} created`)
    : fail('Generation raises invoices', `${status} ${JSON.stringify(body).slice(0, 140)}`);
}

const invoice = await prisma.invoice.findUnique({
  where: { partnerId_period: { partnerId: partner.id, period: PERIOD } },
  include: { lines: true },
});

{
  invoice?.appointmentCount === 3
    ? pass('Counts only billable appointments', '3 of 7 bookings')
    : fail('Counts only billable appointments', `counted ${invoice?.appointmentCount}, expected 3`);
}

{
  const expected = 3 * rateAtGeneration;
  invoice?.totalAmount === expected
    ? pass('Total is count times rate', `${invoice.totalAmount} minor units`)
    : fail('Total arithmetic', `${invoice?.totalAmount}, expected ${expected}`);
}

{
  invoice?.lines.length === 3
    ? pass('One line per appointment')
    : fail('One line per appointment', `${invoice?.lines.length} lines`);
}

{
  const refs = await prisma.booking.findMany({
    where: { id: { in: invoice.lines.map((l) => l.bookingId) } },
    select: { reference: true, status: true, isSandbox: true, partnerId: true },
  });

  const noCancelled = refs.every((b) => b.status !== 'CANCELLED');
  const noSandbox = refs.every((b) => !b.isSandbox);
  const rightPartner = refs.every((b) => b.partnerId === partner.id);

  noCancelled && noSandbox && rightPartner
    ? pass('Cancelled, sandbox and other partners are all excluded')
    : fail('Exclusions', `cancelled=${!noCancelled} sandbox=${!noSandbox} wrongPartner=${!rightPartner}`);
}

{
  const billedNextMonth = await prisma.invoiceLine.count({
    where: { invoiceId: invoice.id, booking: { reference: 'PMD-INV-next' } },
  });
  billedNextMonth === 0
    ? pass('A booking in the following month is not billed to this one', 'period has an upper bound')
    : fail('Period upper bound', 'next month leaked into this invoice');
}

// --- Idempotency -------------------------------------------------------------

{
  const before = await prisma.invoice.count({ where: { period: PERIOD } });
  const beforeLines = await prisma.invoiceLine.count({ where: { invoiceId: invoice.id } });

  await api('/api/admin/invoices/generate', {
    method: 'POST',
    body: JSON.stringify({ period: PERIOD }),
  });

  const after = await prisma.invoice.count({ where: { period: PERIOD } });
  const afterLines = await prisma.invoiceLine.count({ where: { invoiceId: invoice.id } });

  before === after && beforeLines === afterLines
    ? pass('Re-running generation bills nothing twice', `${after} invoices, ${afterLines} lines`)
    : fail('Idempotent generation', `invoices ${before}->${after}, lines ${beforeLines}->${afterLines}`);
}

// --- A draft follows reality until it is sent -------------------------------

{
  await makeBooking({ hour: 15, tag: 'late' });
  await api(`/api/admin/invoices/${invoice.id}/refresh`, { method: 'POST' });

  const refreshed = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  refreshed?.appointmentCount === 4 && refreshed?.totalAmount === 4 * rateAtGeneration
    ? pass('A late booking is picked up while the invoice is still a draft', '4 appointments')
    : fail('Draft refresh', `count ${refreshed?.appointmentCount}, total ${refreshed?.totalAmount}`);
}

{
  await prisma.booking.update({
    where: { reference: 'PMD-INV-late' },
    data: { status: 'CANCELLED' },
  });
  await api(`/api/admin/invoices/${invoice.id}/refresh`, { method: 'POST' });

  const refreshed = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  refreshed?.appointmentCount === 3
    ? pass('A cancellation drops off the draft', 'back to 3')
    : fail('Cancellation on a draft', `count ${refreshed?.appointmentCount}`);
}

// --- History does not move ---------------------------------------------------

{
  // The rate changes. An invoice already raised must not move with it, or an
  // old invoice stops being evidence of anything.
  await prisma.partner.update({
    where: { id: partner.id },
    data: { ratePerAppointment: rateAtGeneration + 1500 },
  });

  await api(`/api/admin/invoices/${invoice.id}/refresh`, { method: 'POST' });
  const after = await prisma.invoice.findUnique({
    where: { id: invoice.id },
    include: { lines: true },
  });

  const rateHeld = after?.ratePerAppointment === rateAtGeneration;
  const totalHeld = after?.totalAmount === 3 * rateAtGeneration;
  const linesHeld = after?.lines.every((line) => line.amount === rateAtGeneration);

  await prisma.partner.update({
    where: { id: partner.id },
    data: { ratePerAppointment: rateAtGeneration },
  });

  rateHeld && totalHeld && linesHeld
    ? pass('Changing the rate does not restate an invoice already raised')
    : fail('Captured rate', `rate=${after?.ratePerAppointment} total=${after?.totalAmount}`);
}

// --- The document ------------------------------------------------------------

{
  const res = await fetch(`${API}/api/admin/invoices/${invoice.id}/pdf`, { headers: auth });
  const buffer = Buffer.from(await res.arrayBuffer());
  const isPdf = buffer.subarray(0, 5).toString() === '%PDF-';

  res.status === 200 && isPdf && buffer.length > 5000
    ? pass('The PDF renders', `${buffer.length} bytes`)
    : fail('PDF render', `${res.status}, ${buffer.length} bytes, header ${buffer.subarray(0, 5)}`);
}

// --- Send is the only thing that fixes the figures ---------------------------

{
  const { status } = await api(`/api/admin/invoices/${invoice.id}/send`, { method: 'POST' });
  const sent = await prisma.invoice.findUnique({ where: { id: invoice.id } });

  status === 200 && sent?.status === 'SENT' && sent?.sentAt
    ? pass('Sending issues the invoice', `due ${sent.dueAt?.toISOString().slice(0, 10)}`)
    : fail('Send', `${status}, status ${sent?.status}`);
}

{
  // Once sent, generation must leave it alone. Restating an invoice a partner
  // already holds is how a dispute starts.
  await makeBooking({ hour: 16, tag: 'aftersend' });
  await api('/api/admin/invoices/generate', {
    method: 'POST',
    body: JSON.stringify({ period: PERIOD }),
  });

  const after = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  after?.appointmentCount === 3
    ? pass('A sent invoice is never restated by a later run')
    : fail('Sent invoice restated', `count moved to ${after?.appointmentCount}`);
}

// --- Tenant separation on the document ---------------------------------------

{
  const partnerToken = await login('dana@newyoupeptides.com.au');
  const res = await fetch(`${API}/api/partner/invoices/${invoice.id}/pdf`, {
    headers: { Authorization: `Bearer ${partnerToken}` },
  });

  res.status === 404
    ? pass("A partner cannot download another partner's invoice", '404, not a file')
    : fail('Cross-partner invoice PDF', `${res.status}`);
}

// --- Void keeps the number ---------------------------------------------------

{
  const { status } = await api(`/api/admin/invoices/${invoice.id}/void`, { method: 'POST' });
  const voided = await prisma.invoice.findUnique({ where: { id: invoice.id } });

  status === 200 && voided?.status === 'VOID' && voided?.number
    ? pass('Voiding keeps the invoice and its number', voided.number)
    : fail('Void', `${status}, status ${voided?.status}`);
}

// --- Cleanup -----------------------------------------------------------------

await cleanFixtures();
await prisma.booking.deleteMany({ where: { reference: { startsWith: 'PMD-INV-' } } });
await prisma.$disconnect();

const failed = results.filter((r) => !r).length;
console.log(`\n${'='.repeat(60)}`);
console.log(`${results.length - failed} passed, ${failed} failed`);
if (failed === 0) console.log('\nThe figures are right and an invoice already raised does not move.');
process.exit(failed > 0 ? 1 : 0);
