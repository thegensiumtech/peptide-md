import { config } from '../config';
import { logger } from '../logger';
import { InternalSchedulingProvider } from './internal';
import type {
  AvailabilityQuery,
  ConfirmRequest,
  ConfirmedBooking,
  HeldSlot,
  HoldRequest,
  SchedulingProvider,
  TimeSlot,
} from './provider';

/**
 * Cal.com Platform adapter.
 *
 * Awaiting the Cal.com account, so the request shapes below are written to the
 * v2 API but not yet exercised against it. Every method falls back to the
 * internal provider on failure, which means switching this on cannot take the
 * diary down — a Cal.com outage degrades to local scheduling rather than
 * refusing bookings.
 *
 * To activate: set CALCOM_CLIENT_ID / CALCOM_CLIENT_SECRET and
 * SCHEDULING_PROVIDER=calcom, then run the availability contract test.
 */
export class CalComSchedulingProvider implements SchedulingProvider {
  readonly name = 'calcom' as const;

  private readonly fallback = new InternalSchedulingProvider();

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${config.CALCOM_API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-cal-client-id': config.CALCOM_CLIENT_ID,
        'x-cal-secret-key': config.CALCOM_CLIENT_SECRET,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Cal.com ${path} responded ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async getAvailability(query: AvailabilityQuery): Promise<TimeSlot[]> {
    try {
      const params = new URLSearchParams({
        startTime: query.from.toISOString(),
        endTime: query.to.toISOString(),
        duration: String(query.durationMinutes),
      });
      const body = await this.request<{ data: { slots: Record<string, Array<{ time: string }>> } }>(
        `/slots/available?${params.toString()}`
      );

      return Object.values(body.data.slots)
        .flat()
        .map(({ time }) => ({
          startsAt: new Date(time),
          endsAt: new Date(new Date(time).getTime() + query.durationMinutes * 60_000),
        }));
    } catch (error) {
      logger.error({ err: error }, 'Cal.com availability failed — using internal provider');
      return this.fallback.getAvailability(query);
    }
  }

  async hold(request: HoldRequest): Promise<HeldSlot | null> {
    // The local hold is authoritative regardless of provider: it is what makes
    // the guarantee hold across the website and every partner site at once.
    return this.fallback.hold(request);
  }

  async confirm(request: ConfirmRequest): Promise<ConfirmedBooking> {
    try {
      const body = await this.request<{ data: { uid: string; meetingUrl?: string } }>('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          attendee: {
            name: request.patientName,
            email: request.patientEmail,
            timeZone: request.patientTimezone,
          },
          metadata: { peptideBookingId: request.bookingId },
        }),
      });

      await this.fallback.confirm(request);
      return { externalBookingId: body.data.uid, joiningUrl: body.data.meetingUrl ?? null };
    } catch (error) {
      logger.error({ err: error }, 'Cal.com confirm failed — booking held locally');
      return this.fallback.confirm(request);
    }
  }

  async release(holdToken: string): Promise<void> {
    return this.fallback.release(holdToken);
  }

  async cancel(externalBookingId: string): Promise<void> {
    try {
      await this.request(`/bookings/${externalBookingId}/cancel`, { method: 'POST' });
    } catch (error) {
      logger.error({ err: error }, 'Cal.com cancel failed');
    }
    await this.fallback.cancel(externalBookingId);
  }

  async reschedule(externalBookingId: string, slot: TimeSlot): Promise<ConfirmedBooking> {
    try {
      const body = await this.request<{ data: { uid: string; meetingUrl?: string } }>(
        `/bookings/${externalBookingId}/reschedule`,
        { method: 'POST', body: JSON.stringify({ start: slot.startsAt.toISOString() }) }
      );
      return { externalBookingId: body.data.uid, joiningUrl: body.data.meetingUrl ?? null };
    } catch (error) {
      logger.error({ err: error }, 'Cal.com reschedule failed — rescheduled locally');
      return this.fallback.reschedule(externalBookingId, slot);
    }
  }
}
