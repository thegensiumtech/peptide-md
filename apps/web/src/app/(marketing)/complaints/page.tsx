import type { Metadata } from 'next';
import {
  LEGAL_PAGES_LIVE_DATE,
  LegalDocument,
  type LegalSection,
} from '@/components/marketing/LegalDocument';

export const metadata: Metadata = {
  title: 'Complaints',
  description: 'How to raise a complaint about the Peptide MD service, and what happens next.',
};

/**
 * Placeholder content.
 *
 * Dr Jinks asked for a Complaints link in the footer and offered to supply the
 * page's content. Until he does, this carries only what the terms already say
 * about complaints, word for word, under the same draft banner as the other
 * legal pages. The independent escalation route the terms are missing is with
 * the lawyer, so nothing is invented for it here.
 */
const sections: LegalSection[] = [
  {
    heading: 'How to complain',
    paragraphs: [
      'If you are unhappy with any part of the service, email hello@peptidemd.co.uk. We acknowledge complaints within two working days and aim to resolve them within twenty.',
    ],
  },
];

export default function ComplaintsPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Complaints"
      lede="If something about the service was not right, this is how to tell us."
      lastUpdated={LEGAL_PAGES_LIVE_DATE}
      sections={sections}
    />
  );
}
