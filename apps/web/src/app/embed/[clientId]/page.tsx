import { notFound } from 'next/navigation';
import { EmbedBooking } from '@/components/embed/EmbedBooking';

/**
 * The embeddable booking widget.
 *
 * Rendered inside an iframe on the partner's own site, which is what delivers
 * the isolation the scope asks for: the host page's CSS cannot reach in and
 * ours cannot reach out. An inline script sharing their document would give
 * neither.
 *
 * The config is fetched server-side so the first paint already carries the
 * partner's colours. A widget that flashes our navy before turning New You's
 * teal is worse than a slower one.
 */

// The partner's branding can change in the admin panel, and an embed pasted
// into a page months ago should pick that up without anyone touching it.
export const revalidate = 300;

interface EmbedConfig {
  displayName: string;
  branding: {
    primaryColor: string;
    accentColor: string;
    fontFamily: string;
    logoUrl: string | null;
  };
  durationMinutes: number;
  timezone: string;
  sandbox: boolean;
}

async function loadConfig(clientId: string): Promise<EmbedConfig | null> {
  const base =
    process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const response = await fetch(`${base}/api/embed/${encodeURIComponent(clientId)}/config`, {
    next: { revalidate },
  }).catch(() => null);

  if (!response?.ok) return null;
  const body = await response.json().catch(() => null);
  return body?.data ?? null;
}

export default async function EmbedPage({ params }: { params: { clientId: string } }) {
  const config = await loadConfig(params.clientId);
  if (!config) notFound();

  return (
    <main
      // The partner's palette, scoped to this document. Applied as custom
      // properties rather than classes so a partner can be given any colour
      // without a rebuild.
      style={
        {
          '--brand': config.branding.primaryColor,
          '--brand-accent': config.branding.accentColor,
          fontFamily: `${config.branding.fontFamily}, system-ui, -apple-system, "Segoe UI", sans-serif`,
        } as React.CSSProperties
      }
      className="min-h-0 p-4"
    >
      <EmbedBooking
        clientId={params.clientId}
        displayName={config.displayName}
        logoUrl={config.branding.logoUrl}
        durationMinutes={config.durationMinutes}
        sandbox={config.sandbox}
      />
    </main>
  );
}
