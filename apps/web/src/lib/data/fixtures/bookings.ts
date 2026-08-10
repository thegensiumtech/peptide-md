import type { Booking, BookingChannel, BookingStatus, PaymentStatus } from '@peptide/shared';
import { addMinutes, at } from '@/lib/clock';

const CONSULT_MINUTES = 20;

interface Seed {
  ref: string;
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  tz: string;
  channel: BookingChannel;
  partnerId: string | null;
  status: BookingStatus;
  payment: PaymentStatus;
  concern: string;
  compounds: string;
  history: string;
}

/**
 * Intake is the same five questions for every patient, so it is built rather
 * than repeated per record. These are the answers the doctor reads before the
 * consultation.
 */
function intake(seed: Seed) {
  return [
    { question: 'What would you like to discuss with the doctor?', answer: seed.concern },
    { question: 'Are you currently using any peptides or compounds?', answer: seed.compounds },
    { question: 'Relevant medical history or current medication', answer: seed.history },
    { question: 'Have you had blood work in the last 12 months?', answer: 'Yes — results available' },
    {
      question: 'I understand this is a private consultation and not a prescription service',
      answer: 'Agreed',
    },
  ];
}

const seeds: Seed[] = [
  // --- Upcoming ---
  {
    ref: 'PMD-4871', date: '2026-08-09', time: '13:00', name: 'Aaron Beckett',
    email: 'a.beckett@gmail.com', phone: '+44 7700 900142', tz: 'Europe/London',
    channel: 'direct', partnerId: null, status: 'confirmed', payment: 'paid',
    concern: 'Considering BPC-157 for a recurring achilles injury. Want to know if it is sensible.',
    compounds: 'None currently', history: 'No regular medication. Non-smoker.',
  },
  {
    ref: 'PMD-4872', date: '2026-08-09', time: '22:30', name: 'Chloe Nguyen',
    email: 'chloe.nguyen@outlook.com', phone: '+61 412 553 908', tz: 'Australia/Sydney',
    channel: 'partner', partnerId: 'ptr_newyou', status: 'confirmed', payment: 'paid',
    concern: 'Currently on a GLP-1 and want to understand interactions before adding anything.',
    compounds: 'Semaglutide, prescribed', history: 'Hypothyroidism, on levothyroxine.',
  },
  {
    ref: 'PMD-4873', date: '2026-08-10', time: '09:20', name: 'Tomasz Wolak',
    email: 't.wolak@protonmail.com', phone: '+44 7700 900233', tz: 'Europe/London',
    channel: 'partner', partnerId: 'ptr_fivepeptides', status: 'confirmed', payment: 'paid',
    concern: 'Sleep quality and recovery. Read about CJC-1295 and want a real opinion.',
    compounds: 'None', history: 'Mild hypertension, managed by diet.',
  },
  {
    ref: 'PMD-4874', date: '2026-08-10', time: '14:00', name: 'Fiona Adeyemi',
    email: 'fiona.adeyemi@icloud.com', phone: '+44 7700 900871', tz: 'Europe/London',
    channel: 'direct', partnerId: null, status: 'confirmed', payment: 'paid',
    concern: 'Post-surgical recovery, six weeks after a knee reconstruction.',
    compounds: 'None', history: 'Knee reconstruction June 2026. No other issues.',
  },
  {
    ref: 'PMD-4875', date: '2026-08-11', time: '23:00', name: 'Liam Doherty',
    email: 'liam.doherty@gmail.com', phone: '+61 431 209 774', tz: 'Australia/Melbourne',
    channel: 'partner', partnerId: 'ptr_newyou', status: 'confirmed', payment: 'paid',
    concern: 'Fatigue and slow recovery after training. Not sure peptides are the answer.',
    compounds: 'Creatine, vitamin D', history: 'None significant.',
  },
  {
    ref: 'PMD-4876', date: '2026-08-11', time: '10:40', name: 'Sarah Kingsley',
    email: 's.kingsley@btinternet.com', phone: '+44 7700 900556', tz: 'Europe/London',
    channel: 'direct', partnerId: null, status: 'pending_payment', payment: 'unpaid',
    concern: 'General guidance before starting anything at all.',
    compounds: 'None', history: 'None.',
  },
  {
    ref: 'PMD-4877', date: '2026-08-12', time: '11:20', name: 'Devon Ashworth',
    email: 'devon.ash@gmail.com', phone: '+44 7700 900314', tz: 'Europe/London',
    channel: 'partner', partnerId: 'ptr_fivepeptides', status: 'confirmed', payment: 'paid',
    concern: 'Tendon issues in both elbows from climbing. Physio has plateaued.',
    compounds: 'None', history: 'No medication.',
  },
  {
    ref: 'PMD-4878', date: '2026-08-12', time: '22:00', name: 'Amara Osei',
    email: 'amara.osei@gmail.com', phone: '+61 400 118 262', tz: 'Australia/Brisbane',
    channel: 'partner', partnerId: 'ptr_newyou', status: 'confirmed', payment: 'paid',
    concern: 'Skin and hair changes in the last year, wondering what is worth trying.',
    compounds: 'Topical retinoid', history: 'Iron deficiency, supplementing.',
  },
  {
    ref: 'PMD-4879', date: '2026-08-13', time: '15:40', name: 'Peter Lindqvist',
    email: 'p.lindqvist@gmail.com', phone: '+44 7700 900667', tz: 'Europe/London',
    channel: 'direct', partnerId: null, status: 'confirmed', payment: 'paid',
    concern: 'Second opinion on a protocol suggested by an online clinic.',
    compounds: 'Ipamorelin, self-sourced', history: 'None declared.',
  },
  {
    ref: 'PMD-4880', date: '2026-08-14', time: '09:00', name: 'Ruth Callaghan',
    email: 'ruth.callaghan@nhs.net', phone: '+44 7700 900998', tz: 'Europe/London',
    channel: 'partner', partnerId: 'ptr_fivepeptides', status: 'confirmed', payment: 'paid',
    concern: 'Perimenopause symptoms and whether peptides have any role.',
    compounds: 'HRT patch', history: 'On HRT since March 2026.',
  },

  // --- Past: completed ---
  {
    ref: 'PMD-4840', date: '2026-08-05', time: '10:00', name: 'Gregory Vance',
    email: 'g.vance@gmail.com', phone: '+44 7700 900101', tz: 'Europe/London',
    channel: 'direct', partnerId: null, status: 'completed', payment: 'paid',
    concern: 'Shoulder rehab support.', compounds: 'None', history: 'None.',
  },
  {
    ref: 'PMD-4841', date: '2026-08-05', time: '22:20', name: 'Isabelle Fournier',
    email: 'i.fournier@gmail.com', phone: '+61 422 771 330', tz: 'Australia/Sydney',
    channel: 'partner', partnerId: 'ptr_newyou', status: 'completed', payment: 'paid',
    concern: 'Gut issues and BPC-157 claims.', compounds: 'Probiotic', history: 'IBS diagnosis 2024.',
  },
  {
    ref: 'PMD-4842', date: '2026-08-06', time: '11:40', name: 'Hassan Malik',
    email: 'h.malik@gmail.com', phone: '+44 7700 900447', tz: 'Europe/London',
    channel: 'partner', partnerId: 'ptr_fivepeptides', status: 'completed', payment: 'paid',
    concern: 'Recovery between marathon blocks.', compounds: 'None', history: 'None.',
  },
  {
    ref: 'PMD-4843', date: '2026-08-06', time: '14:20', name: 'Nadia Brennan',
    email: 'nadia.brennan@gmail.com', phone: '+44 7700 900775', tz: 'Europe/London',
    channel: 'direct', partnerId: null, status: 'completed', payment: 'paid',
    concern: 'Wants to stop a protocol safely.', compounds: 'TB-500, eight weeks', history: 'None.',
  },
  {
    ref: 'PMD-4844', date: '2026-08-07', time: '23:20', name: 'Owen Fitzgerald',
    email: 'o.fitzgerald@gmail.com', phone: '+61 433 882 015', tz: 'Australia/Perth',
    channel: 'partner', partnerId: 'ptr_newyou', status: 'completed', payment: 'paid',
    concern: 'Sleep and cognition.', compounds: 'None', history: 'Shift worker.',
  },
  {
    ref: 'PMD-4845', date: '2026-08-07', time: '16:00', name: 'Beatrice Lowell',
    email: 'b.lowell@gmail.com', phone: '+44 7700 900332', tz: 'Europe/London',
    channel: 'partner', partnerId: 'ptr_fivepeptides', status: 'completed', payment: 'paid',
    concern: 'Joint pain, early osteoarthritis.', compounds: 'None', history: 'OA diagnosed 2025.',
  },
  {
    ref: 'PMD-4846', date: '2026-08-08', time: '09:40', name: 'Callum Reid',
    email: 'callum.reid@gmail.com', phone: '+44 7700 900889', tz: 'Europe/London',
    channel: 'direct', partnerId: null, status: 'completed', payment: 'paid',
    concern: 'Fat loss plateau.', compounds: 'None', history: 'None.',
  },
  {
    ref: 'PMD-4847', date: '2026-08-08', time: '22:40', name: 'Mei Tanaka',
    email: 'mei.tanaka@gmail.com', phone: '+61 455 019 663', tz: 'Australia/Sydney',
    channel: 'partner', partnerId: 'ptr_newyou', status: 'completed', payment: 'paid',
    concern: 'Injury recovery timeline.', compounds: 'None', history: 'Stress fracture, healing.',
  },

  // --- Exceptions: cancelled, refunded, failed, no show ---
  {
    ref: 'PMD-4848', date: '2026-08-07', time: '12:00', name: 'Jonah Pryce',
    email: 'j.pryce@gmail.com', phone: '+44 7700 900210', tz: 'Europe/London',
    channel: 'direct', partnerId: null, status: 'cancelled', payment: 'refunded',
    concern: 'Cancelled before the appointment.', compounds: 'None', history: 'None.',
  },
  {
    ref: 'PMD-4849', date: '2026-08-08', time: '15:20', name: 'Elena Marchetti',
    email: 'e.marchetti@gmail.com', phone: '+44 7700 900654', tz: 'Europe/London',
    channel: 'partner', partnerId: 'ptr_fivepeptides', status: 'cancelled', payment: 'unpaid',
    concern: 'Partner-side cancellation.', compounds: 'None', history: 'None.',
  },
  {
    ref: 'PMD-4850', date: '2026-08-08', time: '13:40', name: 'Rory Hendricks',
    email: 'r.hendricks@gmail.com', phone: '+44 7700 900123', tz: 'Europe/London',
    channel: 'direct', partnerId: null, status: 'pending_payment', payment: 'failed',
    concern: 'Card declined at checkout — no slot was ever consumed.',
    compounds: 'None', history: 'None.',
  },
  {
    ref: 'PMD-4851', date: '2026-08-06', time: '16:40', name: 'Sofia Almeida',
    email: 's.almeida@gmail.com', phone: '+44 7700 900468', tz: 'Europe/London',
    channel: 'partner', partnerId: 'ptr_newyou', status: 'no_show', payment: 'paid',
    concern: 'Did not attend.', compounds: 'None', history: 'None.',
  },
];

