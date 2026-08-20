'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { BOOKING_STATUSES, type Partner } from '@peptide/shared';
import { Select, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No show',
};

/**
 * Filters live in the URL, not in component state.
 *
 * That is what makes a filtered list shareable, survivable across a refresh,
 * and, the reason it matters most here, restorable when the admin comes back
 * from a booking detail screen.
 */
export function BookingFilters({
  partners,
  showChannel = true,
}: {
  partners: Partner[];
  showChannel?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
      next.delete('page');
      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router]
  );

  const hasFilters = ['channel', 'status', 'partner', 'from', 'to', 'q'].some((k) =>
    params.has(k)
  );

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="grid min-w-48 flex-1 gap-1.5">
        <label htmlFor="q" className="text-micro font-medium text-ink-soft">
          Search
        </label>
        <Input
          id="q"
          defaultValue={params.get('q') ?? ''}
          placeholder="Name, email or reference"
          onChange={(event) => setParam('q', event.target.value)}
        />
      </div>

      {showChannel ? (
        <div className="grid gap-1.5">
          <label htmlFor="channel" className="text-micro font-medium text-ink-soft">
            Source
          </label>
          <Select
            id="channel"
            defaultValue={params.get('channel') ?? 'all'}
            onChange={(event) => setParam('channel', event.target.value)}
          >
            <option value="all">All sources</option>
            <option value="direct">Direct</option>
            <option value="partner">Partner</option>
          </Select>
        </div>
      ) : null}

      {showChannel && partners.length > 0 ? (
        <div className="grid gap-1.5">
          <label htmlFor="partner" className="text-micro font-medium text-ink-soft">
            Partner
          </label>
          <Select
            id="partner"
            defaultValue={params.get('partner') ?? 'all'}
            onChange={(event) => setParam('partner', event.target.value)}
          >
            <option value="all">All partners</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <label htmlFor="status" className="text-micro font-medium text-ink-soft">
          Status
        </label>
        <Select
          id="status"
          defaultValue={params.get('status') ?? 'all'}
          onChange={(event) => setParam('status', event.target.value)}
        >
          <option value="all">Any status</option>
          {BOOKING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="from" className="text-micro font-medium text-ink-soft">
          From
        </label>
        <Input
          id="from"
          type="date"
          defaultValue={params.get('from') ?? ''}
          onChange={(event) => setParam('from', event.target.value)}
          className="font-mono"
        />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="to" className="text-micro font-medium text-ink-soft">
          To
        </label>
        <Input
          id="to"
          type="date"
          defaultValue={params.get('to') ?? ''}
          onChange={(event) => setParam('to', event.target.value)}
          className="font-mono"
        />
      </div>

      {hasFilters ? (
        <Button variant="ghost" size="md" onClick={() => router.replace(pathname)}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}
