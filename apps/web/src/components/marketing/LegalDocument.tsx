import Link from 'next/link';
import { PageIntro } from './PageIntro';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

/**
 * Shared frame for the three legal pages.
 *
 * The scope puts final wording with Ross's legal advisor, so the copy here is
 * a working draft. The banner is deliberately visible rather than a code
 * comment — it should be impossible to ship these unreviewed by accident.
 */
export function LegalDocument({
  eyebrow,
  title,
  lede,
  lastUpdated,
  sections,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  lastUpdated: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <PageIntro eyebrow={eyebrow} title={title} lede={lede} />

      <section className="shell mt-12">
        <p className="rounded border border-accent/30 bg-accent-tint px-5 py-4 text-micro leading-relaxed text-ink">
          <span className="font-semibold">Draft — awaiting legal review.</span> This wording is a
          working draft prepared to complete the page. It must be reviewed and approved by Peptide
          MD’s legal advisor before launch.
        </p>
      </section>

      <section className="shell mt-12">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] lg:gap-20">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="eyebrow">Last updated</p>
            <p className="mt-2 font-mono text-sm text-ink">{lastUpdated}</p>

            <nav aria-label="Sections" className="mt-8">
              <p className="eyebrow">Contents</p>
              <ol className="mt-4 grid gap-2.5 border-l border-line pl-4">
                {sections.map((section, index) => (
                  <li key={section.heading}>
                    <a
                      href={`#s${index + 1}`}
                      className="text-sm text-muted transition-colors hover:text-ink"
                    >
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          <div className="max-w-prose">
            {sections.map((section, index) => (
              <article key={section.heading} id={`s${index + 1}`} className="scroll-mt-24 pb-10">
                <h2 className="font-display text-h3 font-semibold text-ink">
                  <span className="mr-3 font-mono text-eyebrow font-normal tracking-[0.14em] text-muted">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {section.heading}
                </h2>
                <div className="mt-4 space-y-4 text-base leading-relaxed text-ink-soft">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                  ))}
                </div>
                {section.list ? (
                  <ul className="mt-4 space-y-2.5 border-l border-line pl-5">
                    {section.list.map((item) => (
                      <li key={item} className="text-base leading-relaxed text-ink-soft">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}

            <div className="border-t border-line pt-8">
              <p className="text-sm text-muted">
                Questions about this document?{' '}
                <Link href="/contact" className="text-ink underline underline-offset-4">
                  Contact us
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