const CANCELLATION_REASONS: Record<string, string> = {
  'PMD-4848': 'Patient cancelled — 26 hours notice. Refunded in full.',
  'PMD-4849': 'Cancelled by New You Peptides on the patient’s request.',
};

export const bookings: Booking[] = seeds.map((seed, index) => {
  const startsAt = at(seed.date, seed.time);
  return {
    id: `bkg_${seed.ref.toLowerCase().replace('-', '_')}`,
    reference: seed.ref,
    externalBookingId: `cal_${(index + 1).toString().padStart(4, '0')}_${seed.ref.slice(4)}`,
    channel: seed.channel,
    partnerId: seed.partnerId,
    status: seed.status,
    paymentStatus: seed.payment,
    startsAt,
    endsAt: addMinutes(startsAt, CONSULT_MINUTES),
    patientTimezone: seed.tz,
    patientName: seed.name,
    patientEmail: seed.email,
    patientPhone: seed.phone,
    intake: intake(seed),
    // Partner bookings are paid for on the partner's own site, so Peptides MD
    // holds no payment against them — only the billable appointment count.
    amountPaid: seed.channel === 'direct' && seed.payment === 'paid' ? 9500 : null,
    currency: 'GBP',
    createdAt: at(seed.date, '08:00'),
    cancelledAt: seed.status === 'cancelled' ? at(seed.date, '07:30') : null,
    cancellationReason: CANCELLATION_REASONS[seed.ref] ?? null,
  };
});
