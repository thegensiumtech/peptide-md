import type { Metadata } from 'next';
import Link from 'next/link';
import { getConsultation } from '@/lib/api/public';
import { formatMoney } from '@/lib/format';
import { CtaBand, SectionHeading } from '@/components/marketing/Primitives';
import { PageIntro } from '@/components/marketing/PageIntro';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Pay, choose a time from the doctor’s live availability, tell him what the consultation is about, and talk. Here is exactly what happens at each step.',
};

export default async function HowItWorksPage() {
  const consultationRes = await getConsultation();
  if (!consultationRes.success) throw new Error('Consultation details unavailable');
  const consultation = consultationRes.data;

  const steps = [
    {
      title: 'You pay first',
      body: `The fee is ${formatMoney(consultation.priceAmount, consultation.currency)} and it is taken through Stripe before you see the calendar. This is deliberate. It means every time shown on the next screen is genuinely available, and it means a slot is never held by a booking that was never paid for.`,
      detail: 'If a payment fails or you close the browser, nothing is reserved and nothing is charged.',
    },
    {
      title: 'You choose a time',
      body: 'The calendar shows the doctor’s real availability, in your own time zone. Nothing is converted in your head, a patient in Sydney sees Sydney times.',
      detail: 'The moment you select a time it is locked to you, so nobody on any other site can take it while you finish.',
    },
    {
      title: 'You tell him why',
      body: 'A short form: what you are taking, what you want to discuss, and anything in your history that matters. It takes two minutes and it means the consultation starts at the useful part.',
      detail: 'Your answers go only to the doctor, and are covered by the privacy policy.',
    },
    {
      title: 'You talk',
      body: `${consultation.durationMinutes} minutes over video. He will ask questions, look at what you are doing, and tell you what he thinks, including when he thinks you should stop.`,
      detail: 'A written summary follows by email within 24 hours.',
    },
  ];

  return (
    <>
      <PageIntro
        eyebrow="The process"
        title="Four steps, no surprises."
        lede="The order matters, and it is not the order most booking sites use. Here is why."
      />

      <section className="shell mt-16">
        <ol className="border-t border-line">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="grid gap-6 border-b border-line py-10 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] lg:gap-12"
            >
              <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-2">
                <span className="font-mono text-eyebrow uppercase tracking-[0.16em] text-muted">
                  Step {index + 1}
                </span>
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full border border-accent bg-accent"
                />
              </div>
              <h2 className="font-display text-h2 font-medium tracking-tight text-ink">
                {step.title}
              </h2>
              <div className="max-w-prose">
                <p className="text-lead leading-relaxed text-ink-soft">{step.body}</p>
                <p className="mt-4 border-l-2 border-line pl-4 text-sm leading-relaxed text-muted">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="shell mt-section">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20">
          <SectionHeading
            eyebrow="One shared diary"
            title="Why a time can disappear while you are looking at it."
          />
          <div className="max-w-prose space-y-5 text-lead leading-relaxed text-ink-soft">
            <p>
              The doctor has one calendar. It is read by this website and by every partner clinic
              that offers his consultations inside their own site.
            </p>
            <p>
              That means two people in different places can reach for the same time at the same
              moment. When that happens, the first to select it gets it and the second is told
              immediately, before any money changes hands.
            </p>
            <p className="text-ink">
              It is the same reason a slot you select is held for you straight away rather than at
              the end, so the time you picked is still there when you finish.
            </p>
          </div>
        </div>
      </section>

      <section className="shell mt-section">
        <div className="rounded-lg border border-line bg-surface p-8 sm:p-10">
          <p className="eyebrow">If something goes wrong</p>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            <div>
              <h3 className="text-base font-semibold text-ink">Payment fails</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                No slot is consumed and no booking is created. Try again, or{' '}
                <Link href="/contact" className="text-ink underline underline-offset-2">
                  contact us
                </Link>
                .
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink">You need to move it</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Reply to your confirmation email. Rescheduling is free with more than 24 hours
                notice.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink">You need to cancel</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Cancel with more than 24 hours notice and you are refunded in full. The terms set
                out the detail.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-section">
        <CtaBand />
      </div>
    </>
  );
}
