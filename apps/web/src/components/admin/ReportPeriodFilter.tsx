'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

/**
 * The reporting window, held in the URL like every other filter here.
 *
 * Two month selects rather than a date range picker. The report is bucketed by
 * month and nothing finer is ever drawn, so offering days would promise a
 * precision the figures do not have and invite a range that starts mid month.
 */
export function ReportPeriodFilter({
  from,
  to,
  options,
}: {
  from: string;
  to: string;
  /** Every period offered, oldest first. */
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      next.set(key, value);

      // Keep the window the right way round. Dragging "from" past "to" is an
      // easy slip with two independent selects, and the API would silently
      // fall back to its default window, which reads as the filter being
      // ignored.
      const nextFrom = next.get('from') ?? from;
      const nextTo = next.get('to') ?? to;
      if (nextFrom > nextTo) next.set(key === 'from' ? 'to' : 'from', value);

      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router, from, to]
  );

  return (
    <div className="flex flex-wrap items-end gap-3 rounded border border-line bg-surface px-4 py-3">
      <label className="grid gap-1.5">
        <span className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">From</span>
        <Select
          id="from"
          name="from"
          value={from}
          onChange={(event) => setParam('from', event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>

      <label className="grid gap-1.5">
        <span className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">To</span>
        <Select
          id="to"
          name="to"
          value={to}
          onChange={(event) => setParam('to', event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>

      {params.has('from') || params.has('to') ? (
        <Button variant="ghost" size="sm" onClick={() => router.replace(pathname)}>
          Reset to the last six months
        </Button>
      ) : null}
    </div>
  );
}
