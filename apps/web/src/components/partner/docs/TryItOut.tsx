'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Endpoint } from '@/components/partner/ApiDocs';
import { PARAMS } from './content';

/**
 * Live endpoint tester.
 *
 * The request goes from the reader's browser straight to the API with ordinary
 * HTTP Basic auth, exactly as their own server would send it. It is not
 * proxied through us, and that is the point: secrets are stored hashed and
 * shown once, so there is no way for this site to hold one on the reader's
 * behalf, and no reason it should.
 *
 * The secret therefore lives in this component and in sessionStorage, which is
 * per-tab and cleared when the tab closes. It is never sent anywhere except as
 * the Authorization header on the call the reader asked for.
 *
 * The client id defaults to the sandbox pair. Someone reading documentation and
 * pressing a button should not be able to put a real appointment in a real
 * doctor's diary by accident.
 */

const SECRET_KEY = 'pmd_docs_secret';
const MODE_KEY = 'pmd_docs_mode';

type Mode = 'sandbox' | 'live';

interface Result {
  status: number;
  ms: number;
  body: string;
  ok: boolean;
}

export function TryItOut({
  endpoints,
  baseUrl,
  sandboxClientId,
  liveClientId,
}: {
  endpoints: Endpoint[];
  baseUrl: string;
  sandboxClientId: string | null;
  /** Omitted on a shared link, where only the sandbox pair is offered. */
  liveClientId?: string | null;
}) {
  const [mode, setMode] = useState<Mode>('sandbox');
  const [secret, setSecret] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  // Restored per tab so the secret survives a reload while reading, and dies
  // with the tab. Wrapped because a locked-down browser throws on access.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SECRET_KEY);
      if (saved) setSecret(saved);
      const savedMode = sessionStorage.getItem(MODE_KEY);
      if (savedMode === 'live' && liveClientId) setMode('live');
    } catch {
      // Storage unavailable. The tester still works, the secret just is not kept.
    }
  }, [liveClientId]);

  const remember = useCallback((next: string) => {
    setSecret(next);
    try {
      sessionStorage.setItem(SECRET_KEY, next);
    } catch {
      // Not fatal.
    }
  }, []);

  const clientId = mode === 'live' ? liveClientId : sandboxClientId;

  return (
    <div className="grid gap-6">
      <CredentialBar
        mode={mode}
        setMode={(m) => {
          setMode(m);
          try {
            sessionStorage.setItem(MODE_KEY, m);
          } catch {
            // Not fatal.
          }
        }}
        secret={secret}
        setSecret={remember}
        clientId={clientId ?? null}
        canGoLive={Boolean(liveClientId)}
      />

      <div className="grid gap-5">
        {endpoints.map((endpoint) => {
          const key = `${endpoint.method} ${endpoint.path}`;
          return (
            <EndpointPanel
              key={key}
              endpoint={endpoint}
              baseUrl={baseUrl}
              clientId={clientId ?? null}
              secret={secret}
              mode={mode}
              isOpen={open === key}
              onToggle={() => setOpen(open === key ? null : key)}
            />
          );
        })}
      </div>
    </div>
  );
}

