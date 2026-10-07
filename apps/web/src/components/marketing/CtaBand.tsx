import Link from 'next/link';
import { minutesInWords } from '@peptide/shared';
import { cn } from '@/lib/cn';
import { getConsultation } from '@/lib/api/public';
import { formatMoney } from '@/lib/format';
import { ButtonLink } from '@/components/ui/Button';
import { ChainMotif } from './Primitives';

/** The fee and length a CtaBand line is written from, both read live. */
export interface CtaFacts {
  /** 'Thirty minutes', capitalised to open a sentence. */
  duration: string;
  /** '£195'. */
  fee: string;
}

type CtaCopy = string | ((facts: CtaFacts) => string);

/**
 * Closing call to action, repeated at the foot of every marketing page.
 *
 * The fee and the length are read from the consultation settings, never typed
 * in. Copy that mentions them is passed as a function of those facts, so a
 * price change in the admin panel reaches this band on every page at once.
 */
const DEFAULT_TITLE = 'Talk to the doctor before you take anything else.';

export async function CtaBand({
  title = DEFAULT_TITLE,
  body = ({ duration, fee }) =>
    `${duration}, ${fee}, and an honest answer, including when the answer is that you should not be taking anything at all.`,
  className,
}: {
  title?: CtaCopy;
  body?: CtaCopy;
  className?: string;
}) {
  // If the settings cannot be read, copy built from them is left out rather
  // than failing the whole page or guessing a fee.
  const consultationRes = await getConsultation();
  const facts: CtaFacts | null = consultationRes.success
    ? {
        duration: minutesInWords(consultationRes.data.durationMinutes, { capitalise: true }),
        fee: formatMoney(consultationRes.data.priceAmount, consultationRes.data.currency),
      }
    : null;
  const render = (copy: CtaCopy) =>
    typeof copy === 'function' ? (facts ? copy(facts) : null) : copy;
  const bodyText = render(body);

  return (
    <section className={cn('shell', className)}>
      <div className="relative overflow-hidden rounded-lg border border-line bg-ink px-6 py-12 sm:px-12 sm:py-16">
        <div className="relative max-w-2xl">
          <h2 className="font-display text-h2 font-medium tracking-tight text-paper">{render(title) ?? DEFAULT_TITLE}</h2>
          {bodyText ? <p className="mt-4 text-lead text-paper/70">{bodyText}</p> : null}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/book" size="lg">
              Book a consultation
            </ButtonLink>
            <Link
              href="/how-it-works"
              className="link-cta text-sm text-paper/70 underline decoration-paper/30 underline-offset-4 transition-colors hover:text-paper"
            >
              See how it works
            </Link>
          </div>
        </div>
        {/* Ambient chain, held back so the type stays the loudest thing here. */}
        <ChainMotif className="pointer-events-none absolute -right-8 top-1/2 hidden -translate-y-1/2 text-paper/10 lg:block" />
      </div>
    </section>
  );
}
