import type { Metadata } from 'next';
import { getConsultation } from '@/lib/api/public';
import { formatMoney } from '@/lib/format';
import { CtaBand, PortraitFrame, RequisitionCard } from '@/components/marketing/Primitives';
import { PageIntro } from '@/components/marketing/PageIntro';

export const metadata: Metadata = {
  title: 'Meet the doctor',
  description:
    'The GMC-registered doctor behind Peptide MD, what he does in a consultation, and why he has nothing to sell you.',
};

export default async function DoctorPage() {
  const consultationRes = await getConsultation();
  if (!consultationRes.success) throw new Error('Doctor data unavailable');

  const consultation = consultationRes.data;
  const doctor = consultation.doctor;
  const paragraphs = doctor.bio.split('\n\n');

  return (
    <>
      <PageIntro eyebrow="The doctor" title={doctor.headline} />

      <section className="shell mt-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-20">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <PortraitFrame
              name={doctor.name}
              credentials={doctor.credentials}
              gmcNumber={doctor.gmcNumber}
            photoUrl={doctor.photoUrl}
            />
            <RequisitionCard
              className="mt-6"
              rows={[
                ...(doctor.gmcNumber
                  ? [{ label: 'Registration', value: `GMC ${doctor.gmcNumber}` }]
                  : []),
                { label: 'Qualifications', value: doctor.credentials },
                { label: 'Languages', value: doctor.languages.join(', ') },
                { label: 'Consultation', value: `${consultation.durationMinutes} min · video` },
                {
                  label: 'Fee',
                  value: formatMoney(consultation.priceAmount, consultation.currency),
                  emphasis: true,
                },
              ]}
            />
          </div>

          <div className="max-w-prose">
            <div className="space-y-6 text-lead leading-relaxed text-ink-soft">
              {paragraphs.map((paragraph, index) => (
                <p
                  key={paragraph.slice(0, 32)}
                  className={index === 0 ? 'text-h3 leading-snug text-ink' : undefined}
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-12 border-t border-line pt-8">
              <p className="eyebrow">What he sees most</p>
              <ul className="mt-5 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
                {doctor.specialisms.map((specialism) => (
                  <li key={specialism} className="bg-surface px-5 py-4 text-sm text-ink-soft">
                    {specialism}
                  </li>
                ))}
              </ul>
            </div>

            <blockquote className="mt-12 border-l-2 border-accent pl-6">
              <p className="font-display text-h3 leading-snug text-ink">
                “Half of what I do is telling people that the thing they have been sold will not
                fix the thing they actually have.”
              </p>
              <footer className="mt-4 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                {doctor.name}
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      <div className="mt-section">
        <CtaBand
          title={`Twenty minutes with ${doctor.name}.`}
          body="Bring what you are taking, what you are trying to fix, and your questions. You will get a straight answer."
        />
      </div>
    </>
  );
}
