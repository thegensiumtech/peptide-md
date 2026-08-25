/**
 * Bounce and complaint handling.
 *
 * This endpoint is public, because Amazon has to reach it, and acting on an
 * unverified message would let anyone who found the URL suppress a patient's
 * address and quietly cut off their appointment emails. So the first thing
 * checked here is that a forged message is refused.
 *
 *   node scripts/verify-bounces.mjs
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

const post = (body) =>
  fetch(`${API}/api/webhooks/ses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const VICTIM = 'bounce-test-victim@example.com';
await prisma.emailSuppression.deleteMany({ where: { email: VICTIM } });

// --- A forged notification must not suppress anybody ------------------------

{
  const res = await post({
    Type: 'Notification',
    MessageId: 'forged-1',
    TopicArn: 'arn:aws:sns:eu-west-2:000000000000:attacker',
    Message: JSON.stringify({
      notificationType: 'Bounce',
      bounce: {
        bounceType: 'Permanent',
        bouncedRecipients: [{ emailAddress: VICTIM }],
      },
    }),
    Timestamp: new Date().toISOString(),
    SignatureVersion: '1',
    Signature: 'bm90LWEtc2lnbmF0dXJl',
    SigningCertURL: 'https://sns.eu-west-2.amazonaws.com/forged.pem',
  });

  const suppressed = await prisma.emailSuppression.count({ where: { email: VICTIM } });
  res.status === 403 && suppressed === 0
    ? pass('Forged bounce rejected, nobody suppressed', '403')
    : fail('Forged bounce rejected', `status ${res.status}, suppressed ${suppressed}`);
}

// --- A certificate hosted somewhere other than Amazon must be refused -------

{
  const res = await post({
    Type: 'Notification',
    MessageId: 'forged-2',
    TopicArn: 'arn:aws:sns:eu-west-2:000000000000:attacker',
    Message: JSON.stringify({ notificationType: 'Bounce' }),
    Timestamp: new Date().toISOString(),
    SignatureVersion: '1',
    Signature: 'bm90LWEtc2lnbmF0dXJl',
    // The attacker controls this field, so pointing it at their own host is
    // the obvious attack.
    SigningCertURL: 'https://attacker.example.com/sns.pem',
  });
  res.status === 403
    ? pass('Certificate from a non-Amazon host refused', '403')
    : fail('Certificate from a non-Amazon host refused', String(res.status));
}

// --- Malformed input is refused rather than crashing ------------------------

{
  const res = await post('this is not json');
  res.status === 400
    ? pass('Malformed message refused', '400')
    : fail('Malformed message refused', String(res.status));
}

// --- A suppressed address is not emailed ------------------------------------

{
  await prisma.emailSuppression.create({
    data: { email: VICTIM, reason: 'HARD_BOUNCE', detail: 'verification fixture' },
  });

  const res = await fetch(`${API}/api/guide/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Suppressed Person', email: VICTIM, source: 'bounce-verify' }),
  });
  const body = await res.json();
  const after = await prisma.emailLog.findMany({
    where: { recipient: VICTIM },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  const logged = after[0];
  const refused =
    body?.data?.sent === false &&
    logged?.failedAt !== null &&
    logged?.sentAt === null &&
    /suppressed/i.test(logged?.error ?? '');

  refused
    ? pass('Suppressed address is not emailed', 'reported as not sent, logged with a reason')
    : fail(
        'Suppressed address is not emailed',
        `sent=${body?.data?.sent} sentAt=${logged?.sentAt} error=${logged?.error}`
      );
}

// --- Case does not defeat suppression ---------------------------------------

{
  const res = await fetch(`${API}/api/guide/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Shouty',
      email: VICTIM.toUpperCase(),
      source: 'bounce-verify',
    }),
  });
  const body = await res.json();
  body?.data?.sent === false
    ? pass('Suppression survives a change of case')
    : fail('Suppression survives a change of case', JSON.stringify(body?.data));
}

// --- Cleanup ----------------------------------------------------------------

await prisma.emailSuppression.deleteMany({ where: { email: VICTIM } });
await prisma.guideRequest.deleteMany({ where: { email: { contains: 'bounce-test-victim' } } });
await prisma.emailLog.deleteMany({ where: { recipient: { contains: 'bounce-test-victim' } } });
await prisma.$disconnect();

const failed = results.filter((r) => !r).length;
console.log(`\n${'='.repeat(58)}`);
console.log(`${results.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
