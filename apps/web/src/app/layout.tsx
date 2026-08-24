import type { Metadata, Viewport } from 'next';
import { Newsreader, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

/**
 * Three roles, three faces. Newsreader is a low-contrast journal serif, it
 * carries the public site with the authority of medical literature rather than
 * the fashion-magazine look of a high-contrast display serif. Plex Mono is not
 * decoration: it sets everything that is read as data, slot times, booking
 * references, rates, API credentials, invoice totals.
 */
const display = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  // Next has no metrics for Newsreader, so it cannot synthesise a
  // size-adjusted fallback. Name the fallback stack explicitly instead of
  // letting it drop to an unmatched default.
  adjustFontFallback: false,
  fallback: ['Iowan Old Style', 'Palatino', 'Georgia', 'serif'],
});

const body = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://peptidemd.co.uk'),
  title: {
    default: 'Peptide MD. Consult a doctor who knows peptides',
    template: '%s · Peptide MD',
  },
  description:
    'Book a private video consultation with a UK-registered doctor experienced in peptide therapy. Twenty minutes, honest guidance, no product to sell you.',
  openGraph: {
    type: 'website',
    siteName: 'Peptide MD',
  },
  /**
   * Indexing is opt-in, not the default.
   *
   * The site goes onto the live domain before the content behind it is final:
   * the doctor's name and GMC number are placeholders until Ross supplies the
   * real ones, and the three legal pages carry a visible draft banner. Google
   * caching a fabricated registration number is far harder to undo than
   * waiting, so a build only asks to be indexed when someone has said so.
   *
   * Set NEXT_PUBLIC_ALLOW_INDEXING=true once the content is real.
   */
  robots:
    process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true'
      ? { index: true, follow: true }
      : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#F5F8FA',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
