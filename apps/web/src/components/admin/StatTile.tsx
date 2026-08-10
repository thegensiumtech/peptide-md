import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * A single figure with its label. The number is the loudest thing in the tile;
 * everything else recedes. Where a figure has somewhere to lead, the whole
 * tile is the link — a number the reader can act on should not need a
 * separate "view" affordance.
 */
export function StatTile({
  label,
  value,
  detail,
  href,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: string;
  detail?: string;
  href?: string;
  tone?: 'neutral' | 'accent' | 'signal';
  className?: string;
}) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          'mt-3 font-mono text-[clamp(1.75rem,1.4rem+1.2vw,2.25rem)] leading-none',
          tone === 'accent' && 'text-accent',
          tone === 'signal' && 'text-signal',
          tone === 'neutral' && 'text-ink'
        )}
      >
        {value}
      </p>
      {detail ? <p className="mt-2.5 text-micro leading-relaxed text-muted">{detail}</p> : null}
    </>
  );

  const base = 'block rounded-lg border border-line bg-surface p-5';

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          base,
          'transition-all duration-150 hover:border-ink/25 hover:shadow-raise',
          className
        )}
      >
        {body}
      </Link>
    );
  }

  return <div className={cn(base, className)}>{body}</div>;
}
