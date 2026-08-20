import type { OutgoingEmail } from './index';

export interface BookingEmailContext {
  reference: string;
  patientName: string;
  patientEmail: string;
  patientTimezone: string;
  doctorName: string;
  startsAt: Date;
  endsAt: Date;
  joiningUrl: string | null;
  fromName: string;
  fromEmail: string;
  webUrl: string;
}

function formatIn(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
    timeZoneName: 'short',
  }).format(date);
}

/**
 * Calendar invite.
 *
 * Written by hand rather than pulled from a library: the format is small,
 * stable, and one fewer dependency in the path of every confirmation email.
 * Times are UTC with a trailing Z, which every calendar client resolves to the
 * recipient's own zone.
 */
export function buildIcs(context: BookingEmailContext): string {
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escape = (value: string) => value.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

  const description = context.joiningUrl
    ? `Your consultation with ${context.doctorName}.\\n\\nJoin here: ${context.joiningUrl}\\n\\nReference: ${context.reference}`
    : `Your consultation with ${context.doctorName}.\\n\\nReference: ${context.reference}`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Peptides MD//Consultations//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${context.reference}@peptidemd.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(context.startsAt)}`,
    `DTEND:${stamp(context.endsAt)}`,
    `SUMMARY:${escape(`Consultation with ${context.doctorName}`)}`,
    `DESCRIPTION:${description}`,
    context.joiningUrl ? `URL:${context.joiningUrl}` : '',
    `ORGANIZER;CN=${escape(context.fromName)}:mailto:${context.fromEmail}`,
    `ATTENDEE;CN=${escape(context.patientName)};RSVP=FALSE:mailto:${context.patientEmail}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Consultation in 30 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/** Shared shell. Plain, narrow and readable in every client including Outlook. */
function shell(heading: string, body: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F6F7F5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#12211F;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:1px solid #DDE2DE;border-radius:6px;">
<tr><td style="padding:28px 28px 8px;">
<p style="margin:0 0 20px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6B7A76;">Peptides MD</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;font-weight:600;">${heading}</h1>
${body}
</td></tr>
<tr><td style="padding:8px 28px 28px;border-top:1px solid #DDE2DE;">
<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6B7A76;">${footer}</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (text: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${text}</p>`;

const detailBlock = (rows: Array<[string, string]>) =>
  `<table role="presentation" width="100%" style="margin:18px 0;border:1px solid #DDE2DE;border-radius:4px;">${rows
    .map(
      ([label, value], i) =>
        `<tr${i > 0 ? ' style="border-top:1px solid #DDE2DE;"' : ''}><td style="padding:10px 14px;font-size:12px;color:#6B7A76;">${label}</td><td style="padding:10px 14px;font-size:14px;text-align:right;font-family:ui-monospace,Menlo,monospace;">${value}</td></tr>`
    )
    .join('')}</table>`;

const button = (href: string, label: string) =>
  `<p style="margin:20px 0;"><a href="${href}" style="display:inline-block;background:#B87503;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:3px;font-size:14px;font-weight:500;">${label}</a></p>`;

/**
 * Where the patient goes to move or cancel without writing to anyone. The
 * reference is in the link, so the screen only has to ask them to confirm the
 * address this email was sent to.
 */
const manageUrl = (context: BookingEmailContext) =>
  `${context.webUrl}/manage/${encodeURIComponent(context.reference)}`;

const manageLine = (context: BookingEmailContext) =>
  `<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#6B7A76;">Need to move or cancel? <a href="${manageUrl(context)}" style="color:#B87503;">Manage your appointment</a>, rescheduling is free, and cancelling with more than 24 hours' notice is refunded in full.</p>`;

export function patientConfirmation(context: BookingEmailContext): OutgoingEmail {
  const when = formatIn(context.startsAt, context.patientTimezone);

  const body = [
    p(`Your consultation with ${context.doctorName} is booked.`),
    detailBlock([
      ['When', when],
      ['Reference', context.reference],
    ]),
    context.joiningUrl ? button(context.joiningUrl, 'Join the consultation') : '',
    p(
      'A calendar invite is attached. We will send a reminder the day before with the joining link again.'
    ),
    manageLine(context),
  ].join('');

  return {
    to: context.patientEmail,
    subject: `Your consultation is confirmed, ${when}`,
    text: `Your consultation with ${context.doctorName} is confirmed.\n\nWhen: ${when}\nReference: ${context.reference}\n${context.joiningUrl ? `Join: ${context.joiningUrl}\n` : ''}\nA calendar invite is attached.\n\nMove or cancel: ${manageUrl(context)}`,
    html: shell(
      'You are in the diary.',
      body,
      'Peptides MD provides private medical consultations. We do not supply, prescribe or dispense any compound.'
    ),
    icsContent: buildIcs(context),
    icsFilename: `${context.reference}.ics`,
  };
}

export function doctorNotification(context: BookingEmailContext, doctorEmail: string): OutgoingEmail {
  const when = formatIn(context.startsAt, 'Europe/London');
  const patientLocal = formatIn(context.startsAt, context.patientTimezone);

  return {
    to: doctorEmail,
    subject: `New booking, ${when}`,
    text: `New consultation booked.\n\nPatient: ${context.patientName}\nWhen (your time): ${when}\nPatient's local time: ${patientLocal}\nReference: ${context.reference}`,
    html: shell(
      'New consultation booked.',
      [
        detailBlock([
          ['Patient', context.patientName],
          ['Your time', when],
          ['Their time', patientLocal],
          ['Reference', context.reference],
        ]),
        button(`${context.webUrl}/admin/bookings`, 'Open in the admin panel'),
        p('Their intake answers are on the booking detail screen.'),
      ].join(''),
      'Sent automatically when a booking is confirmed.'
    ),
    icsContent: buildIcs(context),
    icsFilename: `${context.reference}.ics`,
  };
}

export function appointmentReminder(context: BookingEmailContext): OutgoingEmail {
  const when = formatIn(context.startsAt, context.patientTimezone);

  return {
    to: context.patientEmail,
    subject: `Reminder, your consultation is ${when}`,
    text: `A reminder that your consultation with ${context.doctorName} is ${when}.\n\nReference: ${context.reference}\n${context.joiningUrl ? `Join: ${context.joiningUrl}\n` : ''}\nMove or cancel: ${manageUrl(context)}`,
    html: shell(
      'Your consultation is tomorrow.',
      [
        p(`A reminder that you are speaking to ${context.doctorName}.`),
        detailBlock([
          ['When', when],
          ['Reference', context.reference],
        ]),
        context.joiningUrl ? button(context.joiningUrl, 'Join the consultation') : '',
        p('Find somewhere quiet with a decent connection, and have any vials or labels to hand.'),
        manageLine(context),
      ].join(''),
      `Reference ${context.reference}.`
    ),
  };
}

export function cancellationNotice(
  context: BookingEmailContext,
  reason: string,
  refunded: boolean,
  refundRequested = false
): OutgoingEmail {
  const when = formatIn(context.startsAt, context.patientTimezone);

  return {
    to: context.patientEmail,
    subject: `Your consultation on ${when} has been cancelled`,
    text: `Your consultation with ${context.doctorName} on ${when} has been cancelled.\n\n${reason}\n\n${refunded ? 'You have been refunded in full. It usually reaches your account in five to ten working days.' : refundRequested ? 'A refund has been raised for review. We will email you once it is approved.' : ''}\nReference: ${context.reference}`,
    html: shell(
      'Your consultation has been cancelled.',
      [
        p(`Your appointment with ${context.doctorName} on ${when} is cancelled.`),
        reason ? p(reason) : '',
        refunded
          ? p(
              'You have been refunded in full. Refunds usually reach your account within five to ten working days.'
            )
          : '',
        button(`${context.webUrl}/book`, 'Book another time'),
      ].join(''),
      `Reference ${context.reference}. Reply to this email if anything looks wrong.`
    ),
  };
}

export function rescheduleNotice(context: BookingEmailContext, previous: Date): OutgoingEmail {
  const wasWhen = formatIn(previous, context.patientTimezone);
  const nowWhen = formatIn(context.startsAt, context.patientTimezone);

  return {
    to: context.patientEmail,
    subject: `Your consultation has moved to ${nowWhen}`,
    text: `Your consultation with ${context.doctorName} has moved.\n\nWas: ${wasWhen}\nNow: ${nowWhen}\nReference: ${context.reference}`,
    html: shell(
      'Your consultation has moved.',
      [
        detailBlock([
          ['Was', wasWhen],
          ['Now', nowWhen],
          ['Reference', context.reference],
        ]),
        p('An updated calendar invite is attached, accepting it will replace the old entry.'),
      ].join(''),
      'Reply to this email if the new time does not work.'
    ),
    icsContent: buildIcs(context),
    icsFilename: `${context.reference}.ics`,
  };
}

/**
 * The six-digit code that opens the self-service screens.
 *
 * Carries no appointment detail at all, not a date, not a doctor, not a
 * reference. If it reaches the wrong inbox it must give away nothing, and a
 * code sitting in a lock-screen preview should say only that a code arrived.
 */
export function accessCodeNotice(input: {
  to: string;
  code: string;
  minutes: number;
  fromName: string;
  fromEmail: string;
}): OutgoingEmail {
  const spaced = `${input.code.slice(0, 3)} ${input.code.slice(3)}`;

  const body = [
    p('Enter this code to see your appointments:'),
    `<p style="margin:22px 0;text-align:center;font-family:ui-monospace,Menlo,monospace;font-size:34px;letter-spacing:.22em;color:#12211F;">${spaced}</p>`,
    p(`It works once, and expires in ${input.minutes} minutes.`),
    `<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#6B7A76;">If you did not ask for this, ignore it. Nothing has changed, and nobody can see your appointments without this code.</p>`,
  ].join('');

  return {
    to: input.to,
    subject: `${spaced} is your Peptides MD code`,
    text: `Your Peptides MD code is ${input.code}.\n\nIt works once, and expires in ${input.minutes} minutes.\n\nIf you did not ask for this, ignore it, nothing has changed.`,
    html: shell(
      'Your access code',
      body,
      `Sent by ${input.fromName} because someone asked to see appointments booked with this address. We will never ask you for this code by phone or email.`
    ),
  };
}

/** Sent only once a refund has actually left Stripe. */
export function refundConfirmation(
  context: BookingEmailContext,
  amountMinorUnits: number
): OutgoingEmail {
  const amount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: amountMinorUnits % 100 === 0 ? 0 : 2,
  }).format(amountMinorUnits / 100);

  return {
    to: context.patientEmail,
    subject: `Your refund of ${amount} is on its way`,
    text: `Your refund of ${amount} has been approved and sent back to the card you paid with.\n\nIt usually appears within five to ten working days.\n\nReference: ${context.reference}`,
    html: shell(
      'Your refund is on its way.',
      [
        p(`We have sent ${amount} back to the card you paid with.`),
        detailBlock([
          ['Amount', amount],
          ['Reference', context.reference],
        ]),
        p('It usually appears within five to ten working days, depending on your bank.'),
      ].join(''),
      'If it has not arrived after ten working days, reply to this email.'
    ),
  };
}

/** Delivers the lead-magnet guide. */
export function guideDelivery(name: string, to: string, downloadUrl: string): OutgoingEmail {
  const first = name.split(' ')[0] ?? name;
  return {
    to,
    subject: 'Your peptide guide',
    text: `Hi ${first},\n\nHere is the guide: ${downloadUrl}\n\nIt is written by a doctor who has no products to sell, including the parts that say you probably should not take anything.\n\nIf you want that conversation properly, a consultation is twenty minutes and ninety-five pounds.\n\nPeptides MD`,
    html: shell(
      `Here is your guide, ${first}.`,
      [
        p('It is written by a doctor with no products, no suppliers and no affiliate income, including the parts that say you probably should not take anything at all.'),
        button(downloadUrl, 'Download the guide'),
        p('If you would rather ask about your own situation, a consultation is twenty minutes with a GMC-registered doctor.'),
      ].join(''),
      'General information, not medical advice. Peptides MD does not supply, prescribe or dispense any compound.'
    ),
  };
}
