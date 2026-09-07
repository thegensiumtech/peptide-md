'use client';

/**
 * Download and print for the reference.
 *
 * This uses the browser's own print pipeline rather than rendering a PDF on
 * the server. That is a deliberate trade: the reader gets the current
 * documentation at the moment they press it, on any device, with no round trip,
 * and there is no second rendering path to keep in step with the first. The
 * print stylesheet in globals.css does the work of making the output read as a
 * document rather than a screenshot of a web page.
 */
export function DocsToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="min-h-11 rounded border border-line px-4 text-sm text-ink transition-colors hover:border-ink"
      >
        Download as PDF
      </button>
    </div>
  );
}
