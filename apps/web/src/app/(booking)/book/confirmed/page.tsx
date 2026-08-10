import type { Metadata } from 'next';
import { getSettings } from '@/lib/data/client';
import { BookingShell } from '@/components/booking/BookingShell';
import { ConfirmationScreen } from '@/components/booking/ConfirmationScreen';

export const metadata: Metadata = {
  title: 'Appointment confirmed',
  description: 'Your consultation is booked. Confirmation and joining link are on their way.',
};

export default async function ConfirmedPage() {
  const settingsRes = await getSettings();
  if (!settingsRes.success) throw new Error('Settings unavailable');

  return (
    <BookingShell step="confirmed">
      <ConfirmationScreen
        reminderLeadHours={settingsRes.data.notifications.reminderLeadHours}
        deliveryNote={settingsRes.data.consultation.deliveryNote}
      />
    </BookingShell>
  );
}
