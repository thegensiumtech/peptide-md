import type { Metadata } from 'next';
import { BookingShell } from '@/components/booking/BookingShell';
import { SlotPicker } from '@/components/booking/SlotPicker';

export const metadata: Metadata = {
  title: 'Choose a time',
  description: 'Pick a time from the doctor’s live availability, shown in your own time zone.',
};

/**
 * Availability is read in the browser rather than on the server: the patient
 * arrives here straight back from Stripe, and the diary may have moved while
 * they were away. A server-rendered list would be stale before it painted.
 */
export default function SlotPage() {
  return (
    <BookingShell step="slot">
      <SlotPicker />
    </BookingShell>
  );
}
