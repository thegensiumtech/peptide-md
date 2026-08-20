import Image from 'next/image';
import { cn } from '@/lib/cn';

/**
 * The Peptide MD mark.
 *
 * The supplied artwork is a JPEG on white, so both variants here are cut out
 * against transparency, luminance-keyed from the original. That matters more
 * than it sounds: a white-backed PNG only disappears on a pure white surface,
 * and the header sits on a translucent backdrop once the page scrolls.
 *
 * `paper` is the same artwork knocked out to white for the dark bands.
 */
const LOCKUP = {
  ink: '/brand/peptide-md-lockup-transparent.png',
  paper: '/brand/peptide-md-lockup-white.png',
} as const;

export function Wordmark({
  className,
  tone = 'ink',
}: {
  className?: string;
  tone?: 'ink' | 'paper';
}) {
  return (
    <span className={cn('inline-flex min-h-11 items-center', className)}>
      <Image
        src={LOCKUP[tone]}
        alt="Peptide MD, medical consultations"
        width={560}
        height={317}
        priority={tone === 'ink'}
        className="h-11 w-auto sm:h-12"
      />
    </span>
  );
}
