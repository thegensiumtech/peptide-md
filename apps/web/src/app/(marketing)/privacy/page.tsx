import type { Metadata } from 'next';
import { LegalDocument, type LegalSection } from '@/components/marketing/LegalDocument';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'What Peptide MD collects, why, how long it is kept, who it is shared with, and the rights you have over it under UK GDPR.',
};

const sections: LegalSection[] = [
  {
    heading: 'Who we are',
    paragraphs: [
      'Peptide MD provides private medical consultations about peptide therapy. For the purposes of UK data protection law, Peptide MD is the data controller for the information described in this policy.',
      'If you booked through a partner company’s website, that company is a separate controller for the booking and payment information it holds about you. This policy covers only what Peptide MD holds.',
    ],
  },
  {
    heading: 'What we collect',
    paragraphs: ['We collect the minimum needed to run your appointment and the doctor’s record of it.'],
    list: [
      'Identity and contact details, your name, email address and phone number.',
      'Appointment details, the time booked, the channel it came through, and its status.',
      'Health information you give us, your answers to the intake questions and anything discussed in the consultation.',
      'Payment confirmation, whether payment succeeded, and the reference. We never see or store your card details; Stripe handles those.',
      'Technical data, basic analytics about how the website is used.',
    ],
  },
  {
    heading: 'Why we can hold it',
    paragraphs: [
      'For your appointment and the clinical record, our lawful bases are the contract between us and, for health information, the provision of healthcare under Article 9(2)(h) UK GDPR.',
      'For analytics we rely on your consent, which you can withdraw at any time.',
    ],
  },
  {
    heading: 'Who we share it with',
    paragraphs: [
      'We share your information only with the organisations needed to deliver the service: our scheduling provider, our payment provider, our email provider, and our hosting and infrastructure providers. Each is bound by contract and processes data only on our instructions.',
      'We do not sell your data, and we do not share your health information with partner companies. A partner sees that an appointment took place and its status, never what was discussed or what you wrote on the intake form.',
    ],
  },
  {
    heading: 'How long we keep it',
    paragraphs: [
      'Clinical records are retained in line with UK medical record-keeping guidance. Booking and payment records are kept for as long as required for accounting and tax purposes. Analytics data is retained for a shorter period.',
      'When a retention period ends, information is deleted or irreversibly anonymised.',
    ],
  },
  {
    heading: 'Where it is held',
    paragraphs: [
      'Data is stored on servers within the UK or European Economic Area. Where a provider processes data outside that area, the transfer is covered by an adequacy decision or by standard contractual clauses.',
    ],
  },
  {
    heading: 'Your rights',
    paragraphs: ['Under UK GDPR you have the right to:'],
    list: [
      'Ask for a copy of the information we hold about you.',
      'Ask us to correct anything that is wrong.',
      'Ask us to delete information, where we are not required to keep it.',
      'Object to or restrict certain processing.',
      'Withdraw consent where consent is what we rely on.',
      'Complain to the Information Commissioner’s Office.',
    ],
  },
  {
    heading: 'Security',
    paragraphs: [
      'Data is encrypted in transit and at rest. Access is restricted to the people who need it to do their job, and access to clinical information is limited to the doctor and to authorised Peptide MD staff.',
    ],
  },
  {
    heading: 'Contacting us',
    paragraphs: [
      'For any question about this policy, or to exercise any of the rights above, email hello@peptidemd.co.uk. We respond within one month.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Privacy policy"
      lede="What we collect, why we hold it, who sees it, and what you can ask us to do with it."
      lastUpdated="31 July 2026"
      sections={sections}
    />
  );
}
