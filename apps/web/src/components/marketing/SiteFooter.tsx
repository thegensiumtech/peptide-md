import Link from 'next/link';
import { Wordmark } from './Wordmark';

const SITE_LINKS = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/about-peptides', label: 'About peptides' },
  { href: '/the-doctor', label: 'The doctor' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
  { href: '/manage', label: 'Manage a booking' },
];

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/terms', label: 'Terms of service' },
  { href: '/medical-disclaimer', label: 'Medical disclaimer' },
];

export function SiteFooter() {
  return (
    <footer className="mt-section border-t border-line bg-paper-deep">
      <div className="shell py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-micro leading-relaxed text-muted">
              Private consultations with a UK-registered doctor about peptide therapy. We sell
              advice, not compounds.
            </p>
          </div>

          <FooterColumn title="Site" links={SITE_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />

          <div>
            <h2 className="eyebrow">Sign in</h2>
            <ul className="mt-4 grid gap-2.5">
              <li>
                <Link
                  href="/admin/login"
                  className="flex min-h-8 items-center text-micro text-muted transition-colors hover:text-ink"
                >
                  Peptide MD team
                </Link>
              </li>
              <li>
                <Link
                  href="/partner/login"
                  className="flex min-h-8 items-center text-micro text-muted transition-colors hover:text-ink"
                >
                  Partner portal
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
            © {new Date().getFullYear()} Peptide MD
          </p>
          <p className="max-w-lg text-micro leading-relaxed text-muted">
            Consultations are private medical advice. Peptide MD does not supply, prescribe or
            dispense any compound.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h2 className="eyebrow">{title}</h2>
      <ul className="mt-4 grid gap-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex min-h-8 items-center text-micro text-muted transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
