import Image from 'next/image';
import { cn } from '@/lib/cn';

/**
 * The Peptides MD mark.
 *
 * The supplied artwork is a JPEG on white, so on the dark CTA band it is
 * inverted to a type-only treatment rather than showing a white slab. Replace
 * both with an SVG when one is available.
 */
export function Wordmark({
  className,
  tone = 'ink',
}: {
  className?: string;
  tone?: 'ink' | 'paper';
}) {
  if (tone === 'paper') {
    return (
      <span className={cn('inline-flex min-h-11 items-center gap-2', className)}>
        <span aria-hidden className="flex items-center">
          <span className="h-2 w-2 rounded-full bg-brand-bright" />
          <span className="h-px w-1.5 bg-paper/60" />
          <span className="h-2 w-2 rounded-full bg-paper" />
        </span>
        <span className="font-display text-lg font-semibold tracking-tight text-paper">
          Peptides MD
        </span>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex min-h-11 items-center', className)}>
      <Image
        src="/brand/peptides-md-lockup.png"
        alt="Peptides MD, medical consultations"
        width={480}
        height={240}
        priority
        className="h-11 w-auto mix-blend-multiply sm:h-12"
      />
    </span>
  );
}
