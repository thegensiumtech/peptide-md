import type { BookingChannel, BookingStatus, InvoiceStatus, PaymentStatus } from '@peptide/shared';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'signal' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'border-line bg-paper-deep text-muted',
  accent: 'border-accent/25 bg-accent-tint text-accent',
  signal: 'border-signal/25 bg-signal-tint text-signal',
  danger: 'border-danger/25 bg-danger-tint text-danger',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-0.5 font-mono text-micro',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

const BOOKING_STATUS_META: Record<BookingStatus, { label: string; tone: Tone }> = {
  pending_payment: { label: 'Awaiting payment', tone: 'accent' },
  confirmed: { label: 'Confirmed', tone: 'signal' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  completed: { label: 'Completed', tone: 'neutral' },
  no_show: { label: 'No show', tone: 'danger' },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const meta = BOOKING_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: Tone }> = {
  unpaid: { label: 'Unpaid', tone: 'accent' },
  paid: { label: 'Paid', tone: 'signal' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const meta = PAYMENT_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'accent' },
  sent: { label: 'Sent', tone: 'neutral' },
  paid: { label: 'Paid', tone: 'signal' },
  overdue: { label: 'Overdue', tone: 'danger' },
  // Raised in error and cancelled. Kept rather than deleted so the numbering
  // stays unbroken, which is what makes the sequence auditable.
  void: { label: 'Void', tone: 'neutral' },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const meta = INVOICE_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/**
 * Channel is the most-scanned column in the admin. Direct and partner are
 * given different weight rather than different decoration.
 */
export function ChannelBadge({
  channel,
  partnerName,
}: {
  channel: BookingChannel;
  partnerName?: string | null;
}) {
  if (channel === 'direct') return <Badge tone="neutral">Direct</Badge>;
  return <Badge tone="accent">{partnerName ?? 'Partner'}</Badge>;
}
