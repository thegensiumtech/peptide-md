import { BookingProvider } from '@/components/booking/BookingContext';
import { SkipLink } from '@/components/ui/SkipLink';

/**
 * Every booking screen depends on request-time state — the Stripe session on
 * the URL, the live diary, the patient's own booking — so none of them can be
 * prerendered. Declaring it here rather than page by page keeps the whole flow
 * consistent and stops a future screen being statically cached by accident.
 */
export const dynamic = 'force-dynamic';

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <BookingProvider>
      <SkipLink />
      {children}
    </BookingProvider>
  );
}
