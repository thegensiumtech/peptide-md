import type { Metadata } from 'next';
import { PageIntro } from '@/components/marketing/PageIntro';
import { ManageGate } from '@/components/manage/ManageGate';
import { ManageDirectory } from '@/components/manage/ManageDirectory';

export const metadata: Metadata = {
  title: 'Your appointments',
  description:
    'Find, move or cancel a consultation using the email address you booked with. No account needed.',
  // A page that shows a named person's appointments has no business in a search
  // index, even though it reveals nothing without the address.
  robots: { index: false, follow: false },
};

export default function ManagePage() {
  return (
    <>
      <PageIntro
        eyebrow="Your appointments"
        title="Move or cancel a consultation."
        lede="Confirm the email address you booked with and we will show everything under it. Rescheduling is free, and cancelling with a day’s notice is refunded in full."
      />
      <section className="shell py-12 sm:py-16">
        <ManageGate>
          <ManageDirectory />
        </ManageGate>
      </section>
    </>
  );
}
