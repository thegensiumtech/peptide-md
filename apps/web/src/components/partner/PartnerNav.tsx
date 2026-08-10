'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const ITEMS = [
  { href: '/partner/bookings', label: 'Bookings' },
  { href: '/partner/invoices', label: 'Invoices' },
  { href: '/partner/api-credentials', label: 'API credentials' },
];

export function PartnerNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Partner portal">
      <ul className="-mb-px flex gap-6 overflow-x-auto">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block whitespace-nowrap border-b-2 py-3 text-sm transition-colors duration-150',
                  active
                    ? 'border-accent text-ink'
                    : 'border-transparent text-muted hover:text-ink'
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
