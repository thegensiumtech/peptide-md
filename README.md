# Peptide MD Consultation Platform

All 28 screens from the scope document, built in Next.js 14 against static data.
Every screen reads through one async data client, so replacing fixtures with the
real API is a change to a single file.

## Running it

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

```bash
pnpm build          # production build
pnpm verify         # build, then drive every screen in a real browser
pnpm typecheck      # tsc across the workspace
pnpm lint
```

### If you see "Application error: a client-side exception has occurred"

Almost always this means **a build ran while `pnpm start` was still serving**.
Next.js fingerprints its JS chunks per build, so the running server keeps handing
out HTML that points at the previous build's filenames, they 404, and the app
falls over with `ChunkLoadError`.

Stop the server, rebuild, then start again:

```bash
pkill -f next-server
pnpm build
pnpm --filter @peptide/web start
```

`pnpm dev` does not have this problem. `pnpm verify` avoids it by starting its own
server on port 3100 and shutting it down afterwards.

## Layout

```
apps/web/                  the application, public site, booking, admin, partner portal
  src/app/
    (marketing)/           9 public pages
    (booking)/book/        5-step booking flow
    admin/                 admin + doctor, separated by role
    partner/               partner portal, scoped to one partner
  src/components/          ui primitives, and one folder per surface
  src/lib/
    data/client.ts         ← the only place screens get data from
    data/fixtures/         static records
    auth/                  session + RBAC
  src/middleware.ts        route guards
packages/shared/           domain types, the contract the API will implement
docs/screen-map.md         every screen, route, journey and access rule
proposal/                  the scope document and diagrams (git-ignored)
```

## Signing in

Any password works; the email selects the role.

| Screen | Email | Sees |
|---|---|---|
| `/admin/login` | `ross@peptidemd.co.uk` | Everything |
| `/admin/login` | `mark@peptidemd.co.uk` | Own diary and availability only |
| `/partner/login` | `dana@newyoupeptides.com.au` | New You Peptides only |
| `/partner/login` | `marcus@fivepeptides.co.uk` | Five Peptides only |

## Static data

All records live in `src/lib/data/fixtures/` and are anchored to a fixed date
(`src/lib/clock.ts`, 9 August 2026) rather than the real clock. That keeps server
and client rendering identical and keeps "upcoming" stable while demoing.

To go live, rewrite the function bodies in `src/lib/data/client.ts` as `fetch`
calls. They are already async and already return the `ApiResponse<T>` envelope
from `@peptide/shared`, so no screen changes. The function-to-endpoint mapping is
in [docs/screen-map.md](docs/screen-map.md).

## Live data: patient self-service

`/manage` is the exception to the above, it does not read fixtures. A patient
moving or cancelling an appointment has to be looking at the real diary, so those
screens call the Express API directly through `src/lib/api/`.

They need the API running (`pnpm --filter @peptide/api dev`) and
`NEXT_PUBLIC_API_URL` pointing at it. That is set in `apps/web/.env.local`, which
Next reads from the app root rather than the workspace root; the client falls back
to `http://localhost:4000` when it is unset.

### How a patient gets in

Patients have no account. Access rests on proving control of the inbox the
booking was made from:

1. They enter the address they booked with.
2. If it has appointments, a six-digit code is emailed. If it does not, nothing
   is sent, and the response is identical either way, so the form cannot be
   used to discover who is a patient.
3. The code opens a 30-minute session. Every endpoint under `/api/booking/manage`
   requires it, and the address is read from the signed token, never from the
   request body.

An email address is not a secret, and when someone is seeing a doctor is clinical
information, that is the gap this closes. References are sequential and
therefore guessable, so the link in the confirmation email is gated too; it only
prefills the reference.

**In local development the code is shown on screen and prefilled**, in a dashed
box marked "email not delivered", so there is no digging through the server log.
This requires *both* a non-production build *and* `EMAIL_PROVIDER=console`, the
API omits the code from its response otherwise, so a deployed site cannot render
that box no matter what the front end asks for. The switch is `CODES_ARE_EXPOSED`
in `accessCodes.ts`. The 60-second resend cooldown is also skipped while it is
on, since there is no real inbox to protect from repeats.

Codes are stored hashed (`manage_access_codes`), single-use, expire in ten
minutes, and die after five wrong guesses. Requests are capped at 6 per quarter
hour per IP with a 60-second resend cooldown, and expired rows are swept by the
same interval that releases abandoned slot holds. The knobs are the constants at
the top of `apps/api/src/modules/bookings/accessCodes.ts`.

What a patient may then do is decided in
`apps/api/src/modules/bookings/policy.ts` and sent to the browser as flags, the
notice periods live there and nowhere else.

## Design

Colour lives once, in `apps/web/src/app/globals.css`, as RGB channel tokens.
Nothing hardcodes a hex value, dropping in Peptide MD's real palette is an edit
to that one block.

Chart series colours are separate from status colours and were validated for
colour-vision separation, chroma and contrast before use.

## Scheduling is in-house

Not Cal.com. The scope named it; we built it instead, behind the same provider
interface so Cal.com remains a config change (`SCHEDULING_PROVIDER=calcom`).
Reasoning and cost comparison in [docs/architecture.md](docs/architecture.md).

The doctor manages his own week at `/admin/availability`, one tap blocks a
slot, and it disappears from this site and every partner site at once. A slot
with a patient booked into it cannot be blocked.

## Verification

```bash
node scripts/e2e.mjs                     # 60, full journeys, real Stripe, mobile
node scripts/verify-api.mjs              # 20, contracts, concurrency
node scripts/verify-scheduling.mjs       #  9, provider contract
node scripts/verify-timezones.mjs        #  5. DST, both hemispheres
node scripts/verify-no-free-bookings.mjs #  7, payment bypass attempts
node scripts/verify-diary.mjs            #  8, the doctor's diary
node scripts/verify-partner-api.mjs      # 31, credentials, tenancy, sandbox, rate limit
node scripts/verify-invoicing.mjs        # 15, arithmetic, idempotency, captured rates
node scripts/verify-widget.mjs           # 21, framing, isolation, attribution
node scripts/verify-bounces.mjs          #  5, SES bounce and complaint handling
node scripts/verify-no-em-dashes.mjs     #     copy lint, source and database
```

## Still outstanding

- A photograph of the doctor (the portrait frame degrades to initials until then)
- Legal copy approved by Ross's legal advisor, the three legal pages carry a
  visible draft banner until that happens
