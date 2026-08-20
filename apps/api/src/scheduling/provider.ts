/**
 * The scheduling port.
 *
 * The scope promises the scheduling provider sits behind our own integration
 * layer, so it can be changed later without rebuilding the partner,
 * attribution or invoicing work. This interface is that layer.
 *
 * Two adapters implement it:
 *  - `internal`. Postgres-backed, used until the Cal.com account exists, and
 *    the fallback if Cal.com is ever unavailable.
 *  - `calcom`, the Cal.com Platform API.
 *
 * Nothing above this interface knows which is in use.
 */

export interface TimeSlot {
  startsAt: Date;
  endsAt: Date;
}

export interface AvailabilityQuery {
  doctorId: string;
  /** Inclusive range, UTC. */
  from: Date;
  to: Date;
  durationMinutes: number;
}

export interface HoldRequest extends TimeSlot {
  doctorId: string;
  channel: 'DIRECT' | 'PARTNER';
  partnerId?: string | null;
  holdMinutes: number;
}

export interface HeldSlot {
  holdToken: string;
  expiresAt: Date;
  startsAt: Date;
  endsAt: Date;
}

export interface ConfirmRequest {
  holdToken: string;
  bookingId: string;
  patientName: string;
  patientEmail: string;
  patientTimezone: string;
}

export interface ConfirmedBooking {
  /** The provider's own id, mirrored onto our booking record. */
  externalBookingId: string;
  joiningUrl: string | null;
}

export interface SchedulingProvider {
  readonly name: 'internal' | 'calcom';

  /** Free slots, honouring the weekly pattern, overrides, holds and bookings. */
  getAvailability(query: AvailabilityQuery): Promise<TimeSlot[]>;

  /**
   * Hold a slot for one channel. Must be atomic across every channel, when
   * two people reach for the same time, exactly one hold succeeds.
   * Returns null when the slot has just gone.
   */
  hold(request: HoldRequest): Promise<HeldSlot | null>;

  /** Turn a hold into a confirmed appointment. */
  confirm(request: ConfirmRequest): Promise<ConfirmedBooking>;

  /** Give a held slot back, on payment failure or abandonment. */
  release(holdToken: string): Promise<void>;

  /** Free a confirmed slot and return it to the calendar. */
  cancel(externalBookingId: string): Promise<void>;

  /** Move a confirmed appointment, keeping the same booking. */
  reschedule(externalBookingId: string, slot: TimeSlot): Promise<ConfirmedBooking>;
}
