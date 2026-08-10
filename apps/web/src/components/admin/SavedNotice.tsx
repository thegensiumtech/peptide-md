'use client';

import { useEffect } from 'react';

/** Confirmation after a save. Announced to screen readers, then clears itself. */
export function SavedNotice({
  show,
  message,
  onDismiss,
}: {
  show: boolean;
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!show) return;
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <p
      role="status"
      className="mb-4 rounded border border-signal/25 bg-signal-tint px-4 py-3 text-micro leading-relaxed text-ink"
    >
      {message}
    </p>
  );
}
