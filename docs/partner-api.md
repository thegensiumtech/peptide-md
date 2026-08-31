# Partner Booking API

Version 1. Everything a partner's developers need to book into Dr Jinks's diary
from their own system.

This is the same reference a partner sees at `/partner/api-docs` once signed in,
written out here so it can be sent to a development team before their portal
account exists. The portal version has their own client ids filled in; this one
uses placeholders.

Base URL: `https://peptidemd.co.uk`

---

## 1. Before anything else

**You take the payment.** We never charge the patient and never ask them for a
card. What you owe is counted per appointment and invoiced at month end at your
agreed rate.

**The patient never learns we exist.** The confirmation email, the calendar
invite and the widget all carry your branding. You are the clinic as far as the
patient is concerned.

**Build against the sandbox first.** Every partner has two credential pairs. The
sandbox pair resolves to a separate doctor record whose diary is always open, so
nothing you do while integrating reaches a real patient, occupies a real
appointment, or appears on an invoice.

| | Client id ends | Books | Invoiced |
|---|---|---|---|
| Live | `..._8f21c4a9` | The doctor's real diary | Yes |
| Sandbox | `..._8f21c4a9_sandbox` | A separate test diary | Never |

A sandbox response is indistinguishable from a live one except for
`"sandbox": true` in the body. If your integration appears to work perfectly but
no patients arrive, check which client id you are sending. This is the single
most common integration mistake.

---

## 2. Authentication

HTTP Basic. Client id as the username, secret as the password, on every request.

```bash
curl https://peptidemd.co.uk/api/v1/availability \
  -u "$CLIENT_ID:$SECRET"
```

Secrets are shown once, at issue or rotation, and are never recoverable. If you
lose one, rotate it in the partner portal. **The old secret keeps working for 24
hours afterwards**, so you can roll it across your fleet without an outage.

Failures return `401` with no detail about why. An unknown client id and a wrong
secret give the same answer deliberately, so the endpoint cannot be used to
discover which ids exist. A suspended partner gets `403`, which is distinct
because it is something we did rather than something you got wrong.

---

## 3. Booking, in three calls

The middle call is the one that matters. It is what stops two patients taking
the same time.

1. **Ask what is free.** Nothing is reserved by asking. Two of your patients can
   be shown the same slot at the same moment.
2. **Hold the time** as soon as a patient picks it, before they start typing
   their details. The hold locks that slot against our own website, the widget,
   and every other partner. It expires on its own if the patient wanders off.
3. **Confirm the booking** against the hold.

The hold is not optional. Without it, a patient can spend two minutes filling in
a form and then be told the slot went, which is the worst possible moment to
tell them.

---

## 4. Endpoints

### `GET /api/v1/availability`

Bookable times, grouped by date.

| Query | Default | Notes |
|---|---|---|
| `days` | 21 | 1 to 60 |
| `from` | now | ISO 8601 |

```bash
curl "https://peptidemd.co.uk/api/v1/availability?days=14" \
  -u "$CLIENT_ID:$SECRET"
```

```json
{
  "success": true,
  "data": {
    "timezone": "Europe/London",
    "durationMinutes": 20,
    "sandbox": false,
    "days": [
      {
        "date": "2026-09-14",
        "slots": [
          { "startsAt": "2026-09-14T08:00:00.000Z", "endsAt": "2026-09-14T08:20:00.000Z" }
        ]
      }
    ]
  },
  "error": null
}
```

Times are UTC. Convert to the patient's own zone before showing them; a patient
in Sydney should never be asked to work out what a London time means.

---

### `POST /api/v1/holds`

Reserves a slot and returns a token that expires.

```bash
curl -X POST https://peptidemd.co.uk/api/v1/holds \
  -u "$CLIENT_ID:$SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "startsAt": "2026-09-14T08:00:00.000Z" }'
```

```json
{
  "success": true,
  "data": {
    "holdToken": "hold_9f2c41ab7e",
    "expiresAt": "2026-09-14T07:52:00.000Z",
    "startsAt": "2026-09-14T08:00:00.000Z",
    "endsAt": "2026-09-14T08:20:00.000Z"
  },
  "error": null
}
```

`SLOT_TAKEN` here is a normal outcome, not an error to log and forget. Somebody
else got there first. Reload availability and let the patient choose again.

---

### `POST /api/v1/bookings`

Turns a hold into an appointment. The patient is emailed a joining link and the
doctor receives the intake answers.

