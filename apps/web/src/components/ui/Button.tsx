import Link from 'next/link';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded font-medium transition-all duration-150 ease-out disabled:pointer-events-none disabled:opacity-40';

const variants: Record<Variant, string> = {
  // The brand teal is the one active thing on a screen, it belongs to the action that
  // moves the patient forward, and nothing else.
  primary: 'bg-accent text-white hover:bg-accent/90 active:translate-y-px shadow-raise',
  secondary: 'border border-line bg-surface text-ink hover:border-ink/30 hover:bg-paper-deep',
  ghost: 'text-ink-soft hover:bg-paper-deep hover:text-ink',
  danger: 'border border-danger/25 bg-danger-tint text-danger hover:border-danger/50',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-micro',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

type ButtonProps = CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>;
type LinkProps = CommonProps & { href: string };

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  href,
  children,
}: LinkProps) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}
