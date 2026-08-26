'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { InvoiceStatus } from '@peptide/shared';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Sending is the point of no return for a draft, so it confirms first and
 * names the address it is going to. Everything else is a status correction.
 *
 * Every button here used to set a notice and do nothing. Worth stating plainly
 * because a screen that says "Invoice raised and emailed" when nothing was
 * sent is worse than a screen with no button at all: the admin stops chasing.
 */
export function InvoiceActions({
  invoiceId,
  number,
  status,
  partnerName,
  billingEmail,
}: {
  invoiceId: string;
  number: string;
  status: InvoiceStatus;
  partnerName: string;
  billingEmail: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(path: string, success: string): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${API}/api/admin/invoices/${invoiceId}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        setError(payload.error ?? 'That did not go through. Try again.');
        return;
      }
      setNotice(success);
      setConfirming(false);
      router.refresh();
    } catch {
      setError('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

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
        {error ? (
          <p
            role="alert"
            className="rounded border border-danger/25 bg-danger-tint px-4 py-3 text-micro leading-relaxed text-danger"
          >
            {error}
          </p>
        ) : null}

        {status === 'draft' ? (
          confirming ? (
            <div className="grid gap-3">
              <p className="text-sm leading-relaxed text-ink">
                This raises the invoice, generates the PDF and emails it to {billingEmail}. The
                appointment count is fixed at that point.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => act('/send', `Invoice raised and emailed to ${partnerName}.`)}
                >
                  {busy ? 'Sending…' : 'Raise and send'}
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
                  Not yet
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-micro leading-relaxed text-muted">
                Still counting. It is raised automatically at the end of the month, or you can send
                it now.
              </p>
              <Button size="md" onClick={() => setConfirming(true)}>
                Review and send
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => act('/refresh', 'Recounted against the current bookings.')}
              >
                {busy ? 'Recounting…' : 'Recount appointments'}
              </Button>
            </>
          )
        ) : (
          <div className="grid gap-2">
            {/* A real download rather than a notice. The PDF is generated on
                request, so there is nothing to wait for and nothing stale. */}
            <Button
              variant="secondary"
              size="md"
              disabled={status === 'void'}
              onClick={() => {
                window.open(`${API}/api/admin/invoices/${invoiceId}/pdf`, '_blank');
              }}
            >
              Download PDF
            </Button>
            <Button
              variant="secondary"
              size="md"
              disabled={busy || status === 'void'}
              onClick={() => act('/send', `Invoice re-sent to ${partnerName}.`)}
            >
              {busy ? 'Sending…' : 'Re-send to partner'}
            </Button>
            {status !== 'paid' && status !== 'void' ? (
              <Button size="md" disabled={busy} onClick={() => act('/paid', 'Marked as paid.')}>
                Mark as paid
              </Button>
            ) : null}
          </div>
        )}

        {status !== 'paid' && status !== 'void' ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => act('/void', 'Invoice voided. The number is kept so the sequence stays unbroken.')}
          >
            Void this invoice
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}
