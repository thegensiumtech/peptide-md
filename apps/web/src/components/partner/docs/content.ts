/**
 * The written half of the partner API documentation.
 *
 * The endpoint request and response samples live in ApiDocs.tsx and are
 * imported by the page; this file is everything a developer needs *around*
 * them: what the system is, the words it uses, the order the calls go in, and
 * what to do when one fails.
 *
 * Written for somebody who has never seen this platform. The brief was that a
 * new developer should be able to read it start to finish and understand the
 * whole thing without asking anyone, and that it should be safe to hand to an
 * outside team, so nothing here reveals internal architecture, infrastructure,
 * or another partner's data.
 */

export interface DocsSection {
  id: string;
  title: string;
  /** Paragraphs. Rendered in order. */
  body: string[];
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface ParamSpec {
  name: string;
  in: 'query' | 'body' | 'path';
  type: string;
  required: boolean;
  description: string;
}

/** Plain-language orientation, before any endpoint is mentioned. */
export const OVERVIEW: DocsSection[] = [
  {
    id: 'what-this-is',
    title: 'What this API is for',
    body: [
      'Peptide MD is a private medical consultation service. A patient books twenty minutes with a GMC-registered doctor, by video, to talk through peptide therapy. There is one doctor and one diary.',
      'This API lets you book into that diary from your own website or app. Your patient never leaves your brand and never sees ours. You collect the payment on your side at whatever price you choose; we bill you a fixed fee per appointment at the end of the month.',
      'In practice you are doing three things: asking when the doctor is free, reserving one of those times while your patient fills in their details, and then turning that reservation into a confirmed appointment.',
    ],
  },
  {
    id: 'how-it-fits',
    title: 'How your integration fits together',
    body: [
      'There is a single shared diary behind everything. Appointments booked on the Peptide MD website, appointments booked through the embeddable widget, and appointments booked through this API all compete for the same slots. That is deliberate: it is the only way the doctor is never double booked.',
      'Because the diary is shared, availability is a snapshot and not a reservation. Two of your patients can be shown the same time. Whichever one you hold first gets it, and the other gets a clear, expected refusal that you can recover from.',
      'Every appointment you create is tagged to your account automatically, from the credentials you authenticated with. You never send a partner id, and you cannot create or read an appointment belonging to anyone else.',
    ],
  },
  {
    id: 'sandbox',
    title: 'Sandbox and live',
    body: [
      'You are issued two sets of credentials. The sandbox pair books a completely separate practice diary that no real patient or doctor ever sees. Sandbox appointments are excluded from the real calendar, from reporting, and from your invoice.',
      'Build and test against the sandbox. You can create, reschedule and cancel as many appointments there as you like without consequence. The responses are identical in shape to live, so nothing about your code needs to change when you switch.',
      'The live pair books the doctor’s real diary. Every appointment you confirm with it is a real twenty minutes of a real doctor’s time, and every one of them appears on your monthly invoice. Switch to live only once your flow is finished.',
    ],
  },
];

/** The words this API uses, defined once so nothing has to be inferred. */
export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Slot',
    definition:
      'A single bookable twenty-minute window in the doctor’s diary, identified by the moment it starts. Slots come back from the availability endpoint. Asking for them reserves nothing.',
  },
  {
    term: 'Hold',
    definition:
      'A short-lived reservation on one slot, taken out while your patient is still typing. It locks the time against every other channel, ours included, and expires on its own if you never use it. You get back a hold token.',
  },
  {
    term: 'Hold token',
    definition:
      'The opaque string returned when a hold succeeds. It is your proof that the time belongs to you, and it is the thing you exchange for a confirmed appointment. It can only be spent once.',
  },
  {
    term: 'Booking',
    definition:
      'A confirmed appointment. Created by exchanging a valid hold token together with the patient’s details. Once it exists the patient and the doctor are both emailed, and the appointment is billable.',
  },
  {
    term: 'Reference',
    definition:
      'The human-quotable identifier for a booking, in the form PMD-4821. Use it when talking to us or to your patient about a specific appointment. It is not the id you pass back into the API.',
  },
  {
    term: 'Booking id',
    definition:
      'The machine identifier for a booking, returned as "id". This is what goes in the URL when you reschedule or cancel.',
  },
  {
    term: 'Client id',
    definition:
      'The public half of your credentials, and the username in HTTP Basic auth. Safe to put in a config file. It tells us which partner is calling and whether this is sandbox or live.',
  },
  {
    term: 'Secret',
    definition:
      'The private half of your credentials, and the password in HTTP Basic auth. Shown to you once, when it is issued or rotated, and never again. Store it the way you would store a database password.',
  },
  {
    term: 'Rotation',
    definition:
      'Replacing a secret without downtime. When a new secret is issued the old one keeps working for a short grace period, so you can deploy the change before the old one stops.',
  },
  {
    term: 'Channel',
    definition:
      'Where an appointment came from: direct (our own website) or partner (you). It is what attribution and invoicing rest on, and it is set from your credentials rather than from anything you send.',
  },
  {
    term: 'Attribution',
    definition:
      'The link between an appointment and the partner who sent it. Automatic, and the basis of your monthly invoice.',
  },
  {
    term: 'IANA time zone',
    definition:
      'A time zone written the standard way, such as Europe/London or Australia/Sydney. Send the patient’s own zone so their confirmation email shows times they recognise.',
  },
  {
    term: 'ISO 8601 / UTC',
    definition:
      'The format every timestamp uses, for example 2026-09-14T08:00:00.000Z. The trailing Z means UTC. Send times in UTC and convert for display on your side.',
  },
  {
    term: 'Minor units',
    definition:
      'Money is expressed in the smallest unit of the currency, so £40.00 is 4000. This avoids rounding errors. It appears on invoices rather than in the booking endpoints.',
  },
  {
    term: 'Idempotency',
    definition:
      'Being able to repeat a call safely. A hold token can only be spent once, so if your request times out and you retry, you get HOLD_ALREADY_USED rather than a duplicate appointment.',
  },
];

