import { GuideForm } from '@/components/guide/GuideForm';
import Image from 'next/image';
import Link from 'next/link';
import { GUIDE, GUIDE_COVER_PATH } from '@peptide/shared';
import { getAvailableDays } from '@/lib/data/client';
import { getConsultation } from '@/lib/api/public';
import { formatDate, formatMoney, formatTime, timezoneLabel } from '@/lib/format';
import { ButtonLink } from '@/components/ui/Button';
import {
  ChainMotif,
  CtaBand,
  PortraitFrame,
  RequisitionCard,
  SectionHeading,
} from '@/components/marketing/Primitives';

const VIEWER_TZ = 'Europe/London';

export default async function HomePage() {
  const [consultationRes, daysRes] = await Promise.all([getConsultation(), getAvailableDays()]);

  if (!consultationRes.success || !daysRes.success) {
    throw new Error('Homepage data unavailable');
  }

  const consultation = consultationRes.data;
  const doctor = consultation.doctor;
  const nextSlot = daysRes.data[0]?.slots.find((s) => s.available) ?? null;

  return (
    <>
      {/* ---------- Hero: the thesis ---------- */}
      <section className="shell pt-16 sm:pt-24">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-16">
          <div className="animate-rise-in">
            <p className="eyebrow">Private consultation · UK registered</p>
            <h1 className="mt-6 font-display text-hero font-medium tracking-[-0.02em] text-ink">
              Ask a doctor who has{' '}
              <em className="not-italic text-accent">nothing to sell you.</em>
            </h1>
            <p className="mt-7 max-w-xl text-lead text-ink-soft">
              Everyone in this market is selling a compound. {doctor.name} is selling twenty
              minutes of his time. Tell him what you are taking and what you are trying to fix,
              and he will tell you what he actually thinks.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <ButtonLink href="/book" size="lg">
                Book a consultation
              </ButtonLink>
              <Link
                href="/the-doctor"
                className="link-cta text-sm text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
              >
                Meet {doctor.name.split(' ').slice(-1)[0]}
              </Link>
            </div>

            <div className="mt-12 max-w-md">
              <RequisitionCard
                rows={[
                  { label: 'Consultation', value: 'Peptide therapy review' },
                  { label: 'Duration', value: `${consultation.durationMinutes} minutes` },
                  { label: 'Held over', value: 'Video' },
                  {
                    label: 'Next available',
                    value: nextSlot
                      ? `${formatDate(nextSlot.startsAt, VIEWER_TZ)} · ${formatTime(nextSlot.startsAt, VIEWER_TZ)}`
                      : 'Contact us',
                  },
                  {
                    label: 'Fee',
                    value: formatMoney(consultation.priceAmount, consultation.currency),
                    emphasis: true,
                  },
                ]}
              />
              <p className="mt-3 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                Times shown in {timezoneLabel(VIEWER_TZ)}
              </p>
            </div>
          </div>

          <PortraitFrame
            name={doctor.name}
            credentials={doctor.credentials}
            gmcNumber={doctor.gmcNumber}
            photoUrl={doctor.photoUrl}
            priority
            className="mx-auto w-full max-w-sm lg:sticky lg:top-24"
          />
        </div>
      </section>

      {/* ---------- The problem ---------- */}
      <section className="shell mt-section">
        <div className="rule" />
        <div className="grid gap-10 pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20">
          <SectionHeading
            eyebrow="Why this exists"
            title="Most people taking peptides have never been examined."
          />
          <div className="max-w-prose space-y-6 text-lead text-ink-soft">
            <p>
              They arrive with a protocol found on a forum, a box of vials from a supplier, and
              nobody willing to look at it with them. The supplier will not, they are not a
              clinician. The GP often will not, it is outside what they see.
            </p>
            <p>
              That gap is where people get hurt: interactions nobody checked, doses nobody
              questioned, and symptoms nobody connected to what was being injected.
            </p>
            <p className="text-ink">
              Peptide MD is one thing only, a consultation with a doctor who knows this area and
              has no financial interest in what you decide.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="mt-section bg-paper-deep py-section">
        <div className="shell">
          <SectionHeading
            eyebrow="The sequence"
            title="Four steps, and you are in the diary."
            lede="Payment comes first, so the calendar only ever shows times that are genuinely yours to take."
          />

          <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="bg-surface p-6">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="h-2 w-2 rounded-full border border-accent bg-accent" />
                  {index < STEPS.length - 1 ? (
                    <span aria-hidden className="h-px w-6 bg-line" />
                  ) : null}
                </div>
                <h3 className="mt-5 font-display text-h3 font-medium text-ink">{step.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10">
            <Link
              href="/how-it-works"
              className="link-cta text-sm text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
            >
              Read the full process
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- What is covered ---------- */}
      <section className="shell mt-section">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <div>
            <SectionHeading eyebrow="What you get" title="What the consultation covers." />
            <ul className="mt-8 divide-y divide-line border-y border-line">
              {consultation.inclusions.map((item) => (
                <li key={item} className="flex items-start gap-4 py-4">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal"
                  />
                  <span className="text-base text-ink-soft">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm leading-relaxed text-muted">
              {consultation.deliveryNote}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-line bg-surface p-8 sm:p-10">
            <p className="eyebrow">What it is not</p>
            <ul className="mt-6 space-y-5 text-base leading-relaxed text-ink-soft">
              <li>
                <span className="text-ink">Not a supplier.</span> Peptide MD does not sell,
                prescribe or dispense any compound.
              </li>
              <li>
                <span className="text-ink">Not a subscription.</span> One consultation, one fee.
                Book again only if you want to.
              </li>
              <li>
                <span className="text-ink">Not a rubber stamp.</span> If the honest answer is that
                you should stop, that is the answer you will get.
              </li>
            </ul>
            <ChainMotif className="pointer-events-none absolute -bottom-10 -right-10 text-line" />
          </div>
        </div>
      </section>

      {/* ---------- The doctor ---------- */}
      <section className="shell mt-section">
        <div className="rule" />
        <div className="grid gap-10 pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20">
          <SectionHeading eyebrow="The doctor" title={doctor.headline} />
          <div className="max-w-prose">
            <p className="text-lead leading-relaxed text-ink-soft">
              {doctor.bio.split('\n\n')[0]}
            </p>
            <dl className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="eyebrow">Registration</dt>
                <dd className="mt-1.5 font-mono text-sm text-ink">GMC {doctor.gmcNumber}</dd>
              </div>
              <div>
                <dt className="eyebrow">Qualifications</dt>
                <dd className="mt-1.5 font-mono text-sm text-ink">{doctor.credentials}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="eyebrow">Areas</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {doctor.specialisms.map((s) => (
                    <span
                      key={s}
                      className="rounded border border-line bg-surface px-2.5 py-1 text-micro text-ink-soft"
                    >
                      {s}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
            <Link
              href="/the-doctor"
              className="link-cta mt-8 inline-block text-sm text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
            >
              Read his full background
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-section">
        <section className="shell">
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <div className="grid gap-10 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,0.62fr)_minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-12">
              {/* The cover, small and tilted. One glance says this is a real
                  document rather than a mailing-list signup. */}
              <Link href="/guide" className="group relative mx-auto w-40 shrink-0 lg:w-full lg:max-w-[11rem]">
                <span
                  aria-hidden
                  className="absolute inset-x-2 -bottom-1 top-2 rounded-sm bg-line"
                />
                <Image
                  src={GUIDE_COVER_PATH}
                  alt=""
                  width={1588}
                  height={2246}
                  sizes="11rem"
                  className="relative w-full rounded-sm shadow-[0_18px_36px_-14px_rgb(var(--ink)/0.45)] ring-1 ring-line transition-transform duration-normal group-hover:-translate-y-1"
                />
              </Link>

              <div>
                <p className="eyebrow">Free guide · {GUIDE.pages} pages</p>
                <h2 className="mt-4 font-display text-h2 font-medium tracking-tight text-ink">
                  What a doctor would actually tell you about peptides.
                </h2>
                <p className="mt-4 max-w-lg text-lead leading-relaxed text-muted">
                  Almost everything written about peptides is written by someone selling them. This
                  is not, including the parts that say you probably should not take anything.
                </p>
                <p className="mt-4 text-micro text-muted">
                  {GUIDE.compounds} compounds assessed. No dosing protocols, because that is a
                  conversation, not a download.
                </p>
              </div>

              <div>
                <GuideForm source="homepage" />
              </div>
            </div>
          </div>
        </section>

        <CtaBand />
      </div>
    </>
  );
}

const STEPS = [
  {
    title: 'Pay',
    body: 'A single fee, taken through Stripe. Nothing is held in the diary until the payment clears.',
  },
  {
    title: 'Choose a time',
    body: 'The doctor’s genuinely free times, shown in your own time zone. Pick one and it is locked to you.',
  },
  {
    title: 'Tell him why',
    body: 'A short form covering what you are taking and what you want to discuss, so no time is spent on basics.',
  },
  {
    title: 'Talk',
    body: 'Twenty minutes over video, then a written summary by email within a day.',
  },
];
