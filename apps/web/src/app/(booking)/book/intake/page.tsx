import type { Metadata } from 'next';
import { BookingShell } from '@/components/booking/BookingShell';
import { IntakeForm } from '@/components/booking/IntakeForm';
import { getConsultation } from '@/lib/api/public';

export const metadata: Metadata = {
  title: 'Before your consultation',
  description: 'A short form so the doctor knows what the consultation is about before you join.',
};

export default async function IntakePage() {
  const consultationRes = await getConsultation();
  if (!consultationRes.success) throw new Error('Booking data unavailable');

  return (
    <BookingShell step="intake">
      <IntakeForm durationMinutes={consultationRes.data.durationMinutes} />
    </BookingShell>
  );
}
