'use client';

import { useState } from 'react';
import type { Partner } from '@peptide/shared';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, DataRow } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const VIEW_TZ = 'Europe/London';

const ENDPOINTS = [
  { method: 'GET', path: '/v1/availability', body: 'Free slots for a date range, in any time zone.' },
  { method: 'POST', path: '/v1/holds', body: 'Hold a slot while your patient completes booking.' },
  { method: 'POST', path: '/v1/bookings', body: 'Confirm the booking. The slot is locked to you.' },
  { method: 'PATCH', path: '/v1/bookings/:id', body: 'Reschedule an existing appointment.' },
  { method: 'DELETE', path: '/v1/bookings/:id', body: 'Cancel and release the slot.' },
];

export function CredentialsPanel({ partner }: { partner: Partner }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard can be blocked by permissions; the value is on screen to
      // select manually, so there is nothing to recover from.
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="grid gap-6">
        <Card>
          <CardHeader
            title="Your credentials"
            description="Used to authenticate every request. Treat the secret like a password."
          />
          <CardBody className="grid gap-5">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow">Client ID</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copy('id', partner.credentials.clientId)}
                >
                  {copied === 'id' ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="mt-1 break-all rounded border border-line bg-paper-deep px-4 py-3 font-mono text-sm text-ink">
                {partner.credentials.clientId}
              </p>
            </div>

            <div>
              <p className="eyebrow">Client secret</p>
              {newSecret ? (
                <>
                  <div className="mt-1 flex items-start gap-2">
                    <p className="min-w-0 flex-1 break-all rounded border border-accent/30 bg-accent-tint px-4 py-3 font-mono text-sm text-ink">
                      {newSecret}
                    </p>
                    <Button variant="secondary" size="sm" onClick={() => copy('secret', newSecret)}>
                      {copied === 'secret' ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <p className="mt-2 text-micro leading-relaxed text-danger">
                    Copy this now. It cannot be shown again. Your previous secret stops working in
                    24 hours.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 rounded border border-line bg-paper-deep px-4 py-3 font-mono text-sm text-muted">
                    ••••••••••••••••{partner.credentials.secretLastFour}
                  </p>
                  <p className="mt-2 text-micro leading-relaxed text-muted">
                    Shown in full only when issued or rotated. If you have lost it, rotate to get a
                    new one.
                  </p>
                </>
              )}
            </div>

            <div className="border-t border-line pt-5">
              {confirming ? (
                <div className="grid gap-3">
                  <p className="text-sm leading-relaxed text-ink">
                    Rotating issues a new secret immediately. Your current secret keeps working for
                    24 hours so you can deploy the change without downtime.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setConfirming(false);
                        setNewSecret('pmd_sk_live_9f4b21c7e83a5d06b17f2c94ae5310d8');
                      }}
                    >
                      Rotate the secret
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="secondary" size="md" onClick={() => setConfirming(true)}>
                  Rotate secret
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Endpoints"
            description="The full reference, with request and response examples, is in the API documentation."
          />
          <CardBody>
            <ul className="divide-y divide-line">
              {ENDPOINTS.map((endpoint) => (
                <li key={endpoint.path} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                  <span className="w-16 shrink-0 font-mono text-eyebrow uppercase tracking-[0.12em] text-accent">
                    {endpoint.method}
                  </span>
                  <span className="font-mono text-sm text-ink">{endpoint.path}</span>
                  <span className="w-full text-micro text-muted sm:w-auto sm:flex-1">
                    {endpoint.body}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader title="Your integration" />
          <CardBody>
            <dl>
              <DataRow label="Method">
                <Badge tone="neutral">
                  {partner.integration === 'api' ? 'Partner API' : 'Embed widget'}
                </Badge>
              </DataRow>
              <DataRow label="Rate limit" mono>
                {partner.rateLimitPerMinute} requests per minute
              </DataRow>
              <DataRow label="Issued" mono>
                {formatDateTime(partner.credentials.createdAt, VIEW_TZ)}
              </DataRow>
              <DataRow label="Last rotated" mono>
                {partner.credentials.lastRotatedAt
                  ? formatDateTime(partner.credentials.lastRotatedAt, VIEW_TZ)
                  : 'Never'}
              </DataRow>
              <DataRow label="Last used" mono>
                {partner.credentials.lastUsedAt
                  ? formatDateTime(partner.credentials.lastUsedAt, VIEW_TZ)
                  : 'Never'}
              </DataRow>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sandbox" description="Test safely before going live." />
          <CardBody>
            <p className="text-micro leading-relaxed text-muted">
              Sandbox credentials book against a test diary rather than the doctor’s real one. Use
              them for your whole integration build — nothing you do there reaches a real patient
              or appears on your invoice.
            </p>
            <Button variant="secondary" size="sm" className="mt-4">
              View sandbox credentials
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Need help?" />
          <CardBody>
            <p className="text-micro leading-relaxed text-muted">
              We support your developers directly through onboarding. Email{' '}
              <a
                href="mailto:developers@peptidemd.com"
                className="text-ink underline decoration-line underline-offset-4 hover:decoration-accent"
              >
                developers@peptidemd.com
              </a>{' '}
              and you will get a person, not a ticket queue.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
