import { cn } from '@/lib/cn';

export interface SequenceStep {
  id: string;
  label: string;
}

/**
 * The sequence rail — the platform's signature element.
 *
 * A peptide is a chain of residues joined by peptide bonds, and the booking
 * flow is genuinely a sequence too: pay, choose a time, tell the doctor what
 * this is about, done. So progress is drawn as a bond diagram rather than as
 * generic numbered steps. The bond tick between residues is the detail that
 * makes it read as chemistry rather than as a wizard.
 */
export function SequenceRail({
  steps,
  currentIndex,
  className,
}: {
  steps: SequenceStep[];
  currentIndex: number;
  className?: string;
}) {
  return (
    <nav aria-label="Booking progress" className={className}>
      <ol className="flex items-start">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === steps.length - 1;

          return (
            <li key={step.id} className={cn('flex min-w-0 items-start', !isLast && 'flex-1')}>
              <div className="flex min-w-0 flex-col items-center gap-2">
                <Residue state={isComplete ? 'complete' : isCurrent ? 'current' : 'upcoming'} />
                <span
                  className={cn(
                    'max-w-[9ch] text-center font-mono text-eyebrow uppercase leading-tight tracking-[0.12em] sm:max-w-none',
                    isCurrent ? 'text-ink' : isComplete ? 'text-signal' : 'text-muted'
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {step.label}
                </span>
              </div>

              {!isLast ? <Bond active={isComplete} /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Residue({ state }: { state: 'complete' | 'current' | 'upcoming' }) {
  return (
    <span
      className={cn(
        'relative grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border transition-colors duration-280 ease-out',
        state === 'complete' && 'border-signal bg-signal',
        state === 'current' && 'border-amber bg-surface ring-4 ring-amber/15',
        state === 'upcoming' && 'border-line bg-surface'
      )}
    >
      {state === 'current' ? <span className="h-1.5 w-1.5 rounded-full bg-amber" /> : null}
      <span className="sr-only">
        {state === 'complete' ? 'Completed' : state === 'current' ? 'Current step' : 'Not started'}
      </span>
    </span>
  );
}

/** The bond between two residues, with the peptide-bond tick at its midpoint. */
function Bond({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className="relative mx-2 mt-[0.4375rem] h-px flex-1 bg-line sm:mx-3"
    >
      <span
        className={cn(
          'absolute inset-0 origin-left bg-signal transition-transform duration-280 ease-out',
          active ? 'scale-x-100' : 'scale-x-0'
        )}
      />
      <span
        className={cn(
          'absolute left-1/2 top-1/2 h-1.5 w-px -translate-x-1/2 -translate-y-1/2',
          active ? 'bg-signal' : 'bg-line'
        )}
      />
    </span>
  );
}
