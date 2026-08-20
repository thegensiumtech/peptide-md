'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SessionUser } from '@peptide/shared';
import { signOut } from '@/lib/auth/actions';
import { Wordmark } from '@/components/marketing/Wordmark';
import { AdminNav } from './AdminNav';

export function MobileNav({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-line bg-paper-deep lg:hidden">
      <div className="flex h-14 items-center justify-between px-5">
        <Link href="/admin" aria-label="Peptide MD admin, dashboard">
          <Wordmark />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="admin-mobile-nav"
          className="grid h-9 w-9 place-items-center rounded border border-line bg-surface"
        >
          <span className="sr-only">{open ? 'Close navigation' : 'Open navigation'}</span>
          <span aria-hidden className="grid gap-1">
            <span className="block h-px w-4 bg-ink" />
            <span className="block h-px w-4 bg-ink" />
            <span className="block h-px w-4 bg-ink" />
          </span>
        </button>
      </div>

      {open ? (
        <div id="admin-mobile-nav" className="border-t border-line px-3 py-5">
          <AdminNav user={user} onNavigate={() => setOpen(false)} />
          <div className="mt-6 border-t border-line px-3 pt-4">
            <p className="text-sm font-medium text-ink">{user.name}</p>
            <form action={signOut} className="mt-2">
              <button
                type="submit"
                className="text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
