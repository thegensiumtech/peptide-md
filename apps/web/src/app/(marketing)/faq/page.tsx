import type { Metadata } from 'next';
import Link from 'next/link';
import { getConsultation } from '@/lib/api/public';
import { formatMoney } from '@/lib/format';
import { CtaBand } from '@/components/marketing/Primitives';
import { PageIntro } from '@/components/marketing/PageIntro';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Common questions about booking, payment, what the consultation covers, prescriptions, cancellations, privacy and time zones.',
};

export default async function FaqPage() {
  const consultationRes = await getConsultation();
  if (!consultationRes.success) throw new Error('Consultation details unavailable');
  const consultation = consultationRes.data;
  const fee = formatMoney(consultation.priceAmount, consultation.currency);

  const groups = [
    {
      title: 'The consultation',
      items: [
        {
          q: 'What actually happens in the twenty minutes?',
          a: 'The doctor will have read your intake answers before you join, so it starts at the substance. He will ask about what you are taking, your history and what you are trying to achieve, then give you his opinion and his reasoning. You get a written summary by email within 24 hours.',
        },
        {
          q: 'Can he prescribe me something?',
          a: 'No. This is a consultation, not a prescribing or dispensing service. Peptides MD does not supply any compound. If your situation needs a prescription, he will tell you what to ask your GP or specialist for, and why.',
        },
        {
          q: 'Is it worth booking if I have not started anything yet?',
          a: 'Often it is the better time to book. A large part of what he does is telling people whether the thing they are considering is likely to do anything for the problem they actually have.',
        },
        {
          q: 'Will he just tell me not to take anything?',
          a: 'Sometimes, and he will explain why. Just as often the answer is that what you are doing is reasonable but the dose, the sourcing or the monitoring needs to change.',
        },
      ],
    },
    {
      title: 'Booking and payment',
      items: [
        {
          q: 'Why do I pay before choosing a time?',
          a: `It keeps the diary honest. Taking the ${fee} first means every time on the calendar is genuinely available, and no slot is ever held by a booking that was never paid for.`,
        },
        {
          q: 'What if my payment fails?',
          a: 'Nothing is reserved and nothing is charged. No slot is consumed. You can try again immediately.',
        },
        {
          q: 'Can I move or cancel my appointment?',
          a: 'Yes. Reply to your confirmation email. Rescheduling is free, and a cancellation with more than 24 hours notice is refunded in full.',
        },
        {
          q: 'I am in Australia. Will the times make sense?',
          a: 'Yes. The calendar shows times in your own time zone, and the doctor holds late-evening UK sessions specifically so Australian patients get sensible local times.',
        },
      ],
    },
    {
      title: 'Privacy',
      items: [
        {
          q: 'Who sees what I write on the intake form?',
          a: 'The doctor, and the Peptides MD team who administer bookings. It is not shared with anyone else and it is not used for marketing.',
        },
        {
          q: 'I booked through another company’s website. Who has my data?',
          a: 'The company you booked with holds your booking and payment details, and Peptides MD holds what is needed to run the appointment and the doctor’s clinical record of it. Both are covered by their own privacy policies.',
        },
      ],
    },
  ];

  return (
    <>
      <PageIntro
        eyebrow="Questions"
        title="The things people ask before booking."
        lede="If yours is not here, ask us directly, we would rather answer it than have you guess."
      />

      <section className="shell mt-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-20">
          <nav aria-label="Question categories" className="lg:sticky lg:top-24 lg:self-start">
            <p className="eyebrow">Categories</p>
            <ul className="mt-4 grid gap-2.5 border-l border-line pl-4">
              {groups.map((group) => (
                <li key={group.title}>
                  <a
                    href={`#${slug(group.title)}`}
                    className="text-sm text-muted transition-colors hover:text-ink"
                  >
                    {group.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            {groups.map((group) => (
              <section key={group.title} id={slug(group.title)} className="scroll-mt-24 pb-12">
                <h2 className="font-display text-h2 font-medium tracking-tight text-ink">
                  {group.title}
                </h2>
                <div className="mt-6 border-t border-line">
                  {group.items.map((item) => (
                    // <details> gives keyboard operability and works without JS.
                    <details key={item.q} className="group border-b border-line">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-base font-medium text-ink transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
                        {item.q}
                        <span
                          aria-hidden
                          className="relative mt-2 h-2.5 w-2.5 shrink-0 rounded-full border border-line transition-colors group-open:border-accent group-open:bg-accent"
                        />
                      </summary>
                      <p className="max-w-prose pb-5 text-base leading-relaxed text-muted">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            ))}

            <p className="text-base text-muted">
              Still unsure?{' '}
              <Link href="/contact" className="text-ink underline underline-offset-4">
                Send us the question
              </Link>{' '}
              and we will answer it before you book.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-section">
        <CtaBand />
      </div>
    </>
  );
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
