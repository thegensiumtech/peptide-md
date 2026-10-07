import Image from 'next/image';
import { cn } from '@/lib/cn';

/** Section heading with an eyebrow that names the region rather than decorating it. */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  className,
  align = 'left',
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  className?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-4 font-display text-h2 font-medium tracking-tight text-ink">{title}</h2>
      {lede ? <p className="mt-4 text-lead text-muted">{lede}</p> : null}
    </div>
  );
}

/**
 * Portrait frame.
 *
 * Ross's photograph of the doctor drops straight in here. Until then the frame
 * renders as a clinical ID card, initials, credential line, registration
 * number, so the layout reads as deliberate rather than as a missing image.
 */
export function PortraitFrame({
  name,
  credentials,
  gmcNumber,
  photoUrl,
  priority = false,
  className,
}: {
  name: string;
  /** Post-nominals. Empty when the clinic has not supplied any. */
  credentials: string;
  /** Omitted from the caption when empty. See the note on the caption. */
  gmcNumber?: string | null;
  photoUrl?: string | null;
  /** Set on the homepage hero, where this is the largest-contentful paint. */
  priority?: boolean;
  className?: string;
}) {
  const initials = name
    .replace(/^Dr\s+/i, '')
    .split(' ')
    .map((part) => part[0])
    .join('');

  return (
    <figure className={cn('relative', className)}>
      <div className="aspect-[4/5] w-full overflow-hidden rounded-lg border border-line bg-surface">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={credentials ? `${name}, ${credentials}` : name}
            width={1000}
            height={1250}
            priority={priority}
            sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw"
            placeholder="blur"
            // A tiny inline blur so the frame is never an empty grey box while
            // the photograph loads. Cheap enough to inline; no extra request.
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAUABADASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAQFAwb/xAAlEAACAQMDAwUBAAAAAAAAAAABAgMABBEFEiEGE0EUIjFRYYH/xAAVAQEBAAAAAAAAAAAAAAAAAAABAv/EABkRAQEAAwEAAAAAAAAAAAAAAAEAAhESIf/aAAwDAQACEQMRAD8AzWl6vLYzKrsWgJwynnA+RVzq2t28FnttpFeWQYXacgD5NcxRRbYjkjkzHQwuKUUVoyf/2Q=="
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div className="grid h-full place-items-center bg-[linear-gradient(160deg,rgb(var(--paper-deep)),rgb(var(--surface)))]">
            <span
              aria-hidden
              className="font-display text-[clamp(4rem,12vw,7rem)] font-medium leading-none text-ink/10"
            >
              {initials}
            </span>
          </div>
        )}
      </div>
      <figcaption className="absolute bottom-4 left-4 right-4 rounded border border-line bg-surface px-4 py-3">
        <p className="font-display text-base font-semibold text-ink">{name}</p>
        {/* Both halves are optional and neither is invented.
            A registration number is a regulated claim about a real person, and
            post-nominals are the same kind of claim, so each prints only when
            the clinic has actually given it to us. Joining them unconditionally
            produced a stray separator when one was missing. */}
        {credentials || gmcNumber ? (
          <p className="mt-0.5 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
            {[credentials, gmcNumber ? `GMC ${gmcNumber}` : null].filter(Boolean).join(' · ')}
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}

/**
 * The requisition slip, a mono data block modelled on a lab request form.
 * It carries the facts a patient actually decides on: what it is, how long,
 * what it costs, and when the next one is.
 */
export function RequisitionCard({
  rows,
  className,
}: {
  rows: Array<{ label: string; value: string; emphasis?: boolean }>;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'divide-y divide-line rounded-lg border border-line bg-surface font-mono',
        className
      )}
    >
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-3">
          <dt className="text-eyebrow uppercase tracking-[0.14em] text-muted">{row.label}</dt>
          <dd
            className={cn(
              'text-right text-sm',
              row.emphasis ? 'font-semibold text-accent' : 'text-ink'
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ChainMotif({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 320 120"
      className={cn('h-40 w-80', className)}
      fill="none"
      stroke="currentColor"
    >
      <path d="M10 60 H310" strokeWidth="1" />
      {[10, 60, 110, 160, 210, 260, 310].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={60} r="7" strokeWidth="1.5" fill="none" />
          {i < 6 ? <path d={`M${x + 25} 54 V66`} strokeWidth="1" /> : null}
        </g>
      ))}
    </svg>
  );
}
