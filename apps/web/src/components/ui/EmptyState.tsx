import { cn } from '@/lib/cn';

/**
 * An empty screen is an invitation to act, so every empty state names the
 * thing that is missing and offers the next move where one exists.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid place-items-center px-6 py-14 text-center', className)}>
      <div className="max-w-sm">
        <span aria-hidden className="mx-auto mb-4 block h-px w-10 bg-line" />
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1.5 text-micro leading-relaxed text-muted">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
