'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Shareable documentation links for one partner.
 *
 * The need: a partner's developers want the API reference, but nobody is going
 * to create portal accounts for contractors who will never log in again. This
 * mints a link that opens the reference, carries the sandbox client id and no
 * secret, and can be withdrawn later.
 *
 * Revoking is offered next to every live link rather than buried, because the
 * ability to hand a link out is only safe if taking it back is equally easy.
 */

interface DocsLink {
  id: string;
  token: string;
  label: string;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  active: boolean;
}

const EXPIRY_OPTIONS = [
  { value: '', label: 'Never expires' },
  { value: '7', label: 'After 7 days' },
  { value: '30', label: 'After 30 days' },
  { value: '90', label: 'After 90 days' },
];

export function DocsLinkPanel({ partnerId }: { partnerId: string }) {
  const [links, setLinks] = useState<DocsLink[] | null>(null);
  const [label, setLabel] = useState('');
  const [expiry, setExpiry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/admin/partners/${partnerId}/docs-links`, {
        credentials: 'include',
      });
      const payload = await response.json();
      if (payload.success) setLinks(payload.data);
      else setError(payload.error ?? 'Could not load links.');
    } catch {
      setError('We could not reach the server.');
    }
  }, [partnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Built in the browser so the link always matches the host the admin is
  // actually on, rather than a base URL baked in at build time.
  const urlFor = (token: string) =>
    typeof window === 'undefined' ? `/docs/${token}` : `${window.location.origin}/docs/${token}`;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API}/api/admin/partners/${partnerId}/docs-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label: label.trim(), expiresInDays: expiry ? Number(expiry) : null }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setError(payload.error ?? 'That link could not be created.');
        return;
      }
      setLabel('');
      await load();
    } catch {
      setError('We could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API}/api/admin/docs-links/${id}/revoke`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setError(payload.error ?? 'That link could not be revoked.');
        return;
      }
      await load();
    } catch {
      setError('We could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(urlFor(token));
      setCopied(token);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Copying is blocked in this browser. Select the link and copy it by hand.');
    }
  }

  const active = (links ?? []).filter((l) => l.active);
  const closed = (links ?? []).filter((l) => !l.active);

  return (
    <Card className="mt-8">
      <CardHeader
        title="Shareable API documentation"
        description="A read-only link to the integration reference, safe to email to this partner's developers. It carries their sandbox client id and no secret."
      />
      <CardBody>
        {error ? (
          <p role="alert" className="mb-5 rounded border border-signal/40 bg-signal/5 px-4 py-3 text-sm text-ink">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <label className="grid gap-1.5">
            <span className="text-micro font-medium text-ink-soft">
              Label <span className="text-muted">(so you can tell links apart)</span>
            </span>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="New You dev team"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-micro font-medium text-ink-soft">Expiry</span>
            <Select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <Button size="md" onClick={create} disabled={busy}>
            {busy ? 'Working…' : 'Create link'}
          </Button>
        </div>

        {links === null ? (
          <p className="mt-6 text-sm text-muted">Loading…</p>
        ) : links.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No links yet. Create one and send it to whoever is building the integration.
          </p>
        ) : (
          <div className="mt-8 grid gap-4">
            {[...active, ...closed].map((link) => (
              <div
                key={link.id}
                className={`rounded border px-4 py-4 ${
                  link.active ? 'border-line bg-paper-deep' : 'border-dashed border-line opacity-60'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-ink">
                    {link.label || 'Untitled link'}
                    {!link.active ? (
                      <span className="ml-2 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                        {link.revokedAt ? 'Revoked' : 'Expired'}
                      </span>
                    ) : null}
                  </p>
                  <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                    {link.viewCount} view{link.viewCount === 1 ? '' : 's'}
                    {link.expiresAt
                      ? ` · until ${new Date(link.expiresAt).toLocaleDateString('en-GB')}`
                      : ''}
                  </p>
                </div>

                {link.active ? (
                  <>
                    <p className="mt-3 break-all rounded border border-line bg-surface px-3 py-2 font-mono text-xs text-ink">
                      {urlFor(link.token)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => copy(link.token)}>
                        {copied === link.token ? 'Copied' : 'Copy link'}
                      </Button>
                      <a
                        href={urlFor(link.token)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center rounded border border-line px-3 text-sm text-ink transition-colors hover:border-ink"
                      >
                        Open
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => revoke(link.id)}
                      >
                        Revoke
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
