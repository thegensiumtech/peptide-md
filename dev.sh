#!/usr/bin/env bash
#
# Start everything needed to run Peptide MD locally.
#
#   ./dev.sh
#
# Brings up Postgres and Redis if they are not already running, applies any
# pending migrations, starts the Stripe webhook listener and writes the signing
# secret it prints into .env.local, then runs the API and the website.
#
# Ctrl+C stops all of it.

set -uo pipefail
cd "$(dirname "$0")"

BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; OFF=$'\033[0m'
say()  { printf "%s\n" "$1"; }
ok()   { printf "  ${GREEN}✓${OFF} %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${OFF} %s\n" "$1"; }
die()  { printf "  ${RED}✗${OFF} %s\n" "$1"; exit 1; }

LOGS=".dev-logs"; mkdir -p "$LOGS"
PIDS=()

cleanup() {
  printf "\n${DIM}Stopping…${OFF}\n"
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null; done
  # Anything that daemonised past the parent.
  pkill -f "next dev" 2>/dev/null
  pkill -f "tsx watch src/index.ts" 2>/dev/null
  pkill -f "stripe listen" 2>/dev/null
  printf "${DIM}Stopped. Postgres and Redis left running.${OFF}\n"
  exit 0
}
trap cleanup INT TERM

say ""
say "${BOLD}Peptide MD, local${OFF}"
say ""

# --- Prerequisites ----------------------------------------------------------
say "${BOLD}Checking what is running${OFF}"

command -v pnpm >/dev/null || die "pnpm not found. Install with: npm i -g pnpm@10.26.2"
[ -f .env.local ] || die ".env.local missing. Copy .env.example and fill it in."

if pg_isready -q 2>/dev/null; then
  ok "postgres"
else
  warn "postgres not running, starting it"
  brew services start postgresql@16 >/dev/null 2>&1 || brew services start postgresql >/dev/null 2>&1
  for _ in $(seq 1 20); do pg_isready -q 2>/dev/null && break; sleep 1; done
  pg_isready -q 2>/dev/null && ok "postgres" || die "could not start postgres"
fi

if redis-cli ping 2>/dev/null | grep -q PONG; then
  ok "redis"
else
  warn "redis not running, starting it"
  brew services start redis >/dev/null 2>&1
  for _ in $(seq 1 15); do redis-cli ping 2>/dev/null | grep -q PONG && break; sleep 1; done
  redis-cli ping 2>/dev/null | grep -q PONG && ok "redis" || warn "redis unavailable, the app still works, just slower"
fi

# Free the ports, or two copies fight over them.
for port in 3000 4000; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
    warn "port $port was busy, freeing it"
    kill -9 $(lsof -t -nP -iTCP:$port -sTCP:LISTEN) 2>/dev/null
    sleep 1
  fi
done

# --- Database ---------------------------------------------------------------
say ""
say "${BOLD}Database${OFF}"

DB_URL=$(grep '^DATABASE_URL=' .env.local | cut -d'"' -f2)
DB_NAME=$(printf '%s' "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')
psql -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw "$DB_NAME" || { createdb "$DB_NAME" 2>/dev/null && ok "created $DB_NAME"; }

# The Prisma CLI reads .env from its own package, not our root .env.local,
# so the URL is passed explicitly rather than left to be discovered.
DATABASE_URL="$DB_URL" pnpm --filter @peptide/database exec prisma migrate deploy >"$LOGS/migrate.log" 2>&1 \
  && ok "migrations up to date" || warn "migrations failed, see $LOGS/migrate.log"
DATABASE_URL="$DB_URL" pnpm --filter @peptide/database exec prisma generate >/dev/null 2>&1

COUNT=$(psql -d "$DB_NAME" -tAc "SELECT count(*) FROM bookings;" 2>/dev/null || echo 0)
if [ "${COUNT:-0}" -eq 0 ]; then
  warn "no data, seeding"
  pnpm --filter @peptide/database db:seed >"$LOGS/seed.log" 2>&1 && ok "seeded" || warn "seed failed, see $LOGS/seed.log"
else
  ok "$COUNT bookings already in the database"
fi

# --- Stripe webhooks --------------------------------------------------------
say ""
say "${BOLD}Stripe${OFF}"

if command -v stripe >/dev/null 2>&1; then
  SK=$(grep '^STRIPE_SECRET_KEY=' .env.local | cut -d'"' -f2)
  : > "$LOGS/stripe.log"
  stripe listen --api-key "$SK" \
    --events checkout.session.completed,checkout.session.expired,payment_intent.payment_failed,charge.refunded \
    --forward-to localhost:4000/api/webhooks/stripe >"$LOGS/stripe.log" 2>&1 &
  PIDS+=($!)

  for _ in $(seq 1 20); do grep -qo "whsec_[A-Za-z0-9]*" "$LOGS/stripe.log" 2>/dev/null && break; sleep 1; done
  SECRET=$(grep -o "whsec_[A-Za-z0-9]*" "$LOGS/stripe.log" 2>/dev/null | head -1)

  if [ -n "$SECRET" ]; then
    # The CLI mints a fresh secret each session, so the API must be told.
    if [ "$(uname)" = "Darwin" ]; then
      sed -i '' "s|^STRIPE_WEBHOOK_SECRET=.*|STRIPE_WEBHOOK_SECRET=\"$SECRET\"|" .env.local
    else
      sed -i "s|^STRIPE_WEBHOOK_SECRET=.*|STRIPE_WEBHOOK_SECRET=\"$SECRET\"|" .env.local
    fi
    ok "webhooks forwarding, secret written to .env.local"
  else
    warn "listener did not report a secret, payments still work, webhooks will not"
  fi
else
  warn "stripe CLI not installed, payments work, webhooks do not"
  say "    ${DIM}brew install stripe/stripe-cli/stripe${OFF}"
fi

# --- The apps ---------------------------------------------------------------
say ""
say "${BOLD}Starting${OFF}"

pnpm --filter @peptide/api dev >"$LOGS/api.log" 2>&1 &
PIDS+=($!)
for _ in $(seq 1 40); do curl -sf -o /dev/null http://localhost:4000/api/health && break; sleep 1; done
curl -sf -o /dev/null http://localhost:4000/api/health && ok "api    http://localhost:4000" || die "api failed, tail $LOGS/api.log"

pnpm --filter @peptide/web dev >"$LOGS/web.log" 2>&1 &
PIDS+=($!)
for _ in $(seq 1 60); do curl -sf -o /dev/null http://localhost:3000 && break; sleep 1; done
curl -sf -o /dev/null http://localhost:3000 && ok "web    http://localhost:3000" || die "web failed, tail $LOGS/web.log"

say ""
say "${BOLD}Ready${OFF}, http://localhost:3000"
say ""
say "  Admin    ross@peptidemd.com     ${DIM}peptide-dev-2026${OFF}"
say "  Doctor   james@peptidemd.com    ${DIM}peptide-dev-2026${OFF}"
say "  Partner  dana@newyoupeptides.com.au"
say ""
say "  Test card  ${DIM}4242 4242 4242 4242${OFF}, any future expiry and CVC"
say "  Logs       ${DIM}$LOGS/{api,web,stripe}.log${OFF}"
say ""
say "  ${DIM}Ctrl+C to stop everything.${OFF}"
say ""

# Follow both logs until interrupted.
tail -f "$LOGS/api.log" "$LOGS/web.log" 2>/dev/null &
PIDS+=($!)
wait
