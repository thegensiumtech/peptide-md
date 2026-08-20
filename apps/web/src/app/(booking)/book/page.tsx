import type { Metadata } from 'next';
import Link from 'next/link';
import { getConsultation } from '@/lib/api/public';
import { formatMoney } from '@/lib/format';
import { BookingShell } from '@/components/booking/BookingShell';
import { ButtonLink } from '@/components/ui/Button';
import { RequisitionCard } from '@/components/marketing/Primitives';

export const metadata: Metadata = {
  title: 'Book a consultation',
  description: 'What the consultation covers, how long it runs and what it costs.',
};

export default async function ConsultationDetailsPage() {
  const consultationRes = await getConsultation();
  if (!consultationRes.success) throw new Error('Booking data unavailable');

  const consultation = consultationRes.data;
  const doctor = consultation.doctor;

  return (
    <BookingShell step="details">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <p className="eyebrow">Step one · What you are booking</p>
          <h1 className="mt-5 font-display text-h1 font-medium tracking-[-0.02em] text-ink">
            A {consultation.durationMinutes}-minute consultation with {doctor.name}.
          </h1>
          <p className="mt-6 max-w-xl text-lead leading-relaxed text-ink-soft">
            {consultation.summary}
          </p>

          <section className="mt-10">
            <h2 className="eyebrow">What is included</h2>
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {consultation.inclusions.map((item) => (
                <li key={item} className="flex items-start gap-4 py-4">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                  <span className="text-base text-ink-soft">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="eyebrow">Before you continue</h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-muted">
              <p>
                <span className="text-ink">Payment comes before you pick a time.</span> That is
                deliberate, it means every time you are then shown is genuinely available, and no
                slot is ever held by an unpaid booking.
              </p>
              <p>
                <span className="text-ink">This is not a prescribing service.</span> No compound is
                supplied or prescribed. If that is what you need,{' '}
                <Link href="/medical-disclaimer" className="text-ink underline underline-offset-2">
                  read the disclaimer
                </Link>{' '}
                before paying.
              </p>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <RequisitionCard
            rows={[
              { label: 'Consultation', value: 'Peptide therapy review' },
              { label: 'With', value: doctor.name },
              { label: 'Duration', value: `${consultation.durationMinutes} minutes` },
              { label: 'Held over', value: 'Video' },
              {
                label: 'Total',
                value: formatMoney(consultation.priceAmount, consultation.currency),
                emphasis: true,
              },
            ]}
          />

          <ButtonLink href="/book/payment" size="lg" className="mt-6 w-full">
            Continue to payment
          </ButtonLink>

          <p className="mt-4 text-center text-micro leading-relaxed text-muted">
            You will choose your time on the next screen but one, after payment clears.
          </p>

          <div className="mt-6 border-t border-line pt-5">
            <Link
              href="/"
              className="text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
            >
              ← Back to the site
            </Link>
          </div>
        </aside>
      </div>
    </BookingShell>
  );
}
