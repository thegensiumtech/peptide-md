import type { Metadata } from 'next';
import { ManageGate } from '@/components/manage/ManageGate';
import { ManageBookingScreen } from '@/components/manage/ManageBookingScreen';

export const metadata: Metadata = {
  title: 'Your appointment',
  description: 'Review, move or cancel your consultation.',
  robots: { index: false, follow: false },
};

/**
 * Reached from the confirmation email, which carries the reference in the link.
 *
 * The reference alone shows nothing. References are sequential and therefore
 * guessable, so the gate still stands here: the patient confirms the address
 * and enters a code before the appointment is rendered at all.
 */
export default function ManageBookingPage({ params }: { params: { reference: string } }) {
  const reference = decodeURIComponent(params.reference);

  return (
    <section className="shell py-12 sm:py-16">
      <ManageGate reference={reference}>
        <ManageBookingScreen reference={reference} />
      </ManageGate>
    </section>
  );
}