function CredentialBar({
  mode,
  setMode,
  secret,
  setSecret,
  clientId,
  canGoLive,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  secret: string;
  setSecret: (s: string) => void;
  clientId: string | null;
  canGoLive: boolean;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="eyebrow">Credentials for trying calls</p>
        {mode === 'live' ? (
          <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-signal">
            Live diary, real appointments
          </p>
        ) : (
          <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
            Sandbox, nothing reaches a real patient
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-micro font-medium text-ink-soft">Environment</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="min-h-11 rounded border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-ink"
          >
            <option value="sandbox">Sandbox</option>
            {canGoLive ? <option value="live">Live</option> : null}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-micro font-medium text-ink-soft">Client id</span>
          <input
            readOnly
            value={clientId ?? 'Not issued yet'}
            className="min-h-11 rounded border border-line bg-paper-deep px-3 font-mono text-sm text-ink outline-none"
          />
        </label>
      </div>

      <label className="mt-4 grid gap-1.5">
        <span className="text-micro font-medium text-ink-soft">
          Secret <span className="text-muted">(paste to run calls)</span>
        </span>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="pmd_sk_..."
          autoComplete="off"
          spellCheck={false}
          className="min-h-11 rounded border border-line bg-surface px-3 font-mono text-sm text-ink outline-none focus:border-ink"
        />
      </label>

      <p className="mt-3 text-micro leading-relaxed text-muted">
        Your secret stays in this browser tab and is sent only to the API, as the password in the
        Basic auth header. It is never stored on this site. Close the tab and it is gone.
      </p>
    </div>
  );
}

function EndpointPanel({
  endpoint,
  baseUrl,
  clientId,
  secret,
  mode,
  isOpen,
  onToggle,
}: {
  endpoint: Endpoint;
  baseUrl: string;
  clientId: string | null;
  secret: string;
  mode: Mode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const key = `${endpoint.method} ${endpoint.path}`;
  const params = PARAMS[key] ?? [];
  const hasPathParam = endpoint.path.includes(':id');
  const takesBody = endpoint.method !== 'GET';

  const defaultQuery = useMemo(() => {
    if (endpoint.path.endsWith('/availability')) return 'days=7';
    return '';
  }, [endpoint.path]);

  const defaultBody = useMemo(() => {
    if (endpoint.path === '/api/v1/holds') {
      return '{\n  "startsAt": "PASTE_A_startsAt_FROM_AVAILABILITY"\n}';
    }
    if (endpoint.method === 'POST' && endpoint.path === '/api/v1/bookings') {
      return `{
  "holdToken": "PASTE_YOUR_holdToken",
  "patient": {
    "name": "Test Patient",
    "email": "test@example.com",
    "phone": "+44 7700 900000",
    "timezone": "Europe/London"
  },
  "reference": "your-own-ref-1"
}`;
    }
    if (endpoint.method === 'PATCH') {
      return '{\n  "startsAt": "PASTE_A_NEW_startsAt"\n}';
    }
    if (endpoint.method === 'DELETE') {
      return '{\n  "reason": "Testing from the documentation"\n}';
    }
    return '{}';
  }, [endpoint.method, endpoint.path]);

  const [query, setQuery] = useState(defaultQuery);
  const [body, setBody] = useState(defaultBody);
  const [pathId, setPathId] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);

  const canRun = Boolean(clientId) && secret.trim().length > 0 && (!hasPathParam || pathId.trim());

  async function run() {
    if (!canRun || !clientId) return;
    setRunning(true);
    setResult(null);
    const started = performance.now();

    try {
      const path = endpoint.path.replace(':id', encodeURIComponent(pathId.trim()));
      const url = `${baseUrl}${path}${query.trim() ? `?${query.trim().replace(/^\?/, '')}` : ''}`;

      const init: RequestInit = {
        method: endpoint.method,
        headers: {
          Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
          ...(takesBody ? { 'Content-Type': 'application/json' } : {}),
        },
      };
      if (takesBody && body.trim()) init.body = body;

      const response = await fetch(url, init);
      const text = await response.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // Not JSON. Show it as it came.
      }
      setResult({
        status: response.status,
        ms: Math.round(performance.now() - started),
        body: pretty,
        ok: response.ok,
      });
    } catch (error) {
      setResult({
        status: 0,
        ms: Math.round(performance.now() - started),
        ok: false,
        body:
          'The request could not be sent from the browser. This is usually the network, or the API not being reachable from here.\n\n' +
          String(error),
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-mono text-sm">
            <span
              className={
                endpoint.method === 'GET'
                  ? 'rounded bg-paper-deep px-2 py-0.5 text-xs font-medium text-ink'
                  : 'rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent'
              }
            >
              {endpoint.method}
            </span>
            <span className="break-all text-ink">{endpoint.path}</span>
          </p>
          <p className="mt-2 text-sm text-ink-soft">{endpoint.summary}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="min-h-11 shrink-0 rounded border border-line px-4 text-sm text-ink transition-colors hover:border-ink"
        >
          {isOpen ? 'Hide' : 'Try it out'}
        </button>
      </header>

      <div className="px-5 py-5 sm:px-6">
        <p className="max-w-prose text-sm leading-relaxed text-muted">{endpoint.detail}</p>

        {params.length > 0 ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-micro">
              <thead>
                <tr>
                  <th className="border-b border-line py-2 pr-4 font-medium text-muted">Name</th>
                  <th className="border-b border-line py-2 pr-4 font-medium text-muted">In</th>
                  <th className="border-b border-line py-2 pr-4 font-medium text-muted">Type</th>
                  <th className="border-b border-line py-2 font-medium text-muted">Notes</th>
                </tr>
              </thead>
              <tbody>
                {params.map((p) => (
                  <tr key={`${p.in}:${p.name}`}>
                    <td className="border-b border-line py-2 pr-4 font-mono text-ink">
                      {p.name}
                      {p.required ? <span className="text-signal"> *</span> : null}
                    </td>
                    <td className="border-b border-line py-2 pr-4 text-muted">{p.in}</td>
                    <td className="border-b border-line py-2 pr-4 text-muted">{p.type}</td>
                    <td className="border-b border-line py-2 text-ink-soft">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {isOpen ? (
          <div className="mt-6 rounded border border-line bg-paper-deep p-4 sm:p-5">
            <p className="eyebrow">Run it</p>

            <div className="mt-4 grid gap-4">
              {hasPathParam ? (
                <label className="grid gap-1.5">
                  <span className="text-micro font-medium text-ink-soft">Booking id (in the URL)</span>
                  <input
                    value={pathId}
                    onChange={(e) => setPathId(e.target.value)}
                    placeholder="the id returned when the booking was created"
                    className="min-h-11 rounded border border-line bg-surface px-3 font-mono text-sm text-ink outline-none focus:border-ink"
                  />
                </label>
              ) : null}

              {endpoint.method === 'GET' ? (
                <label className="grid gap-1.5">
                  <span className="text-micro font-medium text-ink-soft">Query string</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="days=7"
                    className="min-h-11 rounded border border-line bg-surface px-3 font-mono text-sm text-ink outline-none focus:border-ink"
                  />
                </label>
              ) : (
                <label className="grid gap-1.5">
                  <span className="text-micro font-medium text-ink-soft">Request body (JSON)</span>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={endpoint.path === '/api/v1/bookings' && endpoint.method === 'POST' ? 12 : 4}
                    spellCheck={false}
                    className="rounded border border-line bg-surface p-3 font-mono text-xs leading-relaxed text-ink outline-none focus:border-ink"
                  />
                </label>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={run}
                  disabled={!canRun || running}
                  className="min-h-11 rounded bg-ink px-5 text-sm font-medium text-surface transition-opacity disabled:opacity-40"
                >
                  {running ? 'Sending…' : `Send ${endpoint.method}`}
                </button>
                {!clientId ? (
                  <span className="text-micro text-muted">No client id issued for this partner yet.</span>
                ) : !secret.trim() ? (
                  <span className="text-micro text-muted">Paste your secret above to run this.</span>
                ) : hasPathParam && !pathId.trim() ? (
                  <span className="text-micro text-muted">Add a booking id to run this.</span>
                ) : mode === 'live' ? (
                  <span className="text-micro text-signal">
                    Live: this books the real diary and is billable.
                  </span>
                ) : null}
              </div>
            </div>

            {result ? (
              <div className="mt-5">
                <p className="flex flex-wrap items-center gap-3 font-mono text-eyebrow uppercase tracking-[0.14em]">
                  <span className={result.ok ? 'text-ink' : 'text-signal'}>
                    {result.status === 0 ? 'No response' : `HTTP ${result.status}`}
                  </span>
                  <span className="text-muted">{result.ms} ms</span>
                </p>
                <pre className="mt-2 max-h-96 overflow-auto rounded border border-line bg-surface p-4 font-mono text-xs leading-relaxed text-ink">
                  {result.body}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}

        {endpoint.request ? (
          <div className="mt-6">
            <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">Request</p>
            <pre className="mt-2 overflow-x-auto rounded border border-line bg-paper-deep p-4 font-mono text-xs leading-relaxed text-ink">
              {endpoint.request.replace(/\{\{BASE\}\}/g, baseUrl)}
            </pre>
          </div>
        ) : null}

        <div className="mt-5">
          <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
            Response · {endpoint.status}
          </p>
          <pre className="mt-2 max-h-80 overflow-auto rounded border border-line bg-paper-deep p-4 font-mono text-xs leading-relaxed text-ink">
            {endpoint.response}
          </pre>
        </div>
      </div>
    </article>
  );
}
