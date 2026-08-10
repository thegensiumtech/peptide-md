'use client';

import { useState } from 'react';
import type { Availability, AvailabilityOverride, AvailabilityWindow, Weekday } from '@peptide/shared';
import { WEEKDAYS } from '@peptide/shared';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { SavedNotice } from './SavedNotice';

const DAY_LABEL: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

/**
 * Weekly pattern plus date overrides.
 *
 * The two are kept visually distinct because they behave differently: the
 * pattern is the standing rule, an override is a deliberate exception to it on
 * one date. Collapsing them into one list is how availability editors become
 * confusing.
 */
export function AvailabilityEditor({ availability }: { availability: Availability }) {
  const [weekly, setWeekly] = useState<AvailabilityWindow[]>(availability.weekly);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>(availability.overrides);
  const [saved, setSaved] = useState(false);
  const [nextId, setNextId] = useState(1);

  function addWindow(day: Weekday) {
    setWeekly([
      ...weekly,
      { id: `new_${nextId}`, day, startTime: '09:00', endTime: '12:00' },
    ]);
    setNextId(nextId + 1);
  }

  function updateWindow(id: string, patch: Partial<AvailabilityWindow>) {
    setWeekly(weekly.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }

  function removeWindow(id: string) {
    setWeekly(weekly.filter((w) => w.id !== id));
  }

  const totalHours = weekly.reduce((sum, w) => {
    const [sh, sm] = w.startTime.split(':').map(Number);
    const [eh, em] = w.endTime.split(':').map(Number);
    return sum + (eh! * 60 + em! - (sh! * 60 + sm!)) / 60;
  }, 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="grid gap-6">
        <Card>
          <CardHeader
            title="Weekly pattern"
            description={`Times are in ${availability.timezone}. ${totalHours.toFixed(1)} hours a week.`}
          />
          <CardBody className="grid gap-6">
            {WEEKDAYS.map((day) => {
              const windows = weekly.filter((w) => w.day === day);
              return (
                <div key={day} className="grid gap-3 border-b border-line pb-5 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-4">
                    <h3
                      className={cn(
                        'text-sm font-medium',
                        windows.length > 0 ? 'text-ink' : 'text-muted'
                      )}
                    >
                      {DAY_LABEL[day]}
                    </h3>
                    <Button type="button" variant="ghost" size="sm" onClick={() => addWindow(day)}>
                      Add a window
                    </Button>
                  </div>

                  {windows.length === 0 ? (
                    <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                      Not working
                    </p>
                  ) : (
                    <ul className="grid gap-2">
                      {/* Named `slot`, not `window` — shadowing the global
                          inside a component scope is how a stray
                          window.setTimeout call becomes a runtime crash. */}
                      {windows.map((slot) => (
                        <li key={slot.id} className="flex flex-wrap items-center gap-3">
                          <Input
                            type="time"
                            value={slot.startTime}
                            onChange={(event) =>
                              updateWindow(slot.id, { startTime: event.target.value })
                            }
                            aria-label={`${DAY_LABEL[day]} start time`}
                            className="w-32 font-mono"
                          />
                          <span aria-hidden className="text-muted">
                            –
                          </span>
                          <Input
                            type="time"
                            value={slot.endTime}
                            onChange={(event) =>
                              updateWindow(slot.id, { endTime: event.target.value })
                            }
                            aria-label={`${DAY_LABEL[day]} end time`}
                            className="w-32 font-mono"
                          />
                          {/* The late windows are what make the Australian
                              side of the business work — worth naming. */}
                          {Number(slot.startTime.split(':')[0]) >= 20 ? (
                            <span className="rounded border border-amber/25 bg-amber-tint px-2 py-0.5 font-mono text-eyebrow uppercase tracking-[0.12em] text-amber">
                              Australia friendly
                            </span>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeWindow(slot.id)}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </CardBody>
        </Card>

        <OverridesCard overrides={overrides} onChange={setOverrides} />
      </div>

      <div className="grid gap-6 xl:sticky xl:top-8 xl:self-start">
        <Card>
          <CardBody>
            <SavedNotice
              show={saved}
              message="Availability saved. It has applied to every channel."
              onDismiss={() => setSaved(false)}
            />
            <Button size="lg" className="w-full" onClick={() => setSaved(true)}>
              Save availability
            </Button>
            <p className="mt-4 text-micro leading-relaxed text-muted">
              Saving updates the shared calendar immediately. A time you block here disappears from
              this website and from every partner site at the same moment.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="How this works" />
          <CardBody>
            <ul className="grid gap-4">
              {[
                {
                  title: 'The pattern is the standing rule',
                  body: 'It repeats every week until you change it.',
                },
                {
                  title: 'Overrides beat the pattern',
                  body: 'A blocked date removes capacity the pattern would have offered. An extra window adds capacity it would not.',
                },
                {
                  title: 'Booked time is never offered twice',
                  body: 'Appointments already in the diary are held regardless of what the pattern says.',
                },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                  <div>
                    <p className="text-sm text-ink">{item.title}</p>
                    <p className="mt-0.5 text-micro leading-relaxed text-muted">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function OverridesCard({
  overrides,
  onChange,
}: {
  overrides: AvailabilityOverride[];
  onChange: (next: AvailabilityOverride[]) => void;
}) {
  const [date, setDate] = useState('');
  const [kind, setKind] = useState<'blocked' | 'extra'>('blocked');
  const [note, setNote] = useState('');
  const [seq, setSeq] = useState(1);

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!date) return;
    onChange([
      ...overrides,
      {
        id: `ov_new_${seq}`,
        date,
        kind,
        startTime: null,
        endTime: null,
        note: note.trim() || (kind === 'blocked' ? 'Blocked' : 'Extra session'),
      },
    ]);
    setSeq(seq + 1);
    setDate('');
    setNote('');
  }

  const sorted = [...overrides].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card>
      <CardHeader
        title="One-off changes"
        description="Holidays, blocked days and extra sessions layered over the weekly pattern."
      />
      {sorted.length === 0 ? (
        <EmptyState
          title="No one-off changes"
          description="The weekly pattern applies every week. Add a change below when a particular date differs."
        />
      ) : (
        <ul className="divide-y divide-line">
          {sorted.map((override) => (
            <li key={override.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-ink">
                    {formatDate(`${override.date}T12:00:00.000Z`, 'Europe/London')}
                  </span>
                  <span
                    className={cn(
                      'rounded border px-2 py-0.5 font-mono text-eyebrow uppercase tracking-[0.12em]',
                      override.kind === 'blocked'
                        ? 'border-danger/25 bg-danger-tint text-danger'
                        : 'border-signal/25 bg-signal-tint text-signal'
                    )}
                  >
                    {override.kind === 'blocked' ? 'Blocked' : 'Extra'}
                  </span>
                  {override.startTime ? (
                    <span className="font-mono text-eyebrow text-muted">
                      {override.startTime}–{override.endTime}
                    </span>
                  ) : (
                    <span className="font-mono text-eyebrow text-muted">All day</span>
                  )}
                </div>
                <p className="mt-1 truncate text-micro text-muted">{override.note}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(overrides.filter((o) => o.id !== override.id))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <CardBody className="border-t border-line">
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <Field label="Date" htmlFor="ov-date">
            <Input
              id="ov-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Change" htmlFor="ov-kind">
            <Select
              id="ov-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as 'blocked' | 'extra')}
            >
              <option value="blocked">Block the day</option>
              <option value="extra">Add an extra session</option>
            </Select>
          </Field>
          <Field label="Note" htmlFor="ov-note" className="min-w-48 flex-1">
            <Input
              id="ov-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Annual leave"
            />
          </Field>
          <Button type="submit" variant="secondary" size="md">
            Add
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
