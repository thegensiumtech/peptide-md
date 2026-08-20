import type { Metadata } from 'next';
import { LegalDocument, type LegalSection } from '@/components/marketing/LegalDocument';

export const metadata: Metadata = {
  title: 'Medical disclaimer',
  description:
    'The limits of the consultation, what it is not, the regulatory position on peptides in the UK, and what to do in an emergency.',
};

const sections: LegalSection[] = [
  {
    heading: 'This is not emergency care',
    paragraphs: [
      'Peptide MD does not provide urgent or emergency medical care. If you are seriously unwell, having a reaction to something you have taken, or worried about immediate symptoms, contact NHS 111, your GP, or the emergency services on 999.',
      'Do not wait for a booked consultation if your symptoms are urgent.',
    ],
  },
  {
    heading: 'What the consultation is',
    paragraphs: [
      'A private clinical opinion from a GMC-registered doctor, based on what you tell him during the consultation and on the intake information you provide beforehand.',
      'It is a single, standalone opinion. It is not ongoing care, it is not a diagnosis made with the benefit of examination or investigation, and it does not replace the doctors already responsible for your care.',
    ],
  },
  {
    heading: 'What it is not',
    paragraphs: ['To remove any doubt:'],
    list: [
      'It is not a prescription service. No compound is prescribed, supplied or dispensed by Peptide MD.',
      'It is not an endorsement of any product, supplier or protocol.',
      'It is not a substitute for your GP, specialist, or any treatment you are already receiving.',
      'It is not a physical examination, and no investigations are carried out.',
    ],
  },
  {
    heading: 'The regulatory position',
    paragraphs: [
      'Most peptide compounds sold online are not licensed medicines in the United Kingdom. Many are marketed as research chemicals and are not authorised for human use.',
      'Peptide MD takes no position on the legality of anything you have obtained elsewhere, and cannot verify the identity, purity or safety of any compound you have bought from a third party.',
    ],
  },
  {
    heading: 'Educational content on this site',
    paragraphs: [
      'The About Peptides page and any other general information on this website is educational. It is not tailored to you, it is not medical advice, and it should not be acted on as though it were.',
      'Only the consultation itself constitutes advice, and only for the person who attended it.',
    ],
  },
  {
    heading: 'Your responsibility',
    paragraphs: [
      'Decisions about what you take remain yours. The doctor will give you his honest opinion and his reasoning, including where he advises against something.',
      'If the advice is that you should stop a compound, seek investigation, or speak to your GP, following it is your decision and your responsibility.',
    ],
  },
  {
    heading: 'Accuracy of what you tell us',
    paragraphs: [
      'The opinion you receive depends entirely on the accuracy of the information you give. Omitting a medication, an existing condition or a compound you are taking can materially change what is safe for you.',
    ],
  },
];

export default function MedicalDisclaimerPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Medical disclaimer"
      lede="The limits of what this service is, stated plainly, so there is no room for misunderstanding."
      lastUpdated="31 July 2026"
      sections={sections}
    />
  );
}
