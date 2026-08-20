import type { Metadata } from 'next';
import { GuideForm } from '@/components/guide/GuideForm';
import { SectionHeading, CtaBand } from '@/components/marketing/Primitives';

export const metadata: Metadata = {
  title: 'The peptide guide',
  description:
    'A free guide to peptide therapy written by a doctor with no products to sell, what the evidence says, what you are actually buying, and the questions to ask before you start.',
};

const CONTENTS: [string, string][] = [
  ['Why this guide exists', 'Who writes peptide advice, and why that shapes what it says.'],
  ['What a peptide actually is', 'Why “do peptides work” is the wrong question.'],
  ['The three tiers of evidence', 'Licensed, researched, or anecdote, and how to tell.'],
  ['What you are actually buying', 'Why a vial bought online is not a medicine, and how to read a COA.'],
  ['How they are taken', 'Injection, nasal, topical, oral, and why the route changes the dose.'],
  ['Where the real risks are', 'Interactions, masking, technique. Rarely what people expect.'],
  ['30 compounds, assessed', 'Metabolic · repair · growth hormone · cognitive · sleep · immune.'],
  ['Questions before you start', 'If you cannot answer these, you are not ready.'],
  ['The boring answer that usually wins', 'What a doctor checks first.'],
];

export default function GuidePage() {
  return (
    <>
      <section className="shell pt-14 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="eyebrow">Free guide · 18 pages</p>
            <h1 className="mt-5 font-display text-h1 font-medium tracking-[-0.02em] text-ink">
              What a doctor would actually tell you about peptides.
            </h1>
            <p className="mt-6 max-w-xl text-lead leading-relaxed text-ink-soft">
              Almost everything written about peptides is written by someone selling them. This is
              not. It is written by a GMC-registered doctor with no products, no suppliers and no
              affiliate income, including the parts that say you probably should not take anything.
            </p>

            <ol className="mt-10 grid gap-0 border-t border-line">
              {CONTENTS.map(([title, blurb], index) => (
                <li key={title} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[3rem_1fr]">
                  <span className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-ink">{title}</span>
                    <span className="mt-0.5 block text-micro leading-relaxed text-muted">{blurb}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">
              <h2 className="font-display text-h3 font-medium text-ink">Send it to me</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Eighteen pages, thirty compounds. Free, and yours to keep.
              </p>
              <div className="mt-6">
                <GuideForm source="guide-page" />
              </div>
            </div>
            <p className="mt-4 text-micro leading-relaxed text-muted">
              General information, not medical advice. Peptides MD does not supply, prescribe or
              dispense any compound.
            </p>
          </aside>
        </div>
      </section>

      <div className="mt-section">
        <CtaBand
          title="Or skip the reading and ask the doctor directly."
          body="Twenty minutes, £95, and a straight answer about your own situation, including when the answer is that you should not be taking anything."
        />
      </div>
    </>
  );
}
