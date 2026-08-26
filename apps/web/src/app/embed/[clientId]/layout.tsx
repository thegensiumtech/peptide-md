import type { Metadata } from 'next';
import '../../globals.css';

/**
 * The widget's own root layout.
 *
 * Deliberately not the marketing layout. That one carries the Peptide MD
 * wordmark, the site header and footer, and a metadataBase pointing at our own
 * domain. Inside a partner's page none of that belongs: the scope is explicit
 * that "nothing about the experience tells the patient that another company is
 * involved".
 *
 * Being a separate root layout also means the partner's colours can be applied
 * to the document without leaking into any other route.
 */
export const metadata: Metadata = {
  title: 'Book a consultation',
  // Never indexed. This page exists to be framed, and a search result landing
  // someone on a bare widget with no context is worse than no result.
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      {/* Transparent, so the host page's own background shows through and the
          widget does not sit in a visible rectangle of the wrong colour. */}
      <body className="bg-transparent antialiased">{children}</body>
    </html>
  );
}
