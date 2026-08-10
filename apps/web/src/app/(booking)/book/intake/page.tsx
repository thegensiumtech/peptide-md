import type { Metadata } from 'next';
import { BookingShell } from '@/components/booking/BookingShell';
import { IntakeForm } from '@/components/booking/IntakeForm';

export const metadata: Metadata = {
  title: 'Before your consultation',
  description: 'A short form so the doctor knows what the consultation is about before you join.',
};

export default function IntakePage() {
  return (
    <BookingShell step="intake">
      <IntakeForm />
    </BookingShell>
  );
}
