/**
 * Em dashes must not appear in Peptide MD copy.
 *
 * Source files are easy to grep. The trap is the database: seeded rows are
 * written once and the seed upserts with `update: {}`, so a source sweep leaves
 * them untouched and they keep rendering on /the-doctor and /book. That has
 * happened twice, hence this check.
 *
 * email_logs.subject and webhook_events.error are exempt. The first is a record
 * of what was actually sent, the second holds Stripe's wording, and rewriting
 * either would make the log untrue rather than tidy.
 *
 *   node scripts/verify-no-em-dashes.mjs
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(import.meta.dirname, '../.env.local') });

const EM_DASH = '—';
const root = resolve(import.meta.dirname, '..');
const prisma = new PrismaClient();
const failures = [];

// --- Source -----------------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.turbo', 'dist', '.e2e-shots']);
const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.css', '.prisma'];

function walk(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) walk(full, found);
    else if (EXTENSIONS.some((e) => entry.endsWith(e))) found.push(full);
  }
  return found;
}

for (const file of walk(resolve(root, 'apps')).concat(
  walk(resolve(root, 'packages')),
  walk(resolve(root, 'scripts'))
)) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes(EM_DASH)) continue;
  // This file necessarily names the character it is looking for.
  if (file.endsWith('verify-no-em-dashes.mjs')) continue;
  const line = text.slice(0, text.indexOf(EM_DASH)).split('\n').length;
  failures.push(`${file.replace(`${root}/`, '')}:${line}`);
}

// --- Database ---------------------------------------------------------------

// Columns holding somebody else's words rather than our copy. A style rule
// about our writing must never become a licence to edit what a patient typed
// or to rewrite a record of what was actually sent.
const EXEMPT = new Set([
  'email_logs.subject',
  'email_logs.body',
  'webhook_events.error',
  'intake_responses.answer',
]);

const columns = await prisma.$queryRaw`
  SELECT table_name, column_name
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND data_type IN ('text', 'character varying')
   ORDER BY table_name, column_name
`;

for (const { table_name, column_name } of columns) {
  if (EXEMPT.has(`${table_name}.${column_name}`)) continue;
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM "${table_name}" WHERE "${column_name}" LIKE '%' || chr(8212) || '%'`
  );
  if (row.n > 0) failures.push(`${table_name}.${column_name} (${row.n} row${row.n === 1 ? '' : 's'})`);
}

await prisma.$disconnect();

// --- Report -----------------------------------------------------------------

if (failures.length === 0) {
  console.log('  ✓ No em dashes in source or database copy');
  process.exit(0);
}

console.log(`  ✗ Em dashes found in ${failures.length} place${failures.length === 1 ? '' : 's'}:`);
for (const f of failures) console.log(`      ${f}`);
process.exit(1);
