import { cn } from '@/lib/cn';

/**
 * Loading placeholders.
 *
 * Shaped like the content they stand in for, so the page does not jump when
 * the real thing arrives, a spinner in the middle of a screen tells you
 * nothing about what is coming.
 *
 * The shimmer is a background-position sweep: it moves nothing in the layout,
 * so it stays on the compositor and costs nothing. It is switched off entirely
 * under prefers-reduced-motion by the global rule in globals.css.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('skeleton block rounded', className)} />;
}

/** A run of text lines, the last one short so it reads as a paragraph. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn('block space-y-2', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3.5', index === lines - 1 ? 'w-2/5' : 'w-full')}
        />
      ))}
    </span>
  );
}

/**
 * A loading region. Announces itself once to screen readers rather than
 * leaving them with a silent screen full of grey boxes.
 */
export function SkeletonRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Matches the admin stat tiles. */
export function SkeletonTiles({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-lg border border-line bg-surface p-5">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="mt-4 h-8 w-20" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

/** Matches the bookings, partners and invoices tables. */
export function SkeletonTable({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex gap-4 border-b border-line px-4 py-3">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-2.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-0">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              className={cn('h-3.5', column === 0 ? 'w-24 shrink-0' : 'flex-1')}
              // Stagger the sweep so rows do not pulse in lockstep, which
              // reads as a glitch rather than as loading.
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Matches the slot grid on the booking and diary screens. */
export function SkeletonSlots({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-11" />
      ))}
    </div>
  );
}
