import { GuideForm } from '@/components/guide/GuideForm';
import Image from 'next/image';
import Link from 'next/link';
import { GUIDE, GUIDE_COVER_PATH, minutesInWords } from '@peptide/shared';
import { getConsultation, getNextAvailableSlot } from '@/lib/api/public';
import { formatDate, formatMoney, formatTime, timezoneLabel } from '@/lib/format';
import { ButtonLink } from '@/components/ui/Button';
import {
  ChainMotif,
  PortraitFrame,
  RequisitionCard,
  SectionHeading,
} from '@/components/marketing/Primitives';
import { CtaBand } from '@/components/marketing/CtaBand';

const VIEWER_TZ = 'Europe/London';

export default async function HomePage() {
  const [consultationRes, nextSlot] = await Promise.all([
    getConsultation(),
    getNextAvailableSlot(),
  ]);

  if (!consultationRes.success) {
    throw new Error('Homepage data unavailable');
  }

  const consultation = consultationRes.data;
  const doctor = consultation.doctor;
  const steps = homepageSteps(consultation.durationMinutes);

  return (
    <>
      {/* ---------- Hero: the thesis ---------- */}
      <section className="shell pt-16 sm:pt-24">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-16">
          <div className="animate-rise-in">
            {/* The doctor's line opens the page, at the client's request. It
                sits above the headline as the ethos, sized below the H1 so it
                reads as his voice rather than a second headline. */}
            {doctor.quote ? (
              <figure>
                <blockquote>
                  <p className="font-display font-medium italic leading-[1.06] text-accent text-[clamp(1.75rem,1.2rem+2.2vw,3rem)]">
                    &ldquo;{doctor.quote}&rdquo;
                  </p>
                </blockquote>
                <figcaption className="mt-3 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                  {doctor.name}
                  {doctor.gmcNumber ? ` · GMC ${doctor.gmcNumber}` : ''}
                </figcaption>
              </figure>
            ) : null}

            <h1 className="mt-8 font-display text-hero font-medium tracking-[-0.02em] text-ink">
              Peptides without the{' '}
              <em className="not-italic text-accent">guesswork.</em>
            </h1>
            <p className="mt-7 max-w-xl text-lead text-ink-soft">
              Book a private consultation with a GMC-registered doctor before you start. Get an
              informed opinion from a qualified expert, and an honest read on what is right for
              your goals, rather than what is trending on Instagram.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <ButtonLink href="/book" size="lg">
                Book your consultation ·{' '}
                {formatMoney(consultation.priceAmount, consultation.currency)}
              </ButtonLink>
              <Link
                href="/the-doctor"
                className="link-cta text-sm text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
              >
                Meet {shortName(doctor.name)}
              </Link>
            </div>

            {/* The trust line the client asked for, kept singular: there is one
                doctor on this service, and a plural claim on a medical site
                would be a factual overstatement. "GMC-registered" rather than
                "licensed physician", which is American usage. */}
            <p className="mt-5 text-sm leading-relaxed text-muted">
              GMC-registered doctor. Private and confidential. No obligation, no upsell.
            </p>

            <div className="mt-12 max-w-md">
              <RequisitionCard
                rows={[
                  { label: 'Consultation', value: 'Peptide therapy review' },
                  { label: 'Duration', value: `${consultation.durationMinutes} minutes` },
                  { label: 'Held over', value: 'Video' },
                  // Read from the live diary. When nothing is free, or the
                  // diary cannot be read, the row is left out rather than
                  // showing a date that is no longer true.
                  ...(nextSlot
                    ? [
                        {
                          label: 'Next available',
                          value: `${formatDate(nextSlot, VIEWER_TZ)} · ${formatTime(nextSlot, VIEWER_TZ)}`,
                        },
                      ]
                    : []),
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
            title="Most people trying peptides are guessing."
          />
          <div className="max-w-prose space-y-6 text-lead text-ink-soft">
            <p>
              They are piecing together advice from forums, influencers, and product pages
              written to sell, not to inform. No bloodwork review. No understanding of
              interactions. No idea what &ldquo;correct&rdquo; even looks like for their body.
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
            title="Three steps, and you are in the diary."
            lede="Payment comes first, so the calendar only ever shows times that are genuinely yours to take."
          />

          <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="bg-surface p-6">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="h-2 w-2 rounded-full border border-accent bg-accent" />
                  {index < steps.length - 1 ? (
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
              {/* Each prints only when supplied, as on The doctor page, so an
                  empty heading never shows. */}
              {doctor.gmcNumber ? (
                <div>
                  <dt className="eyebrow">Registration</dt>
                  <dd className="mt-1.5 font-mono text-sm text-ink">GMC {doctor.gmcNumber}</dd>
                </div>
              ) : null}
              {doctor.credentials ? (
                <div>
                  <dt className="eyebrow">Qualifications</dt>
                  <dd className="mt-1.5 font-mono text-sm text-ink">{doctor.credentials}</dd>
                </div>
              ) : null}
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
                  conversation rather than a download.
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

/**
 * Three steps, as the client asked for.
 *
 * His first step folds paying, picking a time and the intake form together.
 * The body still says the fee comes first, because it does: the calendar is
 * only reachable once payment clears, and the copy should not imply otherwise.
 *
 * "Protocol" is deliberately written as a recommendation rather than a
 * prescription. Peptide MD does not prescribe or dispense, and the rest of the
 * page says so plainly.
 */
function homepageSteps(durationMinutes: number) {
  return [
    {
      title: 'Book your slot',
      body: 'A single fee through Stripe, then pick from the doctor’s genuinely free times in your own time zone. A short intake form covers what you are taking and what you want to discuss.',
    },
    {
      title: 'Meet your doctor',
      body: `${minutesInWords(durationMinutes, { capitalise: true })} by video call, one to one, with a doctor who works in this area every week.`,
    },
    {
      title: 'Leave with a plan',
      body: 'A clear recommendation and next steps, written up by email within a day, plus the option to book a follow-up.',
    },
  ];
}

/** 'Dr Mark Jinks' -> 'Dr Jinks'. A name without a title is left as the surname. */
function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const surname = parts[parts.length - 1] ?? fullName;
  return /^dr\.?$/i.test(parts[0] ?? '') && parts.length > 1 ? `Dr ${surname}` : surname;
}
