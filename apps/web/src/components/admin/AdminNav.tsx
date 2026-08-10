'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Permission, SessionUser } from '@peptide/shared';
import { can } from '@peptide/shared';
import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  label: string;
  /** Any one of these grants the item. */
  permissions: Permission[];
  exact?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { href: '/admin', label: 'Dashboard', permissions: ['bookings.viewAll', 'bookings.viewOwn'], exact: true },
      { href: '/admin/bookings', label: 'Bookings', permissions: ['bookings.viewAll', 'bookings.viewOwn'] },
    ],
  },
  {
    title: 'Doctor',
    items: [
      { href: '/admin/availability', label: 'Availability', permissions: ['doctor.manageAvailability'] },
      { href: '/admin/doctor-profile', label: 'Public profile', permissions: ['doctor.editProfile'] },
    ],
  },
  {
    title: 'Commercial',
    items: [
      { href: '/admin/partners', label: 'Partners', permissions: ['partners.manage'] },
      { href: '/admin/invoices', label: 'Invoices', permissions: ['invoices.manage'] },
    ],
  },
  {
    title: 'Platform',
    items: [{ href: '/admin/settings', label: 'Settings', permissions: ['settings.manage'] }],
  },
];

/**
 * Navigation is filtered by permission, but that is presentation only — the
 * middleware and the screens enforce the same rules. A visible link is never
 * what makes a screen reachable.
 */
export function AdminNav({ user, onNavigate }: { user: SessionUser; onNavigate?: () => void }) {
  const pathname = usePathname();

  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.permissions.some((p) => can(user, p))),
  })).filter((group) => group.items.length > 0);

  return (
    <nav aria-label="Admin" className="grid gap-7">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="eyebrow px-3">{group.title}</p>
          <ul className="mt-3 grid gap-0.5">
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors duration-150',
                      active
                        ? 'bg-surface font-medium text-ink shadow-raise'
                        : 'text-muted hover:bg-surface/60 hover:text-ink'
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'h-1.5 w-1.5 rounded-full transition-colors',
                        active ? 'bg-accent' : 'bg-line'
                      )}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
