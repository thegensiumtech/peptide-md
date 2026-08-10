'use client';

import { useState } from 'react';
import type { InvoiceStatus } from '@peptide/shared';
import { InvoiceStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

/**
 * Status cell and download control for one invoice row.
 *
 * The download is a client action so the static build can acknowledge it; in
 * production it is a signed S3 URL for the generated PDF.
 */
export function PartnerInvoiceRow({
  status,
  number,
  statusOnly = false,
}: {
  status: InvoiceStatus;
  number: string;
  statusOnly?: boolean;
}) {
  const [downloaded, setDownloaded] = useState(false);

  if (statusOnly) return <InvoiceStatusBadge status={status} />;

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => setDownloaded(true)}
      aria-label={`Download ${number} as PDF`}
    >
      {downloaded ? 'Downloaded' : 'Download'}
    </Button>
  );
}
