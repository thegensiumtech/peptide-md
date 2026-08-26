'use client';

import type { InvoiceStatus } from '@peptide/shared';
import { InvoiceStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Status cell and download control for one invoice row.
 *
 * The download used to set a local flag and say "Downloaded" without fetching
 * anything. It now opens the real endpoint, which is scoped to the signed-in
 * partner before it renders: an invoice id belonging to another company is a
 * 404, not a file.
 *
 * A draft has no download because it has not been raised yet. Handing a
 * partner a figure we have not committed to invites an argument about a number
 * that was never an invoice.
 */
export function PartnerInvoiceRow({
  invoiceId,
  status,
  number,
  statusOnly = false,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  number: string;
  statusOnly?: boolean;
}) {
  if (statusOnly) return <InvoiceStatusBadge status={status} />;

  const unavailable = status === 'draft' || status === 'void';

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={unavailable}
      onClick={() => {
        window.open(`${API}/api/partner/invoices/${invoiceId}/pdf`, '_blank');
      }}
      aria-label={`Download ${number} as PDF`}
    >
      Download
    </Button>
  );
}
