import { Card, CardBody, CardHeader } from '@/components/ui/Card';

/**
 * The partner API reference.
 *
 * Written as data rather than prose so the examples stay in the same shape as
 * each other, and so a reader can skim for the endpoint they need instead of
 * reading a page of paragraphs.
 *
 * Every example here is a real request and a real response body. Two things are
 * deliberately not literals:
 *
 *  - **The base URL**, which is substituted from configuration at render time.
 *    Writing one in by hand means the docs are wrong the moment the API moves,
 *    and a partner copying a stale host gets a connection error rather than
 *    anything that explains itself.
 *  - **The secret**, which exists once, at issue, and is never recoverable.
 *    Printing a plausible-looking one would only teach the reader to expect
 *    something that will not be there.
 */

export interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  detail: string;
  request?: string;
  response: string;
  status: number;
}

export const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/availability',
    summary: 'Times the doctor is free',
    detail:
      'Returns bookable times grouped by date. Nothing is reserved by asking, so two of your patients can be shown the same time. Call POST /holds the moment one of them picks.',
    request: `curl {{BASE}}/api/v1/availability?days=14 \\
  -u "$CLIENT_ID:$SECRET"`,
    response: `{
  "success": true,
  "data": {
    "timezone": "Europe/London",
    "durationMinutes": 20,
    "sandbox": false,
    "days": [
      {
        "date": "2026-09-14",
        "slots": [
          { "startsAt": "2026-09-14T08:00:00.000Z", "endsAt": "2026-09-14T08:20:00.000Z" },
          { "startsAt": "2026-09-14T08:20:00.000Z", "endsAt": "2026-09-14T08:40:00.000Z" }
        ]
      }
    ]
  },
  "error": null
}`,
    status: 200,
  },
  {
    method: 'POST',
    path: '/api/v1/holds',
    summary: 'Reserve a time while your patient fills in their details',
    detail:
      'Locks the slot against every other channel, ours included, and returns a token that expires. If somebody else took it first you get SLOT_TAKEN, which is a normal outcome rather than a failure: reload availability and let your patient choose again.',
    request: `curl -X POST {{BASE}}/api/v1/holds \\
  -u "$CLIENT_ID:$SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{ "startsAt": "2026-09-14T08:00:00.000Z" }'`,
    response: `{
  "success": true,
  "data": {
    "holdToken": "hold_9f2c41ab7e",
    "expiresAt": "2026-09-14T07:52:00.000Z",
    "startsAt": "2026-09-14T08:00:00.000Z",
    "endsAt": "2026-09-14T08:20:00.000Z"
  },
  "error": null
}`,
    status: 200,
  },
  {
    method: 'POST',
    path: '/api/v1/bookings',
    summary: 'Turn a hold into an appointment',
    detail:
      'Confirms the booking, emails the patient and sends the doctor their intake answers. No payment is taken here: you have already charged the patient on your own side, and we bill you per appointment at month end. Send the patient timezone as an IANA name so their confirmation reads in their own clock. Treat joiningUrl as nullable: the consultation happens outside this platform and the link reaches the patient by email.',
    request: `curl -X POST {{BASE}}/api/v1/bookings \\
  -u "$CLIENT_ID:$SECRET" \\
  -H "Content-Type: application/json" \\
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
  }'`,
    response: `{
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
}`,
    status: 201,
  },
  {
    method: 'GET',
    path: '/api/v1/bookings',
    summary: 'The appointments you have sent us',
    detail:
      'Only your own. Intake answers are not returned: they are clinical, between the patient and the doctor, and you are the referrer rather than a party to the consultation.',
    request: `curl {{BASE}}/api/v1/bookings?limit=25 \\
  -u "$CLIENT_ID:$SECRET"`,
    response: `{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": "cmslrpcej003c40ifqkeconlq",
        "reference": "PMD-5104",
        "partnerReference": "your-own-order-8841",
        "status": "confirmed",
        "startsAt": "2026-09-14T08:00:00.000Z",
        "endsAt": "2026-09-14T08:20:00.000Z",
        "patientName": "Ruth Callaghan",
        "patientEmail": "ruth@example.com"
      }
    ]
  },
  "error": null
}`,
    status: 200,
  },
  {
    method: 'PATCH',
    path: '/api/v1/bookings/:id',
    summary: 'Move an appointment',
    detail:
      'Releases the old time and takes the new one in a single step, so the patient never loses their place to somebody else mid change. Both the patient and the doctor are emailed.',
    request: `curl -X PATCH {{BASE}}/api/v1/bookings/cmslrpcej003c40ifqkeconlq \\
  -u "$CLIENT_ID:$SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{ "startsAt": "2026-09-15T09:00:00.000Z" }'`,
    response: `{
  "success": true,
  "data": {
    "id": "cmslrpcej003c40ifqkeconlq",
    "reference": "PMD-5104",
    "status": "confirmed",
    "startsAt": "2026-09-15T09:00:00.000Z",
    "endsAt": "2026-09-15T09:20:00.000Z"
  },
  "error": null
}`,
    status: 200,
  },
  {
    method: 'DELETE',
    path: '/api/v1/bookings/:id',
    summary: 'Cancel an appointment',
    detail:
      'Frees the time immediately for everybody. A cancelled appointment drops off that month’s invoice, so cancel rather than letting a patient simply not attend.',
    request: `curl -X DELETE {{BASE}}/api/v1/bookings/cmslrpcej003c40ifqkeconlq \\
  -u "$CLIENT_ID:$SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{ "reason": "Patient cancelled with us" }'`,
    response: `{
  "success": true,
  "data": {
    "id": "cmslrpcej003c40ifqkeconlq",
    "reference": "PMD-5104",
    "status": "cancelled"
  },
  "error": null
}`,
    status: 200,
  },
];

