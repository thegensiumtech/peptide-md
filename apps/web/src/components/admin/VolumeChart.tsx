'use client';

import { useState } from 'react';
import type { VolumeBySource } from '@peptide/shared';
import { cn } from '@/lib/cn';
import { formatPeriod } from '@/lib/format';

/**
 * Booking volume by source, month by month.
 *
 * Stacked because the admin needs two readings from one mark: total volume,
 * and how much of it the partner channel is carrying. Two series get a legend
 * and a hover breakdown, so identity is never carried by colour alone.
 */
export function VolumeChart({ data }: { data: VolumeBySource[] }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <figure className="m-0">
      <div className="flex flex-wrap items-center gap-4">
        <Legend swatch="bg-chart-direct" label="Direct" />
        <Legend swatch="bg-chart-partner" label="Partner" />
      </div>

      <div className="mt-6 flex h-48 items-end gap-2 sm:gap-3">
        {data.map((month) => {
          const isActive = active === month.period;
          const directPct = (month.direct / max) * 100;
          const partnerPct = (month.partner / max) * 100;

          return (
            <div
              key={month.period}
              className="relative flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setActive(month.period)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(month.period)}
              onBlur={() => setActive(null)}
            >
              {isActive ? (
                <div
                  role="tooltip"
                  className="absolute bottom-full left-1/2 z-10 mb-2 w-40 -translate-x-1/2 rounded border border-line bg-surface p-3 shadow-lift"
                >
                  <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                    {formatPeriod(month.period)}
                  </p>
                  <dl className="mt-2 grid gap-1">
                    <TooltipRow swatch="bg-chart-direct" label="Direct" value={month.direct} />
                    <TooltipRow swatch="bg-chart-partner" label="Partner" value={month.partner} />
                    <div className="mt-1 flex items-center justify-between border-t border-line pt-1.5">
                      <dt className="text-micro text-muted">Total</dt>
                      <dd className="font-mono text-micro text-ink">{month.total}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {/* Partner sits on top; a 2px surface gap keeps the two
                  segments legible without a stroke. */}
              <button
                type="button"
                aria-label={`${formatPeriod(month.period)}: ${month.direct} direct, ${month.partner} partner, ${month.total} total`}
                className="flex w-full flex-col justify-end gap-0.5 rounded-t focus-visible:outline-none"
                style={{ height: '100%' }}
              >
                <span
                  className={cn(
                    'w-full rounded-t bg-chart-partner transition-opacity duration-150',
                    active && !isActive && 'opacity-40'
                  )}
                  style={{ height: `${partnerPct}%` }}
                />
                <span
                  className={cn(
                    'w-full bg-chart-direct transition-opacity duration-150',
                    active && !isActive && 'opacity-40'
                  )}
                  style={{ height: `${directPct}%` }}
                />
              </button>

              <span className="mt-2 block text-center font-mono text-eyebrow uppercase tracking-[0.1em] text-muted">
                {formatPeriod(month.period).slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>

      {/* The table is the accessible equivalent, not a fallback. */}
      <details className="mt-5">
        <summary className="cursor-pointer text-micro text-muted transition-colors hover:text-ink">
          View as a table
        </summary>
        <table className="mt-3 w-full border-collapse text-left text-micro">
          <thead>
            <tr>
              <th className="border-b border-line py-2 font-medium text-muted">Month</th>
              <th className="border-b border-line py-2 text-right font-medium text-muted">Direct</th>
              <th className="border-b border-line py-2 text-right font-medium text-muted">Partner</th>
              <th className="border-b border-line py-2 text-right font-medium text-muted">Total</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {data.map((month) => (
              <tr key={month.period}>
                <td className="border-b border-line py-2 text-ink">{formatPeriod(month.period)}</td>
                <td className="border-b border-line py-2 text-right text-ink">{month.direct}</td>
                <td className="border-b border-line py-2 text-right text-ink">{month.partner}</td>
                <td className="border-b border-line py-2 text-right text-ink">{month.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className={cn('h-2.5 w-2.5 rounded-sm', swatch)} />
      <span className="text-micro text-muted">{label}</span>
    </span>
  );
}

function TooltipRow({
  swatch,
  label,
  value,
}: {
  swatch: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-micro text-muted">
        <span aria-hidden className={cn('h-2 w-2 rounded-sm', swatch)} />
        {label}
      </dt>
      <dd className="font-mono text-micro text-ink">{value}</dd>
    </div>
  );
}
