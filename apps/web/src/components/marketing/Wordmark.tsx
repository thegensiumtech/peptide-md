import { cn } from '@/lib/cn';

/**
 * Placeholder wordmark. Ross's real logo replaces this — it is deliberately
 * type-only so there is nothing to unpick when the brand assets arrive.
 *
 * The two linked residues stand in for the peptide bond that runs through the
 * rest of the identity.
 */
export function Wordmark({
  className,
  tone = 'ink',
}: {
  className?: string;
  tone?: 'ink' | 'paper';
}) {
  return (
    <span className={cn('inline-flex min-h-11 items-center gap-2', className)}>
      <span aria-hidden className="flex items-center">
        <span
          className={cn(
            'h-2 w-2 rounded-full border',
            tone === 'ink' ? 'border-ink bg-ink' : 'border-paper bg-paper'
          )}
        />
        <span className={cn('h-px w-1.5', tone === 'ink' ? 'bg-ink' : 'bg-paper')} />
        <span className="h-2 w-2 rounded-full border border-amber bg-amber" />
      </span>
      <span
        className={cn(
          'font-display text-lg font-semibold tracking-tight',
          tone === 'ink' ? 'text-ink' : 'text-paper'
        )}
      >
        Peptide MD
      </span>
    </span>
  );
}
