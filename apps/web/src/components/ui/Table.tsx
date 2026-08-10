import { cn } from '@/lib/cn';

/**
 * Tables scroll inside their own container so a dense bookings list never
 * makes the page itself scroll sideways on mobile.
 */
export function TableWrap({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[44rem] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({
  className,
  children,
  align = 'left',
}: {
  className?: string;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap border-b border-line px-4 py-2.5 font-mono text-eyebrow font-medium uppercase tracking-[0.14em] text-muted',
        align === 'right' && 'text-right',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  className,
  children,
  align = 'left',
}: {
  className?: string;
  /** Optional — spacer cells in a footer row legitimately have no content. */
  children?: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <td
      className={cn(
        'border-b border-line px-4 py-3 align-middle text-ink',
        align === 'right' && 'text-right',
        className
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <tr className={cn('transition-colors duration-150 hover:bg-paper-deep/60', className)}>
      {children}
    </tr>
  );
}
