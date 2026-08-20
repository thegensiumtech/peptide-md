'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { ButtonLink } from '@/components/ui/Button';
import { Wordmark } from './Wordmark';

const NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/about-peptides', label: 'About peptides' },
  { href: '/the-doctor', label: 'The doctor' },
  { href: '/guide', label: 'Free guide' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="shell flex h-16 items-center justify-between gap-6">
        <Link href="/" className="shrink-0" aria-label="Peptides MD, home">
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative py-1 text-sm transition-colors duration-150',
                  active ? 'text-ink' : 'text-muted hover:text-ink'
                )}
              >
                {item.label}
                {/* The active marker is a bond tick, echoing the sequence rail. */}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 left-1/2 h-px w-4 -translate-x-1/2 bg-accent"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          {/* A utility link, not a section of the site, it sits with the
              action rather than in the navigation it would otherwise crowd. */}
          <Link
            href="/manage"
            aria-current={pathname.startsWith('/manage') ? 'page' : undefined}
            className={cn(
              'hidden text-sm transition-colors duration-150 md:inline',
              pathname.startsWith('/manage') ? 'text-ink' : 'text-muted hover:text-ink'
            )}
          >
            Manage booking
          </Link>
          <ButtonLink href="/book" size="sm" className="hidden sm:inline-flex">
            Book a consultation
          </ButtonLink>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            className="grid h-9 w-9 place-items-center rounded border border-line text-ink lg:hidden"
          >
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            <span aria-hidden className="grid gap-1">
              <span className="block h-px w-4 bg-ink" />
              <span className="block h-px w-4 bg-ink" />
              <span className="block h-px w-4 bg-ink" />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <div id="site-menu" className="border-t border-line bg-paper lg:hidden">
          <nav aria-label="Main" className="shell grid gap-1 py-4">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={cn(
                  'rounded px-2 py-2 text-sm',
                  pathname === item.href ? 'bg-paper-deep text-ink' : 'text-muted'
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/manage"
              onClick={() => setOpen(false)}
              aria-current={pathname.startsWith('/manage') ? 'page' : undefined}
              className={cn(
                'rounded px-2 py-2 text-sm',
                pathname.startsWith('/manage') ? 'bg-paper-deep text-ink' : 'text-muted'
              )}
            >
              Manage booking
            </Link>
            <ButtonLink href="/book" size="md" className="mt-2 sm:hidden">
              Book a consultation
            </ButtonLink>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
