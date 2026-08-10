/**
 * Doctor profile and availability.
 *
 * Availability is owned by the scheduling core in production; these types are
 * the shape the platform reads and writes through its integration layer, which
 * is what keeps the provider swappable.
 */

export interface DoctorProfile {
  id: string;
  name: string;
  /** Post-nominals shown next to the name, e.g. 'MBBS, MRCGP'. */
  credentials: string;
  gmcNumber: string;
  photoUrl: string | null;
  headline: string;
  bio: string;
  specialisms: string[];
  languages: string[];
  timezone: string;
}

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** One working window on one weekday, in the doctor's own timezone. */
export interface AvailabilityWindow {
  id: string;
  day: Weekday;
  /** 'HH:mm' 24-hour, doctor-local. */
  startTime: string;
  endTime: string;
}

export const OVERRIDE_KINDS = ['blocked', 'extra'] as const;
/** 'blocked' removes capacity that the weekly pattern would otherwise offer. */
export type OverrideKind = (typeof OVERRIDE_KINDS)[number];

/** A one-off change on a specific date, layered over the weekly pattern. */
export interface AvailabilityOverride {
  id: string;
  /** 'YYYY-MM-DD' */
  date: string;
  kind: OverrideKind;
  /** Null on a whole-day block, e.g. a holiday. */
  startTime: string | null;
  endTime: string | null;
  note: string;
}

export interface Availability {
  timezone: string;
  weekly: AvailabilityWindow[];
  overrides: AvailabilityOverride[];
}
