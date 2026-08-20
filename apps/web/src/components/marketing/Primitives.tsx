import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { ButtonLink } from '@/components/ui/Button';

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
  credentials: string;
  gmcNumber: string;
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
            alt={`${name}, ${credentials}`}
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
        <p className="mt-0.5 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
          {credentials} · GMC {gmcNumber}
        </p>
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

/** Closing call to action, repeated at the foot of every marketing page. */
export function CtaBand({
  title = 'Talk to the doctor before you take anything else.',
  body = 'Twenty minutes, £95, and an honest answer, including when the answer is that you should not be taking anything at all.',
  className,
}: {
  title?: string;
  body?: string;
  className?: string;
}) {
  return (
    <section className={cn('shell', className)}>
      <div className="relative overflow-hidden rounded-lg border border-line bg-ink px-6 py-12 sm:px-12 sm:py-16">
        <div className="relative max-w-2xl">
          <h2 className="font-display text-h2 font-medium tracking-tight text-paper">{title}</h2>
          <p className="mt-4 text-lead text-paper/70">{body}</p>
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
