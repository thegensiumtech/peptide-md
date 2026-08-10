# Screen map and user journeys

Every screen in the scope document, its route, who can reach it, and how a user
gets in and out of it. 28 screens from the scope, plus one addition noted below.

Anchor date for all static data: **9 August 2026** (`src/lib/clock.ts`).

---

## 1. Route map

### Public site — `(marketing)` group

| # | Screen | Route | Notes |
|---|---|---|---|
| 1 | Homepage | `/` | Service, doctor, booking CTA |
| 2 | How It Works | `/how-it-works` | The four-step process |
| 3 | About Peptides | `/about-peptides` | Educational content |
| 4 | Meet the Doctor | `/the-doctor` | Bio, credentials, photo |
| 5 | FAQ | `/faq` | Accordion, keyboard operable |
| 6 | Contact | `/contact` | Enquiry form |
| 7 | Privacy Policy | `/privacy` | Legal |
| 8 | Terms of Service | `/terms` | Legal |
| 9 | Medical Disclaimer | `/medical-disclaimer` | Legal |

### Booking flow — `(booking)` group

| # | Screen | Route | Rail position |
|---|---|---|---|
| 10 | Consultation details | `/book` | 1 — Consult |
| 11 | Payment (Stripe) | `/book/payment` | 2 — Pay |
| 12 | Slot selection | `/book/slot` | 3 — Time |
| 13 | Intake form | `/book/intake` | 4 — Intake |
| 14 | Confirmation | `/book/confirmed` | 5 — Done |

### Admin — `admin` group, roles `admin` + `doctor`

| # | Screen | Route | admin | doctor |
|---|---|---|---|---|
| 15 | Login (shared) | `/admin/login` | ✅ | ✅ |
| 16 | Dashboard | `/admin` | ✅ full | ✅ own diary |
| 17 | Bookings list | `/admin/bookings` | ✅ all | ✅ own, no commercial columns |
| 18 | Booking detail | `/admin/bookings/[id]` | ✅ | ✅ clinical only |
| 19 | Doctor profile | `/admin/doctor-profile` | ✅ | ✅ |
| 20 | Settings | `/admin/settings` | ✅ | ⛔ 403 |
| — | **Doctor availability** | `/admin/availability` | ✅ | ✅ |
| 21 | Partner list | `/admin/partners` | ✅ | ⛔ 403 |
| 22 | Add / edit partner | `/admin/partners/new`, `/admin/partners/[id]` | ✅ | ⛔ 403 |
| 23 | Invoice list | `/admin/invoices` | ✅ | ⛔ 403 |
| 24 | Invoice detail | `/admin/invoices/[id]` | ✅ | ⛔ 403 |

> **The one addition beyond the 28.** The scope hands weekly availability to the
> scheduling core's own interface, but it also says the doctor "manages his own
> weekly availability". Without `/admin/availability` the doctor role has no
> journey. It is built here so the role is complete; in production it can either
> stay or defer to the scheduling core's UI.

### Partner portal — `partner` group, role `partner`

| # | Screen | Route | Notes |
|---|---|---|---|
| 25 | Partner login | `/partner/login` | Separate from admin login |
| 26 | Bookings view | `/partner/bookings` | Carries the running month total |
| 27 | Invoices view | `/partner/invoices` | History + PDF download |
| 28 | API credentials | `/partner/api-credentials` | View, rotate |

`/partner` redirects to `/partner/bookings`. The running total lives on the
bookings view rather than on a separate dashboard, which keeps the portal to the
four screens the scope lists while still showing everything the scope requires:
appointments sent with status, running month total, invoice history with PDFs,
and API credentials with rotation.

---

## 2. How the journeys connect

### Patient — direct booking

```
/  ──┬─► /how-it-works ──┐
     ├─► /about-peptides ─┤
     ├─► /the-doctor ─────┼──► /book ──► /book/payment ──► /book/slot
     └─► /faq ────────────┘                                     │
                                                                ▼
                        /book/confirmed ◄── /book/intake ◄───────┘
```

- "Book a consultation" is persistent in the site header on every marketing page,
  so the flow is one click from anywhere.
- `/book/confirmed` is terminal: it offers the calendar invite, the booking
  reference, and links back to `/` and `/contact`. It never loops back into the flow.

