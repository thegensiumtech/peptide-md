import type { Metadata } from 'next';
import { LegalDocument, type LegalSection } from '@/components/marketing/LegalDocument';

export const metadata: Metadata = {
  title: 'Terms of service',
  description:
    'The terms on which Peptides MD provides consultations, booking, payment, cancellation, refunds, and the limits of the service.',
};

const sections: LegalSection[] = [
  {
    heading: 'These terms',
    paragraphs: [
      'These terms apply when you book a consultation with Peptides MD. By booking, you accept them.',
      'If you booked through a partner company’s website, that company’s terms also apply to the payment you made to them. These terms govern the consultation itself.',
    ],
  },
  {
    heading: 'What we provide',
    paragraphs: [
      'A private consultation with a GMC-registered doctor, held over video, of the duration shown at the time of booking.',
      'The consultation is an independent clinical opinion. It does not create an ongoing doctor–patient relationship, and it does not replace your GP or any specialist already involved in your care.',
    ],
  },
  {
    heading: 'What we do not provide',
    paragraphs: ['To be explicit about the limits of the service:'],
    list: [
      'We do not supply, sell, prescribe or dispense any peptide or other compound.',
      'We do not provide emergency or urgent care.',
      'We do not provide ongoing monitoring, repeat consultations by default, or a prescribing service.',
      'We do not certify, endorse or verify any product or supplier.',
    ],
  },
  {
    heading: 'Booking and payment',
    paragraphs: [
      'Payment is taken at the time of booking and before a time is selected. Your appointment is confirmed only once payment has been confirmed by our payment provider.',
      'If payment fails, no appointment is created and no time is reserved.',
      'Prices are shown inclusive of any applicable tax at the point of booking.',
    ],
  },
  {
    heading: 'Changing or cancelling',
    paragraphs: [
      'You may reschedule free of charge by replying to your confirmation email.',
      'A cancellation made more than 24 hours before the appointment is refunded in full. A cancellation made within 24 hours, or a missed appointment, is not refunded.',
      'If the doctor has to cancel, you will be offered an alternative time or a full refund, whichever you prefer.',
    ],
  },
  {
    heading: 'Your responsibilities',
    paragraphs: [
      'The consultation is only as good as the information it is based on. You agree to give accurate and complete answers about what you are taking, your medical history and any medication.',
      'You agree to be somewhere private with a working connection at the appointed time, and to be the person who booked the appointment.',
    ],
  },
  {
    heading: 'Liability',
    paragraphs: [
      'Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot lawfully be limited.',
      'Subject to that, our liability arising from a consultation is limited to the fee paid for it. We are not liable for any decision you take about a compound obtained from a third party.',
    ],
  },
  {
    heading: 'Complaints',
    paragraphs: [
      'If you are unhappy with any part of the service, email hello@peptidemd.com. We acknowledge complaints within two working days and aim to resolve them within twenty.',
    ],
  },
  {
    heading: 'Governing law',
    paragraphs: [
      'These terms are governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction.',
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Terms of service"
      lede="What you are buying, what you are not, and what happens if something needs to change."
      lastUpdated="31 July 2026"
      sections={sections}
    />
  );
}
