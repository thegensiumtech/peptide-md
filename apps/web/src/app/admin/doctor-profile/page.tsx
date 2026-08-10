import type { Metadata } from 'next';
import { getDoctorProfile } from '@/lib/api/admin';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { AdminShell } from '@/components/admin/AdminShell';
import { DoctorProfileForm } from '@/components/admin/DoctorProfileForm';

export const metadata: Metadata = {
  title: 'Doctor profile',
  robots: { index: false, follow: false },
};

export default async function DoctorProfilePage() {
  const session = await requireSession('admin', '/admin/doctor-profile');
  requirePermission(session, 'doctor.editProfile');

  const profileRes = await getDoctorProfile();
  if (!profileRes.success) throw new Error('Doctor profile unavailable');

  return (
    <AdminShell
      user={session}
      crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Public profile' }]}
      title="Public profile"
      description="What patients see on the website — the bio, the credentials and the photograph. Changes go live on the public site."
    >
      <DoctorProfileForm profile={profileRes.data} />
    </AdminShell>
  );
}
