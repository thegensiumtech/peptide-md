import type { Metadata } from 'next';
import Link from 'next/link';
import { CtaBand, SectionHeading } from '@/components/marketing/Primitives';
import { PageIntro } from '@/components/marketing/PageIntro';

export const metadata: Metadata = {
  title: 'About peptides',
  description:
    'What peptides are, what the evidence currently supports, where the real risks sit, and the questions worth asking before you start anything.',
};

/**
 * Educational content. Deliberately plain and non-promotional. Peptide MD
 * sells a consultation, not a compound, and this page has to read that way.
 */
export default function AboutPeptidesPage() {
  return (
    <>
      <PageIntro
        eyebrow="Education"
        title="What peptides actually are, without the sales pitch."
        lede="This page is not here to persuade you to take anything. It is here so that the conversation with the doctor starts from the same place."
      />

      <section className="shell mt-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-20">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="On this page">
              <p className="eyebrow">On this page</p>
              <ul className="mt-4 grid gap-2.5 border-l border-line pl-4">
                {SECTIONS.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="text-sm text-muted transition-colors hover:text-ink"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="max-w-prose">
            {SECTIONS.map((section) => (
              <article key={section.id} id={section.id} className="scroll-mt-24 pb-12">
                <h2 className="font-display text-h2 font-medium tracking-tight text-ink">
                  {section.title}
                </h2>
                <div className="mt-5 space-y-5 text-lead leading-relaxed text-ink-soft">
                  {section.body.map((paragraph) => (
                    <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                  ))}
                </div>
                {section.callout ? (
                  <p className="mt-6 rounded border border-accent/25 bg-accent-tint px-5 py-4 text-sm leading-relaxed text-ink">
                    {section.callout}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-section bg-paper-deep py-section">
        <div className="shell">
          <SectionHeading
            eyebrow="Before you start"
            title="Five questions worth having an answer to."
            lede="If you cannot answer these, that is not a failure, it is the reason the consultation exists."
          />
          <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {QUESTIONS.map((question) => (
              <li key={question} className="bg-surface p-6">
                <p className="text-base leading-relaxed text-ink-soft">{question}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="shell mt-section">
        <div className="rounded-lg border border-danger/20 bg-danger-tint px-6 py-8 sm:px-10">
          <p className="eyebrow text-danger">Important</p>
          <p className="mt-4 max-w-3xl text-lead leading-relaxed text-ink">
            Nothing on this page is medical advice, and none of it is specific to you. Peptide MD
            does not supply, prescribe or dispense any compound.
          </p>
          <Link
            href="/medical-disclaimer"
            className="mt-5 inline-block text-sm text-ink underline decoration-danger/40 underline-offset-4"
          >
            Read the full medical disclaimer
          </Link>
        </div>
      </section>

      <div className="mt-section">
        <CtaBand
          title="Bring your questions to someone qualified to answer them."
          body="Twenty minutes with a doctor who works in this area every week, and who has no interest in what you decide to buy."
        />
      </div>
    </>
  );
}

const SECTIONS = [
  {
    id: 'what-they-are',
    title: 'What they are',
    body: [
      'A peptide is a short chain of amino acids, the same building blocks proteins are made of, just fewer of them joined together. Your body already makes and uses thousands of them; insulin is one.',
      'The compounds people mean when they say "peptides" are synthetic versions designed to act on a particular system: tissue repair, appetite, growth hormone release, pigmentation. They are not a single class of drug with a single effect, which is why blanket claims about "peptides" are close to meaningless.',
    ],
  },
  {
    id: 'evidence',
    title: 'Where the evidence actually is',
    body: [
      'The evidence base is extremely uneven. A small number of peptide medicines are licensed, thoroughly trialled and prescribed routinely, the GLP-1 agonists used for diabetes and weight management are the obvious example.',
      'Most of what is sold online sits in a different category: promising early research, often in animals, often at doses and purities that bear little relationship to what arrives in a vial. That is not the same as "it does not work". It is "nobody has established what it does in people like you".',
    ],
    callout:
      'A useful test: ask what the evidence is in humans, at this dose, for this outcome. If the answer is a rodent study or a forum thread, treat the claim accordingly.',
  },
  {
    id: 'risks',
    title: 'Where the real risks sit',
    body: [
      'The risk people worry about is the compound itself. The risks that actually cause problems in practice are usually more mundane: unverified sourcing and purity, incorrect reconstitution and dosing, interactions with medication already being taken, and an underlying condition nobody has looked for.',
      'There is also the diagnostic risk. Symptoms get attributed to the peptide, or masked by it, while something else goes unexamined. That is the failure mode a doctor is there to catch.',
    ],
  },
  {
    id: 'regulation',
    title: 'What the law says in the UK',
    body: [
      'Most of these compounds are not licensed medicines in the UK. Many are sold as "research chemicals not for human consumption", wording that exists to move legal responsibility onto the buyer, not because the seller believes it.',
      'That status is why a consultation is a consultation and nothing more. The doctor can review what you are doing, assess your history and give you a clinical opinion. He cannot supply anything, and he will not pretend otherwise.',
    ],
  },
];

const QUESTIONS = [
  'What specifically are you trying to change, and how would you know if it worked?',
  'What exactly are you taking, the compound, the dose, the source and the purity?',
  'What else are you taking, including prescribed medication and supplements?',
  'Has anything in your history been investigated that could explain the symptom?',
  'What is your stopping point, and what would make you stop sooner?',
  'If this does not work in twelve weeks, what is the plan then?',
];