```bash
curl -X POST https://peptidemd.co.uk/api/v1/bookings \
  -u "$CLIENT_ID:$SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "holdToken": "hold_9f2c41ab7e",
    "patient": {
      "name": "Ruth Callaghan",
      "email": "ruth@example.com",
      "phone": "+61 400 111 222",
      "timezone": "Australia/Sydney"
    },
    "intake": [
      { "question": "What would you like to discuss?", "answer": "Recurring achilles injury" }
    ],
    "reference": "your-own-order-8841"
  }'
```

| Field | Required | Notes |
|---|---|---|
| `holdToken` | yes | From the hold call |
| `patient.name` | yes | |
| `patient.email` | yes | Where the confirmation goes |
| `patient.phone` | yes | |
| `patient.timezone` | yes | IANA name, e.g. `Australia/Sydney` |
| `intake` | no | Up to 20 question and answer pairs, shown to the doctor |
| `reference` | no | Your own identifier, echoed back for reconciliation |

Returns `201`:

```json
{
  "success": true,
  "data": {
    "id": "cmslrpcej003c40ifqkeconlq",
    "reference": "PMD-5104",
    "partnerReference": "your-own-order-8841",
    "status": "confirmed",
    "startsAt": "2026-09-14T08:00:00.000Z",
    "endsAt": "2026-09-14T08:20:00.000Z",
    "patientTimezone": "Australia/Sydney",
    "joiningUrl": null,
    "sandbox": false
  },
  "error": null
}
```

Send `patient.timezone` accurately. It is what the patient's confirmation and
calendar invite are rendered in, and getting it wrong means somebody misses
their appointment.

`joiningUrl` is currently `null` for every booking, and your integration should
treat it as nullable permanently. The consultation itself happens outside this
platform, in Peptide MD's own video tool, and the joining link is sent to the
patient in their confirmation email rather than handed back here. Once that tool
is configured the field will carry its link; until then, do not build a screen
that assumes a value.

---

### `GET /api/v1/bookings`

The appointments you have sent us, and only those.

Intake answers are deliberately not returned. They are clinical, between the
patient and the doctor; you are the referrer rather than a party to the
consultation.

```bash
curl "https://peptidemd.co.uk/api/v1/bookings?limit=25" \
  -u "$CLIENT_ID:$SECRET"
```

---

### `PATCH /api/v1/bookings/:id`

Moves an appointment. Releases the old time and takes the new one in a single
step, so the patient cannot lose their place mid-change.

```bash
curl -X PATCH https://peptidemd.co.uk/api/v1/bookings/BOOKING_ID \
  -u "$CLIENT_ID:$SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "startsAt": "2026-09-15T09:00:00.000Z" }'
```

---

### `DELETE /api/v1/bookings/:id`

Cancels, and frees the time immediately for everyone.

```bash
curl -X DELETE https://peptidemd.co.uk/api/v1/bookings/BOOKING_ID \
  -u "$CLIENT_ID:$SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "Patient cancelled with us" }'
```

A cancelled appointment drops off that month's invoice. Cancel rather than
letting a patient simply not attend: a no-show is still billable, a cancellation
is not.

---

## 5. Responses

Every response, success or failure, uses the same envelope.

```json
{ "success": true,  "data": { }, "error": null }
{ "success": false, "data": null, "error": "That time has just been taken.", "code": "SLOT_TAKEN" }
```

`error` is written to be shown to a patient as-is. `code` is what you branch on.

| Code | HTTP | What to do |
|---|---|---|
| `SLOT_TAKEN` | 409 | Somebody booked it first. Reload availability. |
| `SLOT_IN_PAST` | 400 | Usually a stale availability response your side. |
| `HOLD_EXPIRED` | 409 | Take a fresh hold. Do not retry the old token. |
| `HOLD_ALREADY_USED` | 409 | Already booked. Safe to treat as a duplicate submit. |
| `SAME_SLOT` | 400 | Reschedule sent for the time it is already at. |
| `NOT_RESCHEDULABLE` | 409 | Cancelled or already past. |

A booking id that is not yours returns `404`, not `403`. That is deliberate:
`403` would confirm the id exists and let you map out who else we work with.

---

## 6. Rate limit

Per client id, per minute, set on your account. Going over returns `429` with a
`Retry-After` header. The default is generous for a booking flow; if it is tight
for how you have built things, ask and we will raise it rather than have you
engineer around it.

The limit is checked before your credentials are verified, so a flood of bad
requests cannot be used to make the server do expensive work.

---

## 7. The drop-in widget

If you would rather not build any of this, paste two lines into your page and
the whole flow renders in your colours:

```html
<div id="peptide-booking"></div>
<script src="https://peptidemd.co.uk/v1/widget.js"
        data-client-id="YOUR_CLIENT_ID" defer></script>
```

It loads in an iframe, so your CSS cannot reach in and ours cannot reach out. It
resizes itself, carries your branding, and never mentions Peptide MD.
