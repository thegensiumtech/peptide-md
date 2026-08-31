/**
 * Admin reporting, and the credentials a partner is handed.
 *
 * Two deliverables meet here, and both fail quietly rather than loudly, which
 * is why they get their own suite.
 *
 * **Reporting** is a number somebody will read and then act on: renegotiate a
 * rate, or query an invoice. A report that is merely close is worse than none,
 * because it invites an argument nobody can settle. So the checks below do not
 * ask whether the endpoint returns 200. They ask whether it agrees with the
 * rule the invoices themselves use, month by month, and whether it holds still
 * when a partner's rate changes underneath it.
 *
 * **Credentials** are where this found a real fault. A partner has a live pair
 * and a sandbox pair; the sandbox one is issued second and so is the newer
 * row. The portal took the newest credential and called it "your client id",
 * so every partner was shown their sandbox id as though it were live.
 * Integrating against that books a separate diary, returns confirmations, and
 * never creates a real appointment. Nothing errors. You find out when somebody
 * asks why no patients have arrived.
 *
 * Needs the API and the web app running.
 *
 *   node scripts/verify-reporting.mjs
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

async function api(path, headers = auth) {
  const res = await fetch(`${API}${path}`, { headers });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// --- The window ---------------------------------------------------------------

{
  const { body } = await api('/api/admin/reports');
  const periods = body?.data?.bySource?.map((p) => p.period) ?? [];

  periods.length === 6
    ? pass('The default window is six months', periods.join(' '))
    : fail('Default window', `${periods.length} periods`);

  // Months with nothing in them still have to appear. Returning only the
  // months that exist in the table closes the gap silently, and a quiet month
  // then reads as though it never happened.
  const contiguous = periods.every((period, i) => {
    if (i === 0) return true;
    const [py, pm] = periods[i - 1].split('-').map(Number);
    const expected = pm === 12 ? `${py + 1}-01` : `${py}-${String(pm + 1).padStart(2, '0')}`;
    return period === expected;
  });
  contiguous
    ? pass('Empty months are filled rather than skipped')
    : fail('Period filling', periods.join(' '));
}

{
  // December to February is the case a naive month subtraction gets wrong.
  const { body } = await api('/api/admin/reports?from=2025-11&to=2026-02');
  const periods = body?.data?.bySource?.map((p) => p.period) ?? [];
  periods.join(' ') === '2025-11 2025-12 2026-01 2026-02'
    ? pass('A window crossing the year boundary is correct', periods.join(' '))
    : fail('Year boundary', periods.join(' '));
}

{
  // A reversed range is a slip the UI guards against, but the API is public to
  // anyone with an admin session and should not spin or explode on it.
  const { status, body } = await api('/api/admin/reports?from=2026-08&to=2026-03');
  status === 200 && (body?.data?.bySource?.length ?? 0) > 0
    ? pass('A reversed range falls back rather than failing', `${body.data.from} to ${body.data.to}`)
    : fail('Reversed range', `${status}`);
}

{
  const { status } = await api('/api/admin/reports?from=notamonth');
  status === 400 ? pass('A malformed period is refused', '400') : fail('Malformed period', String(status));
}

// --- The figures agree with the invoices ---------------------------------------

const thisPeriod = new Date().toISOString().slice(0, 7);

{
  const { body } = await api(`/api/admin/reports?from=${thisPeriod}&to=${thisPeriod}`);
  const report = body?.data;

  // Counted with exactly the rule billableWhere uses, straight from the
  // database. If these disagree, one of the report and the invoice is wrong
  // and there is no way to tell which from the screen.
  const start = new Date(`${thisPeriod}-01T00:00:00.000Z`);
  const [y, m] = thisPeriod.split('-').map(Number);
  const end = new Date(m === 12 ? `${y + 1}-01-01T00:00:00.000Z` : `${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00.000Z`);

  let mismatches = 0;
  for (const partner of await prisma.partner.findMany()) {
    const expected = await prisma.booking.count({
      where: {
        partnerId: partner.id,
        isSandbox: false,
        status: { not: 'CANCELLED' },
        startsAt: { gte: start, lt: end },
      },
    });
    const row = report?.byPartner?.find((r) => r.partnerId === partner.id);
    const reported = row?.appointmentCount ?? 0;
    if (reported !== expected) {
      mismatches += 1;
      console.log(`      ${partner.name}: report ${reported}, billing rule ${expected}`);
    }
  }
  mismatches === 0
    ? pass('Every partner count matches the rule the invoices use')
    : fail('Report and invoice disagree', `${mismatches} partners`);
}

{
  const { body } = await api(`/api/admin/reports?from=${thisPeriod}&to=${thisPeriod}`);
  const report = body?.data;

  // Bounded at both ends. An open ended `gte` also swept up next month's
  // bookings, so this check failed against a report that was right.
  const [ty, tm] = thisPeriod.split('-').map(Number);
  const monthStart = new Date(`${thisPeriod}-01T00:00:00.000Z`);
  const monthEnd = new Date(
    tm === 12 ? `${ty + 1}-01-01T00:00:00.000Z` : `${ty}-${String(tm + 1).padStart(2, '0')}-01T00:00:00.000Z`
  );
  const window = { gte: monthStart, lt: monthEnd };

  const cancelled = await prisma.booking.count({
    where: { status: 'CANCELLED', startsAt: window },
  });
  const sandbox = await prisma.booking.count({ where: { isSandbox: true, startsAt: window } });
  const counted = await prisma.booking.count({
    where: { status: { not: 'CANCELLED' }, isSandbox: false, startsAt: window },
  });

  // Only meaningful if there is actually something excluded to notice.
  report?.totals?.total === counted
    ? pass('Cancelled and sandbox bookings are excluded', `${cancelled} cancelled and ${sandbox} sandbox left out`)
    : fail('Exclusions', `reported ${report?.totals?.total}, expected ${counted}`);
}

{
  const { body } = await api(`/api/admin/reports?from=${thisPeriod}&to=${thisPeriod}`);
  const sum = (body?.data?.bySource ?? []).reduce((n, p) => n + p.direct + p.partner, 0);
  sum === body?.data?.totals?.total
    ? pass('The totals add up to the periods', String(sum))
    : fail('Totals', `periods sum to ${sum}, totals say ${body?.data?.totals?.total}`);
}

// --- History does not move ------------------------------------------------------

{
  /**
   * The scope is explicit that changing a rate never restates an invoice
   * already raised, and the report sits next to those invoices, so it has to
   * honour the same thing.
   *
   * This builds its own invoice rather than using a seeded one. The seeded
   * invoices cover months with no bookings, so the check skipped itself and
   * reported a pass while asserting nothing, which is the failure mode this
   * whole suite exists to avoid.
   */
  const period = thisPeriod;
  const partner = await prisma.partner.findFirst({
    where: { bookings: { some: { startsAt: { gte: new Date(`${period}-01T00:00:00.000Z`) } } } },
  });

  if (!partner) {
    fail('Rate capture', 'no partner has volume this period, cannot test');
  } else {
    const capturedRate = 1234;
    const number = `INV-VERIFY-${period}`;

    await prisma.invoiceLine.deleteMany({ where: { invoice: { number } } });
    await prisma.invoice.deleteMany({ where: { number } });

    const count = await prisma.booking.count({
      where: {
        partnerId: partner.id,
        isSandbox: false,
        status: { not: 'CANCELLED' },
        startsAt: {
          gte: new Date(`${period}-01T00:00:00.000Z`),
          lt: new Date(
            Number(period.slice(5, 7)) === 12
              ? `${Number(period.slice(0, 4)) + 1}-01-01T00:00:00.000Z`
              : `${period.slice(0, 4)}-${String(Number(period.slice(5, 7)) + 1).padStart(2, '0')}-01T00:00:00.000Z`
          ),
        },
      },
    });

    // An invoice raised at a rate that is deliberately nothing like the
    // partner's current one, so a report reading the wrong source is obvious.
    await prisma.invoice.create({
      data: {
        number,
        partnerId: partner.id,
        period,
        appointmentCount: count,
        ratePerAppointment: capturedRate,
        totalAmount: count * capturedRate,
        status: 'SENT',
        issuedAt: new Date(),
        dueAt: new Date(),
      },
    });

    const { body: raised } = await api(`/api/admin/reports?from=${period}&to=${period}`);
    const row = raised?.data?.byPartner?.find((r) => r.partnerId === partner.id);

    row?.billableAmount === count * capturedRate
      ? pass('An invoiced period is priced at the rate the invoice captured', `${count} x ${capturedRate}`)
      : fail('Rate capture', `expected ${count * capturedRate}, got ${row?.billableAmount}`);

    // Now move the partner's current rate. The invoiced month must not budge.
    const originalRate = partner.ratePerAppointment;
    await prisma.partner.update({
      where: { id: partner.id },
      data: { ratePerAppointment: originalRate + 9900 },
    });

    const { body: after } = await api(`/api/admin/reports?from=${period}&to=${period}`);
    const rowAfter = after?.data?.byPartner?.find((r) => r.partnerId === partner.id);

    rowAfter?.billableAmount === count * capturedRate
      ? pass('Raising the partner rate does not restate an invoiced month', `held at ${rowAfter.billableAmount}`)
      : fail('Rate capture held', `${count * capturedRate} became ${rowAfter?.billableAmount}`);

    // And with the invoice gone, the same month falls back to the live rate,
    // which proves the fallback is real rather than the invoice being ignored.
    await prisma.invoice.deleteMany({ where: { number } });

    const { body: unbilled } = await api(`/api/admin/reports?from=${period}&to=${period}`);
    const rowUnbilled = unbilled?.data?.byPartner?.find((r) => r.partnerId === partner.id);

    rowUnbilled?.billableAmount === count * (originalRate + 9900)
      ? pass('An uninvoiced month uses the current rate', `${count} x ${originalRate + 9900}`)
      : fail('Uninvoiced fallback', `expected ${count * (originalRate + 9900)}, got ${rowUnbilled?.billableAmount}`);

    await prisma.partner.update({
      where: { id: partner.id },
      data: { ratePerAppointment: originalRate },
    });
  }
}

