import { cn } from '@/lib/cn';

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // min-w-0 matters: as a grid or flex item the default `min-width: auto`
    // sizes the card to its content's min-content width, and a nowrap
    // truncated line inside makes that far wider than the viewport. Without
    // this the whole page scrolls sideways on tablet.
    <div className={cn('min-w-0 rounded-lg border border-line bg-surface', className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4',
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 text-micro text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

/**
 * A labelled value. Used across booking detail, invoice detail and settings so
 * that a field always looks like a field regardless of screen.
 */
export function DataRow({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 border-b border-line py-3 last:border-0 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-4">
      <dt className="text-micro text-muted">{label}</dt>
      <dd className={cn('text-sm text-ink', mono && 'font-mono')}>{children}</dd>
    </div>
  );
}
