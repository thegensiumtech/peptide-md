'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Partner, PartnerIntegration } from '@peptide/shared';
import { cn } from '@/lib/cn';
import { formatDateTime, formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { SavedNotice } from './SavedNotice';

const VIEW_TZ = 'Europe/London';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Add and edit share one form. The only difference is that an existing partner
 * has credentials to show and rotate, and a new one has them issued on save.
 */
export function PartnerForm({
  partner,
  defaultRate,
  defaultRateLimit,
}: {
  partner: Partner | null;
  defaultRate: number;
  defaultRateLimit: number;
}) {
  const isNew = partner === null;

  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Secrets are returned exactly once, on create and on rotate. Held in state
   * so they stay on screen until the admin navigates away; there is no route
   * that can show them again.
   */
  const [issued, setIssued] = useState<Array<{ label: string; clientId: string; secret: string }>>(
    []
  );
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [rate, setRate] = useState((partner?.ratePerAppointment ?? defaultRate) / 100);
  const [integration, setIntegration] = useState<PartnerIntegration>(
    partner?.integration ?? 'embed'
  );
  const [primary, setPrimary] = useState(partner?.branding.primaryColor ?? '#0B3C49');
  const [accent, setAccent] = useState(partner?.branding.accentColor ?? '#E4572E');
  const [displayName, setDisplayName] = useState(partner?.branding.displayName ?? '');
  const [rotated, setRotated] = useState(false);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setError(null);

        // Rate and rate limit are entered in the units a person thinks in,
        // pounds and requests, and stored in the units the API works in.
        const body = {
          name: String(form.get('name') ?? '').trim(),
          ...(isNew ? { slug: String(form.get('slug') ?? '').trim() || undefined } : {}),
          integration,
          status: (String(form.get('status') ?? 'active') as 'active' | 'suspended') ?? 'active',
          ratePerAppointment: Math.round(Number(form.get('rate') ?? 0) * 100),
          contactName: String(form.get('contactName') ?? '').trim(),
          contactEmail: String(form.get('contactEmail') ?? '').trim(),
          billingEmail: String(form.get('billingEmail') ?? '').trim(),
          rateLimitPerMinute: Number(form.get('rateLimitPerMinute') ?? defaultRateLimit),
          branding: {
            primaryColor: primary,
            accentColor: accent,
            fontFamily: String(form.get('fontFamily') ?? 'Inter').trim() || 'Inter',
            displayName: displayName.trim(),
          },
        };

        try {
          const response = await fetch(
            isNew ? `${API}/api/admin/partners` : `${API}/api/admin/partners/${partner.id}`,
            {
              method: isNew ? 'POST' : 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(body),
            }
          );
          const payload = await response.json();

          if (!response.ok || !payload.success) {
            setError(payload.error ?? 'That did not save. Check the fields and try again.');
            return;
          }

          if (isNew && payload.data.secrets) {
            setIssued([
              { label: 'Live', ...payload.data.secrets.live },
              { label: 'Sandbox', ...payload.data.secrets.sandbox },
            ]);
          }

          setSaved(true);
          router.refresh();

          // Deliberately does NOT navigate on create. The secrets below are
          // returned exactly once and live in this component's state, so
          // pushing to the detail page would unmount them before anyone read
          // them, and the only way back would be to rotate. The admin gets a
          // link instead and leaves when they are ready.
          if (isNew) setCreatedId(payload.data.partner.id);
        } catch {
          setError('We could not reach the server. Try again.');
        } finally {
          setBusy(false);
        }
      }}
      className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
    >
      <div className="grid gap-6">
        <Card>
          <CardHeader title="Company" />
          <CardBody className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Company name" htmlFor="name" required>
                <Input id="name" name="name" defaultValue={partner?.name} required />
              </Field>
              <Field
                label="Slug"
                htmlFor="slug"
                hint="Used in credentials and reporting. Lowercase, no spaces."
              >
                <Input
                  id="slug"
                  name="slug"
                  defaultValue={partner?.slug}
                  className="font-mono"
                  placeholder="new-you-peptides"
                />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Contact name" htmlFor="contact-name">
                <Input id="contact-name" name="contactName" defaultValue={partner?.contactName} required />
              </Field>
              <Field label="Contact email" htmlFor="contact-email">
                <Input
                  id="contact-email"
                  name="contactEmail"
                  type="email"
                  defaultValue={partner?.contactEmail}
                  className="font-mono"
                />
              </Field>
            </div>
            <Field
              label="Billing email"
              htmlFor="billing-email"
              hint="Where the monthly invoice PDF is sent."
            >
              <Input
                id="billing-email"
                name="billingEmail"
                type="email"
                defaultValue={partner?.billingEmail}
                className="font-mono"
              />
            </Field>
            {!isNew ? (
              <Field label="Status" htmlFor="status" hint="A suspended partner cannot take bookings.">
                <Select id="status" name="status" defaultValue={partner.status}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </Select>
              </Field>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Commercial"
            description="What this partner is charged for each appointment they send."
          />
          <CardBody className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Rate per appointment (GBP)"
                htmlFor="rate"
                required
                hint={`Currently ${formatMoney(rate * 100)} per appointment.`}
              >
                <Input
                  id="rate"
                  name="rate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={rate}
                  onChange={(event) => setRate(Number(event.target.value))}
                  className="font-mono"
                />
              </Field>
              <Field
                label="API rate limit (per minute)"
                htmlFor="rate-limit"
                hint="Requests per minute allowed against the partner API."
              >
                <Input
                  id="rate-limit"
                  name="rateLimitPerMinute"
                  type="number"
                  min={1}
                  defaultValue={partner?.rateLimitPerMinute ?? defaultRateLimit}
                  className="font-mono"
                />
              </Field>
            </div>
            <p className="rounded border border-line bg-paper-deep px-4 py-3 text-micro leading-relaxed text-muted">
              Changing the rate applies to appointments counted from now on. Invoices already
              raised keep the rate they were generated at.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Integration"
            description="How this partner puts the booking flow on their site."
          />
          <CardBody className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    value: 'embed' as const,
                    title: 'Drop-in embed',
                    body: 'A few lines of code renders the booking flow in their colours. For partners with no development team.',
                  },
                  {
                    value: 'api' as const,
                    title: 'Partner API',
                    body: 'They build their own booking screens against the API. Likely what New You will want.',
                  },
                ]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setIntegration(option.value)}
                  aria-pressed={integration === option.value}
                  className={cn(
                    'rounded-lg border p-4 text-left transition-colors duration-150',
                    integration === option.value
                      ? 'border-accent bg-accent-tint'
                      : 'border-line bg-surface hover:border-ink/25'
                  )}
                >
                  <span className="block text-sm font-medium text-ink">{option.title}</span>
                  <span className="mt-1.5 block text-micro leading-relaxed text-muted">
                    {option.body}
                  </span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Branding"
            description="How the booking flow looks inside their site. The patient never sees Peptide MD."
          />
          <CardBody className="grid gap-5">
            <Field
              label="Display name"
              htmlFor="display-name"
              required
              hint="What their patients see. Never 'Peptide MD'."
            >
              <Input
                id="display-name"
                name="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="New You Clinic"
                required
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Primary colour" htmlFor="primary">
                <div className="flex items-center gap-3">
                  <input
                    id="primary"
                    type="color"
                    value={primary}
                    onChange={(event) => setPrimary(event.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-line bg-surface"
                  />
                  <Input
                    value={primary}
                    onChange={(event) => setPrimary(event.target.value)}
                    className="font-mono"
                    aria-label="Primary colour hex"
                  />
                </div>
              </Field>
              <Field label="Accent colour" htmlFor="accent">
                <div className="flex items-center gap-3">
                  <input
                    id="accent"
                    type="color"
                    value={accent}
                    onChange={(event) => setAccent(event.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-line bg-surface"
                  />
                  <Input
                    value={accent}
                    onChange={(event) => setAccent(event.target.value)}
                    className="font-mono"
                    aria-label="Accent colour hex"
                  />
                </div>
              </Field>
            </div>
            <Field label="Font family" htmlFor="font">
              <Input id="font" name="fontFamily" defaultValue={partner?.branding.fontFamily ?? 'Inter'} />
            </Field>

            {/* Preview so the admin sees the partner's theme, not a guess at it. */}
            <div>
              <p className="eyebrow">Widget preview</p>
              <div
                className="mt-3 rounded-lg border border-line p-5"
                style={{ backgroundColor: primary }}
              >
                <p className="text-sm font-semibold text-white">
                  {displayName || 'Their clinic name'}
                </p>
                <p className="mt-1 text-micro text-white/70">Book a consultation with our doctor</p>
                <span
                  className="mt-4 inline-block rounded px-4 py-2 text-micro font-medium text-white"
                  style={{ backgroundColor: accent }}
                >
                  Choose a time
                </span>
              </div>
            </div>
          </CardBody>
        </Card>

        {integration === 'embed' ? (
          <Card>
            <CardHeader
              title="Embed code"
              description="What this partner pastes into their site. No development work needed on their side."
            />
            <CardBody>
              <Textarea
                readOnly
                rows={5}
                className="font-mono text-micro"
                value={`<div id="peptide-booking"></div>\n<script\n  src="https://embed.peptidemd.co.uk/v1/widget.js"\n  data-client-id="${partner?.credentials.clientId ?? 'issued on save'}"\n  defer\n></script>`}
              />
            </CardBody>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-6 xl:sticky xl:top-8 xl:self-start">
        <Card>
          <CardBody>
            <SavedNotice
              show={saved}
              message={isNew ? 'Partner created and credentials issued.' : 'Partner saved.'}
              onDismiss={() => setSaved(false)}
            />
            {error ? (
              <p
                role="alert"
                className="mb-4 rounded border border-danger/25 bg-danger-tint px-4 py-3 text-micro leading-relaxed text-danger"
              >
                {error}
              </p>
            ) : null}
            {issued.length ? (
              <div className="mb-4 grid gap-3 rounded border border-accent/30 bg-accent-tint px-4 py-4">
                <p className="text-micro font-semibold leading-relaxed text-ink">
                  Copy these now. They are not stored and cannot be shown again.
                </p>
                {issued.map((credential) => (
                  <div key={credential.clientId} className="grid gap-1">
                    <span className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                      {credential.label}
                    </span>
                    <code className="block break-all rounded border border-line bg-surface px-3 py-2 font-mono text-micro text-ink">
                      {credential.clientId}
                    </code>
                    <code className="block break-all rounded border border-line bg-surface px-3 py-2 font-mono text-micro text-ink">
                      {credential.secret}
                    </code>
                  </div>
                ))}
              </div>
            ) : null}
            {createdId ? (
              <Link
                href={`/admin/partners/${createdId}`}
                className="flex min-h-11 w-full items-center justify-center rounded bg-accent px-5 text-sm font-medium text-paper transition-colors hover:bg-ink"
              >
                Done, open the partner
              </Link>
            ) : (
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? 'Saving…' : isNew ? 'Create partner' : 'Save changes'}
              </Button>
            )}
            <Link
              href="/admin/partners"
              className="mt-4 block text-center text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
            >
              ← Back to partners
            </Link>
          </CardBody>
        </Card>

        {partner ? (
          <>
            <Card>
              <CardHeader title="API credentials" />
              <CardBody className="grid gap-4">
                <div>
                  <p className="eyebrow">Client ID</p>
                  <p className="mt-1.5 break-all font-mono text-sm text-ink">
                    {partner.credentials.clientId}
                  </p>
                </div>
                <div>
                  <p className="eyebrow">Client secret</p>
                  <p className="mt-1.5 font-mono text-sm text-muted">
                    ••••••••••••{partner.credentials.secretLastFour}
                  </p>
                  <p className="mt-1.5 text-micro leading-relaxed text-muted">
                    Shown in full only at the moment it is issued or rotated.
                  </p>
                </div>
                <dl className="grid gap-2 border-t border-line pt-4">
                  <div className="flex justify-between gap-3">
                    <dt className="text-micro text-muted">Issued</dt>
                    <dd className="font-mono text-micro text-ink">
                      {formatDateTime(partner.credentials.createdAt, VIEW_TZ)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-micro text-muted">Last used</dt>
                    <dd className="font-mono text-micro text-ink">
                      {partner.credentials.lastUsedAt
                        ? formatDateTime(partner.credentials.lastUsedAt, VIEW_TZ)
                        : 'Never'}
                    </dd>
                  </div>
                </dl>

                {rotated ? (
                  <p
                    role="status"
                    className="rounded border border-accent/25 bg-accent-tint px-4 py-3 text-micro leading-relaxed text-ink"
                  >
                    New secret issued. Copy it now, it cannot be shown again. The old secret stops
                    working in 24 hours.
                  </p>
                ) : null}

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const response = await fetch(
                        `${API}/api/admin/partners/${partner.id}/credentials/rotate`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ sandbox: false }),
                        }
                      );
                      const payload = await response.json();
                      if (!response.ok || !payload.success) {
                        setError(payload.error ?? 'The secret could not be rotated.');
                        return;
                      }
                      setIssued([
                        { label: 'Live', clientId: payload.data.clientId, secret: payload.data.secret },
                      ]);
                      setRotated(true);
                      router.refresh();
                    } catch {
                      setError('We could not reach the server. Try again.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Rotating…' : 'Rotate secret'}
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Their volume" />
              <CardBody className="grid gap-3">
                <Link
                  href={`/admin/bookings?channel=partner&partner=${partner.id}`}
                  className="flex items-center justify-between gap-3 rounded border border-line px-4 py-3 transition-colors hover:border-ink/25"
                >
                  <span className="text-sm text-ink">Bookings from this partner</span>
                  <span aria-hidden className="text-muted">
                    →
                  </span>
                </Link>
                <Link
                  href={`/admin/invoices?partner=${partner.id}`}
                  className="flex items-center justify-between gap-3 rounded border border-line px-4 py-3 transition-colors hover:border-ink/25"
                >
                  <span className="text-sm text-ink">Their invoices</span>
                  <span aria-hidden className="text-muted">
                    →
                  </span>
                </Link>
              </CardBody>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader title="What happens on save" />
            <CardBody>
              <ul className="grid gap-3">
                {[
                  'A client ID and secret are issued. The secret is shown once.',
                  'Their branded booking configuration goes live immediately.',
                  'Appointments they send start being counted from that moment.',
                  'Nothing is rebuilt or redeployed.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                    <span className="text-micro leading-relaxed text-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}

        {partner ? (
          <Card>
            <CardBody className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink">Sandbox access</p>
                <p className="mt-0.5 text-micro text-muted">Test credentials for their developers</p>
              </div>
              <Badge tone="neutral">Enabled</Badge>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardBody>
            <Checkbox
              defaultChecked
              label="Email the partner when their monthly invoice is generated"
              description="Sent to the billing address above."
            />
          </CardBody>
        </Card>
      </div>
    </form>
  );
}