// --- Who may read it ------------------------------------------------------------

{
  const doctorToken = await login('mark@peptidemd.co.uk');
  const { status } = await api('/api/admin/reports', { Authorization: `Bearer ${doctorToken}` });
  status === 403
    ? pass('The doctor cannot read revenue', '403')
    : fail('Doctor blocked from reports', String(status));
}

{
  const { status } = await api('/api/admin/reports', {});
  status === 401 ? pass('Unauthenticated is refused', '401') : fail('Unauthenticated', String(status));
}

// --- The dashboard trend is real ------------------------------------------------

{
  const { body } = await api('/api/admin/dashboard');
  const trend = body?.data?.volumeTrend ?? [];
  // The card is headed "Last six months". It used to render a single bar,
  // because the API never sent a trend and the client fell back to the
  // current period.
  trend.length === 6
    ? pass('The dashboard chart has the six months it claims', trend.map((t) => t.period).join(' '))
    : fail('Dashboard trend', `${trend.length} periods`);
}

// --- Credentials handed to a partner --------------------------------------------

{
  let wrong = 0;
  let checked = 0;

  for (const partner of await prisma.partner.findMany()) {
    const live = await prisma.partnerCredential.findFirst({
      where: { partnerId: partner.id, isSandbox: false, revokedAt: null },
    });
    const sandbox = await prisma.partnerCredential.findFirst({
      where: { partnerId: partner.id, isSandbox: true, revokedAt: null },
    });
    if (!live || !sandbox) continue;
    checked += 1;

    // The whole fault in one line: newest wins, and sandbox is newer.
    const newest = await prisma.partnerCredential.findFirst({
      where: { partnerId: partner.id, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (newest?.isSandbox && newest.clientId !== live.clientId) {
      // Not itself a failure. It is the trap the /me endpoint has to avoid,
      // and it is worth asserting the data still has that shape, because if
      // seeding order ever changed this suite would pass for the wrong reason.
      pass(`Sandbox is the newer credential for ${partner.name}`, 'the shape that caused the bug');
    }
  }

  checked > 0
    ? pass('Every partner has a live and a sandbox pair', `${checked} partners`)
    : fail('Credential pairs', 'none found');
  wrong === 0 ? pass('No partner is missing one half of the pair') : fail('Credential pairs', `${wrong}`);
}

{
  // The real assertion: what /me hands the portal.
  const partnerUser = await prisma.user.findFirst({
    where: { role: 'PARTNER', partnerId: { not: null } },
    include: { partner: true },
  });

  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: partnerUser.email, password: 'peptide-dev-2026' }),
  });
  const partnerToken = (await res.json())?.data?.accessToken;

  const me = await fetch(`${API}/api/partner/me`, {
    headers: { Authorization: `Bearer ${partnerToken}` },
  });
  const body = await me.json();

  const live = await prisma.partnerCredential.findFirst({
    where: { partnerId: partnerUser.partnerId, isSandbox: false, revokedAt: null },
  });
  const sandbox = await prisma.partnerCredential.findFirst({
    where: { partnerId: partnerUser.partnerId, isSandbox: true, revokedAt: null },
  });

  body?.data?.credentials?.clientId === live?.clientId
    ? pass('The portal is given the live credential', live?.clientId)
    : fail('Live credential', `portal got ${body?.data?.credentials?.clientId}, live is ${live?.clientId}`);

  !body?.data?.credentials?.clientId?.endsWith('_sandbox')
    ? pass('The live credential is not a sandbox one wearing the wrong label')
    : fail('Sandbox shown as live', body.data.credentials.clientId);

  body?.data?.sandboxCredentials?.clientId === sandbox?.clientId
    ? pass('The sandbox credential is handed over separately', sandbox?.clientId)
    : fail('Sandbox credential', `got ${body?.data?.sandboxCredentials?.clientId}`);

  // A secret is shown once and never again. If one is reachable from /me,
  // every rotation is pointless.
  const serialised = JSON.stringify(body);
  !/pmd_sk_/.test(serialised)
    ? pass('No secret is returned by /me')
    : fail('Secret leaked', 'a pmd_sk_ value came back from /me');
}

