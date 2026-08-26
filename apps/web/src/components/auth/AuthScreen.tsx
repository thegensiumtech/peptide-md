import Link from 'next/link';
import { Wordmark } from '@/components/marketing/Wordmark';
import { SkipLink } from '@/components/ui/SkipLink';

/**
 * Shared frame for both login screens. The two areas look deliberately alike
 * but are never the same door, each names who it is for and links across to
 * the other, so a partner never gets stuck at the admin login.
 */
export function AuthScreen({
  eyebrow,
  title,
  lede,
  crossLink,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  crossLink: { href: string; label: string };
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <SkipLink />
      <header className="border-b border-line">
        <div className="shell flex h-16 items-center">
          <Link href="/" aria-label="Peptide MD, home">
            <Wordmark />
          </Link>
        </div>
      </header>

      <main id="main" className="shell py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <div className="mx-auto w-full max-w-md lg:mx-0">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="mt-5 font-display text-h1 font-medium tracking-[-0.02em] text-ink">
              {title}
            </h1>
            <p className="mt-4 text-lead leading-relaxed text-muted">{lede}</p>

            <div className="mt-10">{children}</div>

            <div className="mt-8 border-t border-line pt-6">
              <Link
                href={crossLink.href}
                className="text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
              >
                {crossLink.label}
              </Link>
            </div>
          </div>

          {aside ? <div className="lg:pt-16">{aside}</div> : null}
        </div>
      </main>
    </div>
  );
}

/** Demo account picker, shown only because this is a static build. */
export function DemoAccounts({
  accounts,
}: {
  accounts: Array<{ name: string; email: string; hint: string }>;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-6">
      <p className="eyebrow">Development · seeded accounts</p>
      <p className="mt-3 text-micro leading-relaxed text-muted">
        Seeded by the database, all using the same development password. Authentication
        is real: JWT with bcrypt, verified by the API.
      </p>
      <ul className="mt-5 divide-y divide-line border-t border-line">
        {accounts.map((account) => (
          <li key={account.email} className="py-3.5">
            <p className="text-sm font-medium text-ink">{account.name}</p>
            <p className="mt-0.5 font-mono text-micro text-accent">{account.email}</p>
            <p className="mt-1 text-micro leading-relaxed text-muted">{account.hint}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
