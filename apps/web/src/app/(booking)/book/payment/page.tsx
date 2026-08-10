import type { Metadata } from 'next';
import { getConsultation } from '@/lib/api/public';
import { BookingShell } from '@/components/booking/BookingShell';
import { PaymentScreen } from '@/components/booking/PaymentScreen';

export const metadata: Metadata = {
  title: 'Payment',
  description: 'Pay for your consultation. Your time is chosen once payment is confirmed.',
};

export default async function PaymentPage() {
  const consultationRes = await getConsultation();
  if (!consultationRes.success) throw new Error('Consultation details unavailable');
  const consultation = consultationRes.data;

  return (
    <BookingShell step="payment">
      <PaymentScreen
        amount={consultation.priceAmount}
        currency={consultation.currency}
        durationMinutes={consultation.durationMinutes}
      />
    </BookingShell>
  );
}
