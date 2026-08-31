# Operations

How to run Peptide MD, deploy a change, and work out what is wrong when
something breaks. Written for whoever is holding this after handover, assuming
they did not build it.

If you read one section, read [What breaks, and what it looks
like](#7-what-breaks-and-what-it-looks-like). Most of the failures this platform
has actually had were silent, and that section is the list of them.

---

## 1. What runs where

Production is a single Ubuntu host behind nginx. Both applications sit on it and
nginx decides which one answers.

| Path | Served by | Port |
|---|---|---|
| `/api/*` | Express, `apps/api` | 4000 |
| everything else | Next.js, `apps/web` | 3000 |

That single origin matters more than it looks. Because the API answers on the
same host as the site, the browser never makes a cross-origin request in normal
use, and the partner API's public base URL is `https://peptidemd.co.uk` with no
separate `api.` subdomain. Anything that documents a different base is wrong.

External services:

| Service | Used for |
|---|---|
| PostgreSQL | Everything. The only source of truth. |
| Redis | Rate limit counters, credential verification cache |
| Stripe | Direct patient payments, refunds |
| AWS SES (eu-west-2) | Every outbound email, plus bounce and complaint handling |

Redis is a cache, never a store. If it is down the platform keeps working:
rate limiting falls back to per-process counting and credential checks go
straight to Postgres. Slower, not broken.

---

## 2. Running it locally

```bash
pnpm install
pnpm --filter @peptide/database exec prisma migrate deploy
pnpm --filter @peptide/database exec tsx prisma/seed.ts

pnpm dev            # both apps, watch mode
```

Seeded accounts all use the password `peptide-dev-2026`:

| Email | Role |
|---|---|
| `ross@peptidemd.co.uk` | Admin |
| `mark@peptidemd.co.uk` | Doctor |
| `dana@newyoupeptides.com.au` | Partner, New You Peptides |
| `marcus@fivepeptides.co.uk` | Partner, Five Peptides |

The seed is idempotent and safe to re-run. It will not overwrite the doctor's
bio or GMC number, because the doctor upsert keys on the real GMC and leaves
existing rows alone.

To run the suites you need a **production build**, not `pnpm dev`:

```bash
pnpm build
pnpm --filter @peptide/web start      # port 3000
pnpm --filter @peptide/api dev        # port 4000
```

---

## 3. Deploying

Nothing about this is clever, which is deliberate.

```bash
# on the server, in the repo
git pull
pnpm install --frozen-lockfile
pnpm --filter @peptide/database exec prisma migrate deploy
pnpm build
# then restart both processes, in whatever supervises them on this host
```

The restart step is deliberately not spelled out here: this document was
written without shell access to the production host, and naming a systemd unit
or a pm2 process that may not exist would be worse than leaving it open. Fill in
the real command once, at handover, and it never needs thinking about again.
Both processes must be restarted, and the web one **after** the build, for the
reason two paragraphs down.

Four things to know before you run that.

**Migrations are immutable once applied.** Editing a migration that has already
run changes its checksum and Prisma will refuse to do anything until the drift
is resolved. If a migration is wrong, write a new one that corrects it.

**`prisma migrate deploy` can appear to succeed and do nothing** if
`DATABASE_URL` is quoted in the env file. It reads the quotes as part of the
string. After migrating, check the change actually landed rather than trusting
the exit code:

```bash
psql "$DATABASE_URL" -c '\d bookings' | grep is_sandbox
```

**Never build while the web server is running.** `pnpm build` rewrites the
chunk hashes on disk while the running server keeps serving HTML pointing at
the old ones. Every page then dies with a ChunkLoadError, which reads like a
hundred unrelated bugs. Build, then restart. Both `scripts/verify.mjs` and
`scripts/e2e.mjs` detect this and tell you in one line rather than failing
twenty checks.

**The API needs Chromium** for invoice PDFs, which are rendered with Playwright:

```bash
pnpm --filter @peptide/api exec playwright install --with-deps chromium
```

Without it invoice generation still works and the totals are right; only the
PDF download fails, and it fails at the moment somebody tries to send an
invoice.

---

## 4. Configuration

The API refuses to boot in production with a placeholder webhook secret, a
development JWT secret, or a provider named without its credentials
(`assertProductionReadiness`). In development the same checks log a warning and
carry on, so the platform runs before those accounts exist.

| Variable | Notes |
|---|---|
| `DATABASE_URL` | No quotes. See above. |
| `REDIS_URL` | Optional. Absent means per-process rate limiting. |
| `JWT_SECRET` | Must not be the development value in production. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Live keys and the live endpoint's signing secret. |
| `SCHEDULING_PROVIDER` | `internal`. See architecture §5 for why not Cal.com. |
| `EMAIL_PROVIDER` | `ses` in production, `console` locally. |
| `AWS_REGION` | `eu-west-2`. SES identities are regional; the wrong region fails as an auth error, not a routing one. |
| `SES_FROM_EMAIL`, `SES_REPLY_TO` | Must be a verified identity on the sending domain. |
| `NEXT_PUBLIC_API_URL` | The public API origin. The partner API docs page renders its examples from this, so a wrong value ships wrong documentation to partners. |

`NEXT_PUBLIC_*` values are compiled into the client bundle at build time.
Changing one needs a rebuild, not a restart.

---

## 5. Scheduled work

All of it runs in-process on the API, on `setInterval`. There is no cron.

| Job | Every | What it does |
|---|---|---|
| Hold sweep | 60s | Releases expired slot holds, purges spent access codes |
| Reminders | 15m | Sends appointment reminders that have come due |
| Invoicing | 1h, and at boot | Raises drafts for any finished month not yet invoiced |

Invoicing deliberately asks *"has the month that just finished been invoiced
yet"* rather than counting down to the 1st. A restart or an outage across month
end therefore cannot silently skip a month's billing: the next hourly tick
notices and catches up.

Invoices are raised as **drafts**. Nothing reaches a partner until an admin
reviews it and presses send.

Because these run in-process, running two API instances would double every job.
If the API is ever scaled horizontally, these move out first.

---

## 6. Verification

Thirteen suites, roughly 200 checks. They run against a running instance, not a
test harness, and they assert at the database as well as the UI.

```bash
node scripts/verify.mjs               # routes, access control, responsive
node scripts/verify-api.mjs           # API contracts, concurrency
node scripts/verify-scheduling.mjs    # one winner across all channels
node scripts/verify-timezones.mjs     # patient-local times
node scripts/verify-no-free-bookings.mjs
node scripts/verify-diary.mjs
node scripts/verify-bounces.mjs       # SES bounce and complaint handling
node scripts/verify-partner-api.mjs   # credentials, tenancy, sandbox, rate limit
node scripts/verify-invoicing.mjs     # arithmetic, idempotence, rate capture
node scripts/verify-reporting.mjs     # reports reconcile with invoices
node scripts/verify-widget.mjs        # isolation on a hostile host page
node scripts/verify-no-em-dashes.mjs
node scripts/e2e.mjs                  # full journey through real Stripe Checkout
```

Point any of them at a deployed environment with `BASE_URL`:

```bash
BASE_URL=https://peptidemd.co.uk node scripts/verify.mjs
```

**Running them all back to back trips the rate limiter.** The booking endpoints
are limited per minute, and a full sequential run exhausts the window. Suites
that then fail report `Too many requests`, which looks like a regression and is
not. Leave a minute between runs, or run the affected four separately.

Two things automation cannot judge, and which should be checked by hand before
handover is called done: an invoice PDF read end to end for correct figures and
branding, and the widget pasted into a real third-party page.

---

## 7. What breaks, and what it looks like

Every entry here has actually happened on this project. They are grouped by
what you would see first, because none of them announce themselves.

### Every page is broken at once

Almost always a stale build: `pnpm build` ran while the server was up. Restart
the web server. `scripts/verify.mjs` names this explicitly if you run it.

### Emails silently stop

Check `/api/health` first: it reports the email provider actually in use. Then:

- **Wrong AWS region.** SES identities are regional. `eu-west-2` is correct;
  anything else fails as an authentication error rather than a routing one,
  which sends you looking in the wrong place.
- **The suppression list.** A hard bounce adds the address permanently. That is
  deliberate: sending to a known-bad address is what gets a domain's reputation
  destroyed. `EmailSuppression` is the table.
- **Editing the wrong `.env`.** The API reads `apps/api/.env`. A stray
  `~/app/.env` on the server will be ignored while looking authoritative. After
  changing config, read the value back out of the running process rather than
  trusting the restart.

### A partner says their integration books nothing

They are almost certainly using their **sandbox** client id. Sandbox credentials
end in `_sandbox`, resolve to a separate doctor record, and return perfectly
normal confirmations for appointments that do not exist in the real diary. This
is by design, and it is also how it goes wrong: the portal used to hand every
partner their sandbox id labelled as their live one.

Check which they are using:

```sql
SELECT client_id, is_sandbox, last_used_at
FROM partner_credentials WHERE partner_id = '...';
```

### A partner's numbers disagree with their invoice

They should not: `/api/admin/reports` and the invoicing module count with the
same rule (`billableWhere`), and `verify-reporting.mjs` asserts that they agree
partner by partner. If they diverge, one of those two has been changed without
the other.

An invoiced month is priced at the rate its invoice captured, not the partner's
current rate. So changing a rate today correctly leaves last month's figures
alone, and a partner asking why the report "did not update" is seeing intended
behaviour.

### Invoice PDFs fail but invoices are fine

Chromium is missing on the server. See §3.

### The server slows down and then refuses connections

Check for orphaned Node processes. Repeated restarts during development can
leave supervisors running that never released their file descriptors:

```bash
ps aux | grep -E 'next-server|tsx' | grep -v grep
lsof | wc -l
```

This has taken the local environment to `EMFILE: too many open files`. It is
housekeeping, not a code fault, but it looks like one.

### A booking exists twice, or a slot was sold twice

It should be impossible: `@@unique([doctorId, startsAt])` on `slot_holds` is
what makes the shared calendar safe across the website, the partner API and the
widget simultaneously. If it ever happens, that constraint is the first thing to
check, and `verify-scheduling.mjs` reproduces the contention deliberately.

---

## 8. Handover checklist

- [ ] Chromium installed on the API host
- [ ] `NEXT_PUBLIC_API_URL` set to the public origin, and the app rebuilt after
- [ ] SES in production access, out of the sandbox, with DKIM, SPF and DMARC passing
- [ ] Stripe live keys and a live webhook endpoint with its own signing secret
- [ ] All thirteen suites run green against production
- [ ] An invoice PDF read by a human
- [ ] The widget pasted into a real partner page
- [ ] Admin accounts created for the real people, and the seeded development
      accounts removed or given real passwords

The last one matters. The seeded accounts share one well-known password. They
are fine in development and must not survive into production.
