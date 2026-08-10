import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 transition-colors duration-150 hover:border-ink/25 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:bg-paper-deep disabled:text-muted';

export function Field({
  label,
  hint,
  error,
  htmlFor,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-micro font-medium text-ink-soft">
        {label}
        {required ? <span className="ml-1 text-accent">*</span> : null}
      </label>
      {children}
      {/* An error replaces the hint rather than stacking with it. */}
      {error ? (
        <p className="text-micro text-danger">{error}</p>
      ) : hint ? (
        <p className="text-micro text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Ref-forwarding because some inputs need focus moved to them — the access-code
 * field is focused on arrival and again after a wrong code. React 18 still
 * requires forwardRef for that.
 */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(control, className)} {...rest} />;
  }
);

export function Textarea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'min-h-24 resize-y leading-relaxed', className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, 'appearance-none pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...rest
}: { label: React.ReactNode; description?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', className)}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[rgb(var(--accent))]"
        {...rest}
      />
      <span className="grid gap-0.5">
        <span className="text-sm leading-snug text-ink">{label}</span>
        {description ? <span className="text-micro text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
