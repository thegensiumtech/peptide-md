import type { Metadata } from 'next';
import { getSettings } from '@/lib/api/admin';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { AdminShell } from '@/components/admin/AdminShell';
import { SettingsForm } from '@/components/admin/SettingsForm';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const session = await requireSession('admin', '/admin/settings');
  // The doctor lands on /admin/no-access here rather than a blank screen.
  requirePermission(session, 'settings.manage');

  const settingsRes = await getSettings();
  if (!settingsRes.success) throw new Error('Settings unavailable');

  return (
    <AdminShell
      user={session}
      crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Settings' }]}
      title="Settings"
      description="The consultation price patients pay, the default rate charged to partners, and how notifications are sent."
    >
      <SettingsForm settings={settingsRes.data} />
    </AdminShell>
  );
}
