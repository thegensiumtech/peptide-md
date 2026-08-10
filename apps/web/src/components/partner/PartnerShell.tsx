import Link from 'next/link';
import type { Partner, SessionUser } from '@peptide/shared';
import { signOut } from '@/lib/auth/actions';
import { Wordmark } from '@/components/marketing/Wordmark';
import { SkipLink } from '@/components/ui/SkipLink';
import { PartnerNav } from './PartnerNav';

/**
 * Frame for the partner portal.
 *
 * Deliberately narrower than the admin panel: a partner has four screens and
 * no navigation into anything else. The partner's own name is shown throughout
 * so it is always obvious whose data is on screen.
 */
export function PartnerShell({
  user,
  partner,
  title,
  description,
  actions,
  children,
}: {
  user: SessionUser;
  partner: Partner;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <SkipLink />

      <header className="border-b border-line bg-paper-deep">
        <div className="shell flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/partner/bookings" aria-label="Partner portal — bookings">
              <Wordmark />
            </Link>
            <span aria-hidden className="hidden h-5 w-px bg-line sm:block" />
            <p className="hidden font-mono text-eyebrow uppercase tracking-[0.16em] text-muted sm:block">
              Partner portal
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-micro font-medium text-ink">{partner.name}</p>
              <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                {user.name}
              </p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="shell">
          <PartnerNav />
        </div>
      </header>

      <main id="main" className="shell py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-h2 font-medium tracking-tight text-ink">{title}</h1>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
