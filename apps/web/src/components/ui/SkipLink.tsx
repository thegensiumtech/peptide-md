/** Keyboard users reach the content without tabbing the whole navigation. */
export function SkipLink({ href = '#main' }: { href?: string }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
    >
      Skip to content
    </a>
  );
}
