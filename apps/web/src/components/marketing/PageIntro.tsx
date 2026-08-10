/** Consistent opening block for every page below the homepage. */
export function PageIntro({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <section className="shell border-b border-line pb-12 pt-16 sm:pt-20">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-5 max-w-3xl font-display text-h1 font-medium tracking-[-0.02em] text-ink">
        {title}
      </h1>
      {lede ? <p className="mt-6 max-w-2xl text-lead text-muted">{lede}</p> : null}
    </section>
  );
}