export const ERROR_CODES: { code: string; status: number; meaning: string }[] = [
  {
    code: 'SLOT_TAKEN',
    status: 409,
    meaning:
      'Somebody booked that time first, from your site, another partner, or ours. Reload availability and offer the patient another time.',
  },
  {
    code: 'SLOT_IN_PAST',
    status: 400,
    meaning: 'The time has already passed. Usually a stale availability response on your side.',
  },
  {
    code: 'HOLD_EXPIRED',
    status: 409,
    meaning:
      'The hold ran out before the booking was confirmed. Take a fresh hold; do not retry with the old token.',
  },
  {
    code: 'HOLD_ALREADY_USED',
    status: 409,
    meaning: 'That hold has already become a booking. Safe to treat as a duplicate submit.',
  },
  {
    code: 'SAME_SLOT',
    status: 400,
    meaning: 'A reschedule was sent for the time the appointment is already at.',
  },
  {
    code: 'NOT_RESCHEDULABLE',
    status: 409,
    meaning: 'The appointment is cancelled or already past, so it cannot be moved.',
  },
];

/** Where the examples say `{{BASE}}`, the configured API origin goes. */
const withBase = (text: string, base: string) => text.split('{{BASE}}').join(base);

export function EndpointCard({ endpoint, baseUrl }: { endpoint: Endpoint; baseUrl: string }) {
  return (
    <Card className="mt-4">
      <CardHeader title={endpoint.summary} description={endpoint.detail} />
      <CardBody>
        {/* Method and path together, monospaced, so the endpoint is scannable
            without reading the summary. */}
        <p className="flex flex-wrap items-center gap-2 font-mono text-micro">
          <span className="rounded border border-line bg-paper-deep px-2 py-0.5 uppercase tracking-[0.1em] text-muted">
            {endpoint.method}
          </span>
          <span className="break-all text-ink">{endpoint.path}</span>
        </p>

        <div className="mt-5">
          {endpoint.request ? (
            <div>
              <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                Request
              </p>
              <CodeBlock>{withBase(endpoint.request, baseUrl)}</CodeBlock>
            </div>
          ) : null}

          <div className={endpoint.request ? 'mt-5' : undefined}>
            <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
              Response · {endpoint.status}
            </p>
            <CodeBlock>{withBase(endpoint.response, baseUrl)}</CodeBlock>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Code sample.
 *
 * `overflow-x-auto` on the pre rather than wrapping: a wrapped curl command
 * with a broken line is something a reader will copy and then wonder why it
 * fails. It scrolls inside its own box so the page itself never scrolls
 * sideways on a phone.
 */
export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded border border-line bg-paper-deep p-4 font-mono text-micro leading-relaxed text-ink">
      <code>{children}</code>
    </pre>
  );
}
