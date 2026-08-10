import { redirect } from 'next/navigation';

/** The portal's home is the bookings view, which carries the running total. */
export default function PartnerIndexPage() {
  redirect('/partner/bookings');
}
