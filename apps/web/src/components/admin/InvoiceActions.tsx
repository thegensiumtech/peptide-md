'use client';

import { useState } from 'react';
import type { InvoiceStatus } from '@peptide/shared';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

/**
 * Sending is the point of no return for a draft, so it confirms first and
 * names the address it is going to. Everything else is a status correction.
 */
export function InvoiceActions({
  number,
  status,
  partnerName,
  hasPdf,
}: {
  number: string;
  status: InvoiceStatus;
  partnerName: string;
  hasPdf: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader title="Actions" description={number} />
      <CardBody className="grid gap-4">
        {notice ? (
          <p
            role="status"
            className="rounded border border-signal/25 bg-signal-tint px-4 py-3 text-micro leading-relaxed text-ink"
          >
            {notice}
          </p>
        ) : null}

        {status === 'draft' ? (
          confirming ? (
            <div className="grid gap-3">
              <p className="text-sm leading-relaxed text-ink">
                This raises the invoice, generates the PDF and emails it to {partnerName}. The
                appointment count is fixed at that point.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setConfirming(false);
                    setNotice(`Invoice raised and emailed to ${partnerName}.`);
                  }}
                >
                  Raise and send
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Not yet
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-micro leading-relaxed text-muted">
                Still counting. It will be raised automatically at the end of the month, or you can
                send it now.
              </p>
              <Button size="md" onClick={() => setConfirming(true)}>
                Review and send
              </Button>
            </>
          )
        ) : (
          <div className="grid gap-2">
            <Button
              variant="secondary"
              size="md"
              disabled={!hasPdf}
              onClick={() => setNotice('PDF downloaded.')}
            >
              Download PDF
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setNotice(`Invoice re-sent to ${partnerName}.`)}
            >
              Re-send to partner
            </Button>
            {status !== 'paid' ? (
              <Button size="md" onClick={() => setNotice('Marked as paid.')}>
                Mark as paid
              </Button>
            ) : null}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
