import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth/session';
import { AdminShell } from '@/components/admin/AdminShell';
import { ButtonLink } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'No access',
  robots: { index: false, follow: false },
};

/**
 * Shown when a signed-in user reaches a screen their role does not cover —
 * in practice, the doctor opening a commercial screen. It explains the limit
 * rather than pretending the screen does not exist, and always offers a way on.
 */
export default async function NoAccessPage() {
  const session = await requireSession('admin', '/admin/no-access');

  return (
    <AdminShell
      user={session}
      title="That screen is not part of your access."
      description="Your account covers the clinical side of the platform. Commercial screens — partners, invoices and platform settings — are restricted to administrators."
    >
      <div className="max-w-xl rounded-lg border border-line bg-surface p-8">
        <p className="eyebrow">What you can reach</p>
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {[
            { label: 'Dashboard', body: 'Your upcoming appointments at a glance.' },
            { label: 'Bookings', body: 'Every appointment in your diary, with the patient’s intake answers.' },
            { label: 'Availability', body: 'Your weekly pattern and any one-off changes.' },
            { label: 'Public profile', body: 'The bio and credentials patients see on the website.' },
          ].map((item) => (
            <li key={item.label} className="flex items-start gap-4 py-3.5">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
              <div>
                <p className="text-sm text-ink">{item.label}</p>
                <p className="mt-0.5 text-micro text-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-wrap gap-3">
          <ButtonLink href="/admin" size="md">
            Back to the dashboard
          </ButtonLink>
          <ButtonLink href="/admin/bookings" variant="secondary" size="md">
            Go to bookings
          </ButtonLink>
        </div>

        <p className="mt-6 text-micro leading-relaxed text-muted">
          If you think you should have access to more than this, ask a Peptides MD administrator to
          change your role.
        </p>
      </div>
    </AdminShell>
  );
}