### Back-button rules in the booking flow

The flow changes direction at payment, and the UI has to be honest about that.

| From | Back goes to | Why |
|---|---|---|
| `/book` | Previous marketing page | Nothing has been committed |
| `/book/payment` | `/book` | Nothing has been charged |
| `/book/slot` | **No back to payment** | Money has been taken. Rail shows Pay complete and inert. Escape hatch is "Need help?" → `/contact` |
| `/book/intake` | "Change time" → `/book/slot` | Explicit affordance, not browser back — re-picking releases the held slot |
| `/book/confirmed` | Terminal | Forward only |

Steps are guarded by booking state held in `BookingContext` (sessionStorage). Deep-linking
`/book/intake` with no slot chosen redirects to the earliest incomplete step rather than
rendering a broken form.

### Admin and doctor

```
/admin/login ──► /admin (dashboard)
                   │
                   ├──► /admin/bookings ──► /admin/bookings/[id]
                   │         ▲                     │
                   │         └── back preserves filters via query string
                   │
                   ├──► /admin/availability      (doctor + admin)
                   ├──► /admin/doctor-profile    (doctor + admin)
                   ├──► /admin/settings          (admin only)
                   ├──► /admin/partners ──► /admin/partners/[id]
                   │                              │
                   │                              └──► /admin/bookings?partner=<id>
                   └──► /admin/invoices ──► /admin/invoices/[id]
                                                  │
                                                  └──► /admin/bookings/[id]  (each line)
```

Cross-links that make the commercial story navigable:
- Dashboard "billable this month" tile per partner → that partner's **draft invoice**.
- Partner detail → **"View bookings from this partner"** → pre-filtered bookings list.
- Invoice detail → every counted appointment links to its booking detail. This is the
  evidence behind the total, which is what the admin reviews before sending.

### Partner staff

```
/partner/login ──► /partner/bookings ──┬──► /partner/invoices
                   (running total)     └──► /partner/api-credentials
```

Strictly scoped: every query is filtered by the session's `partnerId` before it
returns. A partner has no route into `/admin/*`.

---

## 3. Access control

| Rule | Behaviour |
|---|---|
| No session on `/admin/*` | Redirect `/admin/login?next=<path>` |
| No session on `/partner/*` | Redirect `/partner/login?next=<path>` |
| Partner session on `/admin/*` | Redirect to `/partner/bookings` |
| Admin/doctor session on `/partner/*` | Redirect to `/admin` |
| Doctor on an admin-only route | 403 screen explaining the limit, with a link back to `/admin` |

Permissions are declared once in `@peptide/shared/auth.ts` (`ROLE_PERMISSIONS`) and
enforced in middleware, in the shell navigation, and on the screen itself — so a
hidden nav item is never the only thing standing between a role and a screen.

---

## 4. Navigation and accessibility floor

- Skip link to `#main` on every layout.
- Admin and partner shells carry breadcrumbs; every detail screen also has an
  explicit in-page "Back to …" link, so navigation never depends on browser back.
- `aria-current="page"` on active nav, `aria-current="step"` on the sequence rail.
- All interactive elements keyboard reachable with a visible amber focus ring.
- Tables scroll inside their own container; the page body never scrolls sideways.
- `prefers-reduced-motion` respected globally.
- Responsive at 320 / 375 / 768 / 1024 / 1440.

---

## 5. Swapping static data for the API

Every screen reads through `src/lib/data/client.ts`, whose functions are async and
return the `ApiResponse<T>` envelope from `@peptide/shared`. Each one maps to the
endpoint that will replace it:

| Client function | Future endpoint |
|---|---|
| `getBookings(filters)` | `GET /api/bookings` |
| `getBooking(id)` | `GET /api/bookings/:id` |
| `getDashboard()` | `GET /api/admin/dashboard` |
| `getAvailableDays()` | `GET /api/availability` |
| `getPartners()` | `GET /api/partners` |
| `getInvoices(filters)` | `GET /api/invoices` |
| `getPartnerVolume(id)` | `GET /api/partners/:id/volume` |

Replacing fixtures with `fetch` is a change to that one file. No screen changes.