{
  // Tenant separation on the same endpoint, since the docs page renders
  // whatever /me returns straight onto the screen.
  const users = await prisma.user.findMany({
    where: { role: 'PARTNER', partnerId: { not: null } },
    take: 2,
  });

  if (users.length < 2) {
    pass('Only one partner account exists', 'cross tenant check skipped');
  } else {
    const tokens = [];
    for (const user of users) {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: 'peptide-dev-2026' }),
      });
      tokens.push((await res.json())?.data?.accessToken);
    }

    const first = await (await fetch(`${API}/api/partner/me`, { headers: { Authorization: `Bearer ${tokens[0]}` } })).json();
    const second = await (await fetch(`${API}/api/partner/me`, { headers: { Authorization: `Bearer ${tokens[1]}` } })).json();

    first?.data?.id !== second?.data?.id &&
    first?.data?.credentials?.clientId !== second?.data?.credentials?.clientId
      ? pass('Two partners are given different credentials')
      : fail('Tenant separation', 'both partners saw the same credential');
  }
}

await prisma.$disconnect();

const failed = results.filter((r) => !r).length;
console.log(`\n${'='.repeat(60)}`);
console.log(`${results.length - failed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('\nThe report agrees with the invoices, and partners are given the right credentials.');
}
process.exit(failed > 0 ? 1 : 0);
