import Link from 'next/link';
import type { SessionUser } from '@peptide/shared';
import { signOut } from '@/lib/auth/actions';
import { Wordmark } from '@/components/marketing/Wordmark';
import { SkipLink } from '@/components/ui/SkipLink';
import { AdminNav } from './AdminNav';
import { MobileNav } from './MobileNav';

const ROLE_LABEL: Record<SessionUser['role'], string> = {
  admin: 'Administrator',
  doctor: 'Doctor',
  partner: 'Partner',
};

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Frame for every admin screen: persistent navigation, the signed-in identity
 * and its role, and breadcrumbs. Breadcrumbs are not decoration here, they
 * are the guaranteed way back out of a detail screen without browser history.
 */
export function AdminShell({
  user,
  crumbs = [],
  title,
  description,
  actions,
  children,
}: {
  user: SessionUser;
  crumbs?: Crumb[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <SkipLink />

      <aside className="hidden border-r border-line bg-paper-deep lg:flex lg:h-screen lg:flex-col lg:sticky lg:top-0">
        <div className="border-b border-line px-5 py-4">
          <Link href="/admin" aria-label="Peptide MD admin, dashboard">
            <Wordmark />
          </Link>
          <p className="mt-1.5 font-mono text-eyebrow uppercase tracking-[0.16em] text-muted">
            {user.role === 'doctor' ? 'Doctor console' : 'Admin panel'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-6">
          <AdminNav user={user} />
        </div>

        <div className="border-t border-line px-5 py-4">
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="mt-0.5 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
            {ROLE_LABEL[user.role]}
          </p>
          <form action={signOut} className="mt-3">
            <button
              type="submit"
              className="text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <MobileNav user={user} />

        <header className="border-b border-line bg-surface">
          <div className="px-5 py-6 sm:px-8">
            {crumbs.length > 0 ? (
              <nav aria-label="Breadcrumb">
                <ol className="flex flex-wrap items-center gap-2 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                  {crumbs.map((crumb, index) => (
                    <li key={crumb.label} className="flex items-center gap-2">
                      {crumb.href ? (
                        <Link href={crumb.href} className="transition-colors hover:text-ink">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span>{crumb.label}</span>
                      )}
                      {index < crumbs.length - 1 ? <span aria-hidden>/</span> : null}
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}

            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="font-display text-h2 font-medium tracking-tight text-ink">
                  {title}
                </h1>
                {description ? (
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
                ) : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 px-5 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
