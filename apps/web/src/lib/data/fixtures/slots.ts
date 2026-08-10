import type { DaySlots, Slot, Weekday } from '@peptide/shared';
import { WEEKDAYS } from '@peptide/shared';
import { NOW_ISO, addMinutes } from '@/lib/clock';
import { availability } from './doctor';
import { platformSettings } from './settings';

const SLOT_MINUTES = platformSettings.consultation.durationMinutes;
const DAYS_AHEAD = 21;

/**
 * Deterministic "already taken" marker.
 *
 * Real availability comes from the scheduling core. Here it is derived from a
 * stable hash so the same slots are taken on every render — no Math.random,
 * which would desynchronise server and client output.
 */
function isTaken(key: string): boolean {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 1000;
  }
  return hash % 10 < 3;
}

function weekdayOf(date: Date): Weekday {
  // getUTCDay: 0 = Sunday. WEEKDAYS starts at Monday.
  return WEEKDAYS[(date.getUTCDay() + 6) % 7]!;
}

function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00.000Z`).toISOString();
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Slots the doctor's weekly pattern offers, with date overrides applied:
 * a blocked whole day removes it, a blocked window trims it, an extra window
 * adds capacity that the weekly pattern does not carry.
 */
function buildDay(date: Date): DaySlots {
  const key = dateKey(date);
  const day = weekdayOf(date);

  const wholeDayBlocked = availability.overrides.some(
    (o) => o.date === key && o.kind === 'blocked' && o.startTime === null
  );
  if (wholeDayBlocked) return { date: key, slots: [] };

  const windows = [
    ...availability.weekly.filter((w) => w.day === day),
    ...availability.overrides
      .filter((o) => o.date === key && o.kind === 'extra' && o.startTime && o.endTime)
      .map((o) => ({ id: o.id, day, startTime: o.startTime!, endTime: o.endTime! })),
  ];

  const blockedWindows = availability.overrides.filter(
    (o) => o.date === key && o.kind === 'blocked' && o.startTime && o.endTime
  );

  const slots: Slot[] = [];

  for (const window of windows) {
    let cursor = toIso(key, window.startTime);
    const end = toIso(key, window.endTime);

    while (new Date(cursor).getTime() + SLOT_MINUTES * 60_000 <= new Date(end).getTime()) {
      const slotStart = cursor;
      const slotEnd = addMinutes(cursor, SLOT_MINUTES);

      const insideBlocked = blockedWindows.some(
        (b) =>
          new Date(slotStart) >= new Date(toIso(key, b.startTime!)) &&
          new Date(slotStart) < new Date(toIso(key, b.endTime!))
      );
      const inPast = new Date(slotStart) <= new Date(NOW_ISO);

      if (!insideBlocked && !inPast) {
        slots.push({
          startsAt: slotStart,
          endsAt: slotEnd,
          available: !isTaken(`${key}-${window.startTime}-${slotStart}`),
        });
      }

      cursor = slotEnd;
    }
  }

  slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { date: key, slots };
}

export const availableDays: DaySlots[] = Array.from({ length: DAYS_AHEAD }, (_, offset) => {
  const date = new Date(NOW_ISO);
  date.setUTCDate(date.getUTCDate() + offset);
  return buildDay(date);
}).filter((day) => day.slots.length > 0);