/** The order the calls go in, written as a first integration. */
export const WALKTHROUGH: { step: number; title: string; body: string; endpoint?: string }[] = [
  {
    step: 1,
    title: 'Authenticate with your sandbox credentials',
    body: 'Every request carries HTTP Basic auth: client id as the username, secret as the password. There is no separate login call and no token to refresh. Start with the sandbox pair so nothing you do reaches a real patient.',
  },
  {
    step: 2,
    title: 'Ask when the doctor is free',
    body: 'Call availability for the window you want to show, and render the slots in your patient’s own time zone. Remember this reserves nothing, so treat it as a snapshot that can go stale.',
    endpoint: 'GET /api/v1/availability',
  },
  {
    step: 3,
    title: 'Hold the slot the moment your patient picks one',
    body: 'As soon as they click a time, hold it. Do this before you show them a details form, not after, or you will lose slots to other channels while they type. Keep the hold token you get back.',
    endpoint: 'POST /api/v1/holds',
  },
  {
    step: 4,
    title: 'Collect the patient’s details',
    body: 'Name, email, phone and their time zone are required. Anything you send as intake is shown to the doctor before the call, which is what makes the twenty minutes useful. Your own reference is optional and is echoed back so you can reconcile.',
  },
  {
    step: 5,
    title: 'Confirm the appointment',
    body: 'Exchange the hold token and the details for a booking. This is the point of no return: the patient and the doctor are emailed, and the appointment becomes billable. You get back the booking id and the reference.',
    endpoint: 'POST /api/v1/bookings',
  },
  {
    step: 6,
    title: 'Handle changes afterwards',
    body: 'Reschedule moves an appointment to a new time, taking the new slot under the same rules. Cancel releases it. Both are scoped to you, so an id belonging to another partner simply does not exist as far as your credentials are concerned.',
    endpoint: 'PATCH and DELETE /api/v1/bookings/:id',
  },
  {
    step: 7,
    title: 'Switch to live',
    body: 'Change the client id and secret to your live pair. Nothing else changes. Watch the first few appointments come through on your side before you send real volume.',
  },
];

