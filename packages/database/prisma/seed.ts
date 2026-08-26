/**
 * Seed the development database.
 *
 * Mirrors the fixtures the screens were built against, so the app looks the
 * same after the switch from static data to the live API. Idempotent, safe to
 * re-run.
 *
 *   pnpm --filter @peptide/database db:seed
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import {
  BookingChannel,
  BookingStatus,
  InvoiceStatus,
  OverrideKind,
  PartnerIntegration,
  PartnerStatus,
  PaymentStatus,
  PrismaClient,
  UserRole,
  Weekday,
} from '@prisma/client';

config({ path: resolve(__dirname, '../../../.env.local') });

const prisma = new PrismaClient();

/** Every seeded account shares this password. Development only. */
const DEV_PASSWORD = 'peptide-dev-2026';

const CONSULT_MINUTES = 20;

function at(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}

function plusMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  // --- Settings ----------------------------------------------------------
  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      consultationPrice: 9500,
      consultationDuration: CONSULT_MINUTES,
      consultationSummary:
        'A private video consultation with Dr Jinks about peptide therapy, what you are taking, what you are trying to achieve, and whether it is the right route for you.',
      consultationInclusions: [
        'Twenty minutes of the doctor’s time, one to one',
        'Review of anything you are currently taking',
        'A written summary emailed within 24 hours',
        'A straight answer, including when that answer is no',
      ],
      deliveryNote:
        'The consultation is held over video. Your joining link is in the confirmation email and again in the reminder.',
      defaultPartnerRate: 4000,
      slotHoldMinutes: 10,
    },
  });

  // --- Doctor ------------------------------------------------------------
  const doctor = await prisma.doctor.upsert({
    where: { gmcNumber: '' },
    update: {},
    create: {
      name: 'Dr Mark Jinks',
      credentials: 'MBBS, MRCGP',
      gmcNumber: '7408409',
      photoUrl: '/doctor/peptide-md-doctor.jpg',
      quote: 'Why be well when you can be great?',
      headline: 'A doctor who will tell you when the answer is no.',
      bio: [
        'I\'ve been practising medicine for 13 years. My training began in surgery, focused on orthopaedics, before I moved into general practice, where I\'ve worked for the last six years alongside completing a Master\'s in Sports and Exercise Medicine. Since then my work has spanned sports medicine, longevity and functional medicine, including training with the Institute for Functional Medicine and A4M, health screening with Bupa, NHS work in general practice and complex elderly care, and Medical Director roles for a medical wellness business and a longevity clinic in the Harley Street medical district. I\'ve also worked in sport at elite level, particularly rugby and hockey, building on my own background as a high-performance athlete.',
        'I first came across peptides several years ago through my performance and longevity work. What began as reading and research became formal training with US physicians and institutions specialising in peptide therapeutics, and I\'ve continued building my knowledge and clinical experience since. I was drawn to them for the same reason I was drawn to this field in general: I want to work at the front edge of what\'s possible for health and performance, and to do it properly.',
        'Patients can expect a thorough consultation with genuine attention to detail. I take time to listen and understand the full picture: your current health, your goals and concerns, your medical history and lifestyle. From there I draw on experience across general practice, sports medicine, and performance and longevity medicine to build a detailed plan, starting with the foundations and extending to supplements and more advanced therapies where they\'re right for you.',
        'Patient safety sits at the front of everything I offer. I\'m open-minded about innovative therapies, but every recommendation is individual: a careful review of your background, an honest conversation about the evidence, risks and benefits, and appropriate screening, investigations and follow-up. If I don\'t think something is safe or suitable for you, I\'ll say so and I won\'t recommend it.',
      ].join('\n\n'),
      specialisms: [
        'Sports and performance medicine',
        'Longevity and preventative health',
        'General practice',
        "Men's and women's health screening",
        'Musculoskeletal medicine',
      ],
      languages: ['English'],
      timezone: 'Europe/London',
    },
  });

  // Weekly pattern. The late Tuesday and Thursday windows are what make the
  // Australian side of the business work.
  const windows: Array<[Weekday, string, string]> = [
    [Weekday.MONDAY, '09:00', '12:00'],
    [Weekday.MONDAY, '14:00', '17:00'],
    [Weekday.TUESDAY, '09:00', '12:00'],
    [Weekday.TUESDAY, '21:00', '23:30'],
    [Weekday.WEDNESDAY, '09:00', '12:00'],
    [Weekday.WEDNESDAY, '14:00', '17:00'],
    [Weekday.THURSDAY, '21:00', '23:30'],
    [Weekday.FRIDAY, '09:00', '13:00'],
  ];

  await prisma.availabilityWindow.deleteMany({ where: { doctorId: doctor.id } });
  await prisma.availabilityWindow.createMany({
    data: windows.map(([day, startTime, endTime]) => ({
      doctorId: doctor.id,
      day,
      startTime,
      endTime,
    })),
  });

  // --- Sandbox doctor ------------------------------------------------------
  //
  // Where sandbox credentials book. Separate from the real doctor rather than
  // filtered out of him, because the index that stops double booking is
  // (doctorId, startsAt): on a different doctor a partner's test booking
  // cannot collide with a real appointment even if every filter above it were
  // removed. isActive is false so activeDoctor() can never select him, but
  // availability still resolves when asked for by id, which is what the
  // sandbox needs.
  const sandboxDoctor = await prisma.doctor.upsert({
    where: { gmcNumber: 'SANDBOX' },
    update: {},
    create: {
      name: 'Sandbox Doctor',
      credentials: 'Test fixture',
      gmcNumber: 'SANDBOX',
      headline: 'Not a real doctor. Bookings made here are discarded.',
      bio: 'This record exists so partners can build and test an integration without consuming a real appointment.',
      specialisms: ['Integration testing'],
      languages: ['English'],
      isActive: false,
    },
  });

  await prisma.availabilityWindow.deleteMany({ where: { doctorId: sandboxDoctor.id } });
  await prisma.availabilityWindow.createMany({
    // Wide open, every weekday. A partner testing at 2am should not be blocked
    // by our consulting hours.
    data: (
      [
        Weekday.MONDAY,
        Weekday.TUESDAY,
        Weekday.WEDNESDAY,
        Weekday.THURSDAY,
        Weekday.FRIDAY,
        Weekday.SATURDAY,
        Weekday.SUNDAY,
      ] as Weekday[]
    ).map((day) => ({ doctorId: sandboxDoctor.id, day, startTime: '00:00', endTime: '23:40' })),
  });

  await prisma.availabilityOverride.deleteMany({ where: { doctorId: doctor.id } });
  await prisma.availabilityOverride.createMany({
    data: [
      { doctorId: doctor.id, date: new Date('2026-08-17'), kind: OverrideKind.BLOCKED, note: 'Annual leave' },
      { doctorId: doctor.id, date: new Date('2026-08-18'), kind: OverrideKind.BLOCKED, note: 'Annual leave' },
      {
        doctorId: doctor.id,
        date: new Date('2026-08-20'),
        kind: OverrideKind.EXTRA,
        startTime: '18:00',
        endTime: '20:00',
        note: 'Extra evening session to clear the Australian waiting list',
      },
      {
        doctorId: doctor.id,
        date: new Date('2026-08-26'),
        kind: OverrideKind.BLOCKED,
        startTime: '09:00',
        endTime: '12:00',
        note: 'Clinic commitment, morning only',
      },
    ],
  });

  // --- Partners ----------------------------------------------------------
  const partnerSeeds = [
    {
      slug: 'new-you-peptides',
      name: 'New You Peptides',
      integration: PartnerIntegration.API,
      rate: 4500,
      contactName: 'Dana Whitfield',
      contactEmail: 'dana@newyoupeptides.com.au',
      billingEmail: 'accounts@newyoupeptides.com.au',
      displayName: 'New You Clinic',
      primary: '#0B3C49',
      accent: '#E4572E',
      clientId: 'pmd_live_ny_8f21c4a9',
      status: PartnerStatus.ACTIVE,
      rateLimit: 120,
    },
    {
      slug: 'five-peptides',
      name: 'Five Peptides',
      integration: PartnerIntegration.EMBED,
      rate: 4000,
      contactName: 'Marcus Iles',
      contactEmail: 'marcus@fivepeptides.co.uk',
      billingEmail: 'billing@fivepeptides.co.uk',
      displayName: 'Five Peptides Clinic',
      primary: '#1B1F3B',
      accent: '#C9A227',
      clientId: 'pmd_live_fp_2b70e5d3',
      status: PartnerStatus.ACTIVE,
      rateLimit: 60,
    },
    {
      slug: 'apex-labs',
      name: 'Apex Labs',
      integration: PartnerIntegration.EMBED,
      rate: 4000,
      contactName: 'Priya Raman',
      contactEmail: 'priya@apexlabs.co.uk',
      billingEmail: 'finance@apexlabs.co.uk',
      displayName: 'Apex Labs Consults',
      primary: '#22333B',
      accent: '#5E8C61',
      clientId: 'pmd_test_ax_5e93b118',
      status: PartnerStatus.SUSPENDED,
      rateLimit: 60,
    },
  ];

  const partners = new Map<string, string>();
  for (const seed of partnerSeeds) {
    const partner = await prisma.partner.upsert({
      where: { slug: seed.slug },
      update: {},
      create: {
        name: seed.name,
        slug: seed.slug,
        status: seed.status,
        integration: seed.integration,
        ratePerAppointment: seed.rate,
        contactName: seed.contactName,
        contactEmail: seed.contactEmail,
        billingEmail: seed.billingEmail,
        brandPrimaryColor: seed.primary,
        brandAccentColor: seed.accent,
        brandDisplayName: seed.displayName,
        rateLimitPerMinute: seed.rateLimit,
      },
    });
    partners.set(seed.slug, partner.id);

    // The dev secret is derived from the slug so a verification script can
    // reconstruct it without the seed having to hand it back.
    const liveSecret = `${seed.slug}-dev-secret`;
    await prisma.partnerCredential.upsert({
      where: { clientId: seed.clientId },
      update: {},
      create: {
        partnerId: partner.id,
        clientId: seed.clientId,
        secretHash: await bcrypt.hash(liveSecret, 10),
        // The last four of the secret, which is what the portal shows to say
        // which secret is in use. It was taking them from the client id, which
        // told the reader nothing.
        secretLastFour: liveSecret.slice(-4),
      },
    });

    const sandboxSecret = `${seed.slug}-sandbox-secret`;
    await prisma.partnerCredential.upsert({
      where: { clientId: `${seed.clientId}_sandbox` },
      update: {},
      create: {
        partnerId: partner.id,
        clientId: `${seed.clientId}_sandbox`,
        secretHash: await bcrypt.hash(sandboxSecret, 10),
        secretLastFour: sandboxSecret.slice(-4),
        isSandbox: true,
      },
    });
  }

  // --- Users -------------------------------------------------------------
  const users = [
    { email: 'ross@peptidemd.co.uk', name: 'Ross Calder', role: UserRole.ADMIN, partnerSlug: null, doctorId: null },
    { email: 'mark@peptidemd.co.uk', name: 'Dr Mark Jinks', role: UserRole.DOCTOR, partnerSlug: null, doctorId: doctor.id },
    { email: 'dana@newyoupeptides.com.au', name: 'Dana Whitfield', role: UserRole.PARTNER, partnerSlug: 'new-you-peptides', doctorId: null },
    { email: 'marcus@fivepeptides.co.uk', name: 'Marcus Iles', role: UserRole.PARTNER, partnerSlug: 'five-peptides', doctorId: null },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
        doctorId: user.doctorId,
        partnerId: user.partnerSlug ? partners.get(user.partnerSlug)! : null,
      },
    });
  }

  // --- Bookings ----------------------------------------------------------
  interface BookingSeed {
    ref: string;
    date: string;
    time: string;
    name: string;
    email: string;
    phone: string;
    tz: string;
    partnerSlug: string | null;
    status: BookingStatus;
    payment: PaymentStatus;
    concern: string;
    compounds: string;
    history: string;
  }

  const bookingSeeds: BookingSeed[] = [
    { ref: 'PMD-4871', date: '2026-08-09', time: '13:00', name: 'Aaron Beckett', email: 'a.beckett@gmail.com', phone: '+44 7700 900142', tz: 'Europe/London', partnerSlug: null, status: BookingStatus.CONFIRMED, payment: PaymentStatus.PAID, concern: 'Considering BPC-157 for a recurring achilles injury. Want to know if it is sensible.', compounds: 'None currently', history: 'No regular medication. Non-smoker.' },
    { ref: 'PMD-4872', date: '2026-08-09', time: '22:30', name: 'Chloe Nguyen', email: 'chloe.nguyen@outlook.com', phone: '+61 412 553 908', tz: 'Australia/Sydney', partnerSlug: 'new-you-peptides', status: BookingStatus.CONFIRMED, payment: PaymentStatus.PAID, concern: 'Currently on a GLP-1 and want to understand interactions before adding anything.', compounds: 'Semaglutide, prescribed', history: 'Hypothyroidism, on levothyroxine.' },
    { ref: 'PMD-4873', date: '2026-08-10', time: '09:20', name: 'Tomasz Wolak', email: 't.wolak@protonmail.com', phone: '+44 7700 900233', tz: 'Europe/London', partnerSlug: 'five-peptides', status: BookingStatus.CONFIRMED, payment: PaymentStatus.PAID, concern: 'Sleep quality and recovery. Read about CJC-1295 and want a real opinion.', compounds: 'None', history: 'Mild hypertension, managed by diet.' },
    { ref: 'PMD-4874', date: '2026-08-10', time: '14:00', name: 'Fiona Adeyemi', email: 'fiona.adeyemi@icloud.com', phone: '+44 7700 900871', tz: 'Europe/London', partnerSlug: null, status: BookingStatus.CONFIRMED, payment: PaymentStatus.PAID, concern: 'Post-surgical recovery, six weeks after a knee reconstruction.', compounds: 'None', history: 'Knee reconstruction June 2026.' },
    { ref: 'PMD-4875', date: '2026-08-11', time: '23:00', name: 'Liam Doherty', email: 'liam.doherty@gmail.com', phone: '+61 431 209 774', tz: 'Australia/Melbourne', partnerSlug: 'new-you-peptides', status: BookingStatus.CONFIRMED, payment: PaymentStatus.PAID, concern: 'Fatigue and slow recovery after training. Not sure peptides are the answer.', compounds: 'Creatine, vitamin D', history: 'None significant.' },
    { ref: 'PMD-4876', date: '2026-08-11', time: '10:40', name: 'Sarah Kingsley', email: 's.kingsley@btinternet.com', phone: '+44 7700 900556', tz: 'Europe/London', partnerSlug: null, status: BookingStatus.PENDING_PAYMENT, payment: PaymentStatus.UNPAID, concern: 'General guidance before starting anything at all.', compounds: 'None', history: 'None.' },
    { ref: 'PMD-4877', date: '2026-08-12', time: '11:20', name: 'Devon Ashworth', email: 'devon.ash@gmail.com', phone: '+44 7700 900314', tz: 'Europe/London', partnerSlug: 'five-peptides', status: BookingStatus.CONFIRMED, payment: PaymentStatus.PAID, concern: 'Tendon issues in both elbows from climbing. Physio has plateaued.', compounds: 'None', history: 'No medication.' },
    { ref: 'PMD-4878', date: '2026-08-12', time: '22:00', name: 'Amara Osei', email: 'amara.osei@gmail.com', phone: '+61 400 118 262', tz: 'Australia/Brisbane', partnerSlug: 'new-you-peptides', status: BookingStatus.CONFIRMED, payment: PaymentStatus.PAID, concern: 'Skin and hair changes in the last year, wondering what is worth trying.', compounds: 'Topical retinoid', history: 'Iron deficiency, supplementing.' },
    { ref: 'PMD-4879', date: '2026-08-13', time: '15:40', name: 'Peter Lindqvist', email: 'p.lindqvist@gmail.com', phone: '+44 7700 900667', tz: 'Europe/London', partnerSlug: null, status: BookingStatus.CONFIRMED, payment: PaymentStatus.PAID, concern: 'Second opinion on a protocol suggested by an online clinic.', compounds: 'Ipamorelin, self-sourced', history: 'None declared.' },
    { ref: 'PMD-4880', date: '2026-08-14', time: '09:00', name: 'Ruth Callaghan', email: 'ruth.callaghan@nhs.net', phone: '+44 7700 900998', tz: 'Europe/London', partnerSlug: 'five-peptides', status: BookingStatus.CONFIRMED, payment: PaymentStatus.PAID, concern: 'Perimenopause symptoms and whether peptides have any role.', compounds: 'HRT patch', history: 'On HRT since March 2026.' },
    { ref: 'PMD-4840', date: '2026-08-05', time: '10:00', name: 'Gregory Vance', email: 'g.vance@gmail.com', phone: '+44 7700 900101', tz: 'Europe/London', partnerSlug: null, status: BookingStatus.COMPLETED, payment: PaymentStatus.PAID, concern: 'Shoulder rehab support.', compounds: 'None', history: 'None.' },
    { ref: 'PMD-4841', date: '2026-08-05', time: '22:20', name: 'Isabelle Fournier', email: 'i.fournier@gmail.com', phone: '+61 422 771 330', tz: 'Australia/Sydney', partnerSlug: 'new-you-peptides', status: BookingStatus.COMPLETED, payment: PaymentStatus.PAID, concern: 'Gut issues and BPC-157 claims.', compounds: 'Probiotic', history: 'IBS diagnosis 2024.' },
    { ref: 'PMD-4842', date: '2026-08-06', time: '11:40', name: 'Hassan Malik', email: 'h.malik@gmail.com', phone: '+44 7700 900447', tz: 'Europe/London', partnerSlug: 'five-peptides', status: BookingStatus.COMPLETED, payment: PaymentStatus.PAID, concern: 'Recovery between marathon blocks.', compounds: 'None', history: 'None.' },
    { ref: 'PMD-4843', date: '2026-08-06', time: '14:20', name: 'Nadia Brennan', email: 'nadia.brennan@gmail.com', phone: '+44 7700 900775', tz: 'Europe/London', partnerSlug: null, status: BookingStatus.COMPLETED, payment: PaymentStatus.PAID, concern: 'Wants to stop a protocol safely.', compounds: 'TB-500, eight weeks', history: 'None.' },
    { ref: 'PMD-4844', date: '2026-08-07', time: '23:20', name: 'Owen Fitzgerald', email: 'o.fitzgerald@gmail.com', phone: '+61 433 882 015', tz: 'Australia/Perth', partnerSlug: 'new-you-peptides', status: BookingStatus.COMPLETED, payment: PaymentStatus.PAID, concern: 'Sleep and cognition.', compounds: 'None', history: 'Shift worker.' },
    { ref: 'PMD-4845', date: '2026-08-07', time: '16:00', name: 'Beatrice Lowell', email: 'b.lowell@gmail.com', phone: '+44 7700 900332', tz: 'Europe/London', partnerSlug: 'five-peptides', status: BookingStatus.COMPLETED, payment: PaymentStatus.PAID, concern: 'Joint pain, early osteoarthritis.', compounds: 'None', history: 'OA diagnosed 2025.' },
    { ref: 'PMD-4846', date: '2026-08-08', time: '09:40', name: 'Callum Reid', email: 'callum.reid@gmail.com', phone: '+44 7700 900889', tz: 'Europe/London', partnerSlug: null, status: BookingStatus.COMPLETED, payment: PaymentStatus.PAID, concern: 'Fat loss plateau.', compounds: 'None', history: 'None.' },
    { ref: 'PMD-4847', date: '2026-08-08', time: '22:40', name: 'Mei Tanaka', email: 'mei.tanaka@gmail.com', phone: '+61 455 019 663', tz: 'Australia/Sydney', partnerSlug: 'new-you-peptides', status: BookingStatus.COMPLETED, payment: PaymentStatus.PAID, concern: 'Injury recovery timeline.', compounds: 'None', history: 'Stress fracture, healing.' },
    { ref: 'PMD-4848', date: '2026-08-07', time: '12:00', name: 'Jonah Pryce', email: 'j.pryce@gmail.com', phone: '+44 7700 900210', tz: 'Europe/London', partnerSlug: null, status: BookingStatus.CANCELLED, payment: PaymentStatus.REFUNDED, concern: 'Cancelled before the appointment.', compounds: 'None', history: 'None.' },
    { ref: 'PMD-4849', date: '2026-08-08', time: '15:20', name: 'Elena Marchetti', email: 'e.marchetti@gmail.com', phone: '+44 7700 900654', tz: 'Europe/London', partnerSlug: 'five-peptides', status: BookingStatus.CANCELLED, payment: PaymentStatus.UNPAID, concern: 'Partner-side cancellation.', compounds: 'None', history: 'None.' },
    { ref: 'PMD-4850', date: '2026-08-08', time: '13:40', name: 'Rory Hendricks', email: 'r.hendricks@gmail.com', phone: '+44 7700 900123', tz: 'Europe/London', partnerSlug: null, status: BookingStatus.PENDING_PAYMENT, payment: PaymentStatus.FAILED, concern: 'Card declined at checkout, no slot was ever consumed.', compounds: 'None', history: 'None.' },
    { ref: 'PMD-4851', date: '2026-08-06', time: '16:40', name: 'Sofia Almeida', email: 's.almeida@gmail.com', phone: '+44 7700 900468', tz: 'Europe/London', partnerSlug: 'new-you-peptides', status: BookingStatus.NO_SHOW, payment: PaymentStatus.PAID, concern: 'Did not attend.', compounds: 'None', history: 'None.' },
  ];

  const INTAKE_QUESTIONS = [
    'What would you like to discuss with the doctor?',
    'Are you currently using any peptides or compounds?',
    'Relevant medical history or current medication',
    'Have you had blood work in the last 12 months?',
    'I understand this is a private consultation and not a prescription service',
  ];

  for (const seed of bookingSeeds) {
    const patient = await prisma.patient.upsert({
      where: { email: seed.email },
      update: {},
      create: { email: seed.email, name: seed.name, phone: seed.phone, timezone: seed.tz },
    });

    const startsAt = at(seed.date, seed.time);
    const partnerId = seed.partnerSlug ? partners.get(seed.partnerSlug)! : null;

    const booking = await prisma.booking.upsert({
      where: { reference: seed.ref },
      update: {},
      create: {
        reference: seed.ref,
        doctorId: doctor.id,
        patientId: patient.id,
        channel: partnerId ? BookingChannel.PARTNER : BookingChannel.DIRECT,
        partnerId,
        status: seed.status,
        paymentStatus: seed.payment,
        startsAt,
        endsAt: plusMinutes(startsAt, CONSULT_MINUTES),
        patientTimezone: seed.tz,
        // Partner bookings are paid on the partner's own site, so Peptide MD
        // holds no payment against them, only the billable count.
        amountPaid: !partnerId && seed.payment === PaymentStatus.PAID ? 9500 : null,
        cancelledAt: seed.status === BookingStatus.CANCELLED ? at(seed.date, '07:30') : null,
        cancellationReason:
          seed.status === BookingStatus.CANCELLED
            ? 'Cancelled with more than 24 hours notice.'
            : null,
      },
    });

    const existingIntake = await prisma.intakeResponse.count({ where: { bookingId: booking.id } });
    if (existingIntake === 0) {
      await prisma.intakeResponse.createMany({
        data: [
          { bookingId: booking.id, question: INTAKE_QUESTIONS[0]!, answer: seed.concern, position: 0 },
          { bookingId: booking.id, question: INTAKE_QUESTIONS[1]!, answer: seed.compounds, position: 1 },
          { bookingId: booking.id, question: INTAKE_QUESTIONS[2]!, answer: seed.history, position: 2 },
          { bookingId: booking.id, question: INTAKE_QUESTIONS[3]!, answer: 'Yes, results available', position: 3 },
          { bookingId: booking.id, question: INTAKE_QUESTIONS[4]!, answer: 'Agreed', position: 4 },
        ],
      });
    }
  }

  // --- Historic invoices --------------------------------------------------
  const invoiceSeeds = [
    { number: 'INV-2026-07-NEWYOU', slug: 'new-you-peptides', period: '2026-07', count: 60, rate: 4500, status: InvoiceStatus.PAID, issued: '2026-08-01', due: '2026-08-15', paid: '2026-08-06' },
    { number: 'INV-2026-07-FIVEPEP', slug: 'five-peptides', period: '2026-07', count: 45, rate: 4000, status: InvoiceStatus.SENT, issued: '2026-08-01', due: '2026-08-15', paid: null },
    { number: 'INV-2026-06-NEWYOU', slug: 'new-you-peptides', period: '2026-06', count: 41, rate: 4500, status: InvoiceStatus.PAID, issued: '2026-07-01', due: '2026-07-15', paid: '2026-07-09' },
    { number: 'INV-2026-06-FIVEPEP', slug: 'five-peptides', period: '2026-06', count: 28, rate: 4000, status: InvoiceStatus.OVERDUE, issued: '2026-07-01', due: '2026-07-15', paid: null },
  ];

  for (const seed of invoiceSeeds) {
    await prisma.invoice.upsert({
      where: { number: seed.number },
      update: {},
      create: {
        number: seed.number,
        partnerId: partners.get(seed.slug)!,
        period: seed.period,
        appointmentCount: seed.count,
        ratePerAppointment: seed.rate,
        totalAmount: seed.count * seed.rate,
        status: seed.status,
        issuedAt: new Date(seed.issued),
        dueAt: new Date(seed.due),
        paidAt: seed.paid ? new Date(seed.paid) : null,
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    doctors: await prisma.doctor.count(),
    partners: await prisma.partner.count(),
    patients: await prisma.patient.count(),
    bookings: await prisma.booking.count(),
    invoices: await prisma.invoice.count(),
  };

  console.log('Seeded:', counts);
  console.log(`All accounts use the password: ${DEV_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