/** Parameters, per endpoint path+method key. */
export const PARAMS: Record<string, ParamSpec[]> = {
  'GET /api/v1/availability': [
    {
      name: 'days',
      in: 'query',
      type: 'integer, 1 to 60',
      required: false,
      description: 'How many days ahead to look. Defaults to 21.',
    },
    {
      name: 'from',
      in: 'query',
      type: 'ISO 8601 datetime',
      required: false,
      description: 'Start of the window. Defaults to now. A time in the past is treated as now.',
    },
  ],
  'POST /api/v1/holds': [
    {
      name: 'startsAt',
      in: 'body',
      type: 'ISO 8601 datetime',
      required: true,
      description:
        'The exact slot start returned by availability. It must match a real free slot, so pass the value straight through rather than rebuilding it.',
    },
  ],
  'POST /api/v1/bookings': [
    {
      name: 'holdToken',
      in: 'body',
      type: 'string',
      required: true,
      description: 'The token from your hold. Single use, and it expires.',
    },
    {
      name: 'patient.name',
      in: 'body',
      type: 'string',
      required: true,
      description: 'The patient’s full name, as the doctor should see it.',
    },
    {
      name: 'patient.email',
      in: 'body',
      type: 'email',
      required: true,
      description: 'Where the confirmation and the joining link are sent. Checked for shape.',
    },
    {
      name: 'patient.phone',
      in: 'body',
      type: 'string',
      required: true,
      description: 'Used only if the patient cannot be reached by email on the day.',
    },
    {
      name: 'patient.timezone',
      in: 'body',
      type: 'IANA time zone',
      required: true,
      description:
        'The patient’s own zone, for example Australia/Sydney. Their emails are rendered in it.',
    },
    {
      name: 'intake',
      in: 'body',
      type: 'array of { question, answer }, max 20',
      required: false,
      description:
        'What the doctor reads before the call. Strongly recommended: it is the difference between twenty useful minutes and twenty spent on basics.',
    },
    {
      name: 'reference',
      in: 'body',
      type: 'string, max 120',
      required: false,
      description:
        'Your own identifier for this booking. Stored and echoed back as partnerReference so you can reconcile against your system.',
    },
  ],
  'PATCH /api/v1/bookings/:id': [
    {
      name: 'id',
      in: 'path',
      type: 'string',
      required: true,
      description: 'The booking id returned when the appointment was created.',
    },
    {
      name: 'startsAt',
      in: 'body',
      type: 'ISO 8601 datetime',
      required: true,
      description:
        'The new slot start. Taken under the same contention rules as a hold, so it can come back SLOT_TAKEN.',
    },
  ],
  'DELETE /api/v1/bookings/:id': [
    {
      name: 'id',
      in: 'path',
      type: 'string',
      required: true,
      description: 'The booking id to cancel. The slot is released back into the diary.',
    },
    {
      name: 'reason',
      in: 'body',
      type: 'string',
      required: false,
      description: 'Kept on the record and included in the patient’s cancellation email.',
    },
  ],
  'GET /api/v1/bookings': [
    {
      name: 'from',
      in: 'query',
      type: 'ISO 8601 datetime',
      required: false,
      description: 'Only appointments starting at or after this moment.',
    },
    {
      name: 'to',
      in: 'query',
      type: 'ISO 8601 datetime',
      required: false,
      description: 'Only appointments starting before this moment.',
    },
    {
      name: 'limit',
      in: 'query',
      type: 'integer',
      required: false,
      description: 'Page size. Only your own appointments are ever returned.',
    },
  ],
};

/** Conventions that apply to every call, rather than to one endpoint. */
export const CONVENTIONS: DocsSection[] = [
  {
    id: 'envelope',
    title: 'Every response has the same shape',
    body: [
      'Success and failure both come back in one envelope: success is a boolean, data holds the payload or null, and error holds a human-readable sentence or null. Failures add a code, which is the stable string your code should branch on.',
      'Read the HTTP status for the category and the code for the specific case. Never branch on the wording of error, because that is written for a person and may be improved.',
    ],
  },
  {
    id: 'auth-conventions',
    title: 'Authentication',
    body: [
      'HTTP Basic on every request, over HTTPS. Client id as the username, secret as the password. No session, no bearer token, nothing to refresh.',
      'A wrong secret, an unknown client id, a revoked credential and an expired one all return the same 401 with the same wording. That is deliberate: it means nobody can use the error message to work out which client ids exist.',
      'A suspended partner account returns 403 instead, which is distinct from a credential problem and means the account itself is paused.',
    ],
  },
  {
    id: 'rate-limits',
    title: 'Rate limiting',
    body: [
      'Requests are limited per partner, on a rolling window, at a number set on your account. Going over returns 429. Back off and retry rather than looping.',
      'The limit is generous for a normal booking flow. If you are hitting it, you are most likely polling availability far more often than you need to; fetch it when a patient opens the picker rather than on a timer.',
    ],
  },
  {
    id: 'time',
    title: 'Times and time zones',
    body: [
      'Every timestamp you send or receive is ISO 8601 in UTC, ending in Z. Do not send local times.',
      'Send the patient’s IANA time zone when you confirm a booking. It does not change when the appointment happens; it changes how the appointment is written in their confirmation email, their calendar invite and their reminder.',
    ],
  },
  {
    id: 'errors-are-normal',
    title: 'Some failures are normal',
    body: [
      'SLOT_TAKEN is not a bug and will happen in production. It means somebody else, possibly on another channel entirely, took the time between you reading availability and you holding it. Reload availability and let the patient pick again.',
      'HOLD_EXPIRED means your patient took too long. Send them back to the picker. HOLD_ALREADY_USED almost always means a double submit, and is safe to treat as success for a booking you already have.',
    ],
  },
];
