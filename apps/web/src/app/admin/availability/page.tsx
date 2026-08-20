import type { Metadata } from 'next';
import { getAvailability, getDoctorProfile } from '@/lib/api/admin';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { AdminShell } from '@/components/admin/AdminShell';
import { AvailabilityEditor } from '@/components/admin/AvailabilityEditor';
import { DoctorDiary } from '@/components/admin/DoctorDiary';

export const metadata: Metadata = {
  title: 'Availability',
  robots: { index: false, follow: false },
};

/**
 * Beyond the 28 scope screens.
 *
 * The scope hands weekly availability to the scheduling core's own interface,
 * but it also gives the doctor the job of managing it. Without this screen the
 * doctor role has no journey, so it is built here, reading and writing the
 * same shape the integration layer exposes.
 */
export default async function AvailabilityPage() {
  const session = await requireSession('admin', '/admin/availability');
  requirePermission(session, 'doctor.manageAvailability');

  const [availabilityRes, doctorRes] = await Promise.all([getAvailability(), getDoctorProfile()]);
  if (!availabilityRes.success || !doctorRes.success) throw new Error('Availability unavailable');

  return (
    <AdminShell
      user={session}
      crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Availability' }]}
      title="Availability"
      description={`The weekly pattern ${doctorRes.data.name.split(' ').slice(-1)[0]} works, plus one-off changes. A change here applies everywhere at once, this website and every partner site.`}
    >
      {/* The diary comes first: it is what the doctor opens this screen for.
          The standing pattern below is set once and rarely revisited. */}
      <DoctorDiary doctorId={doctorRes.data.id} timezone={availabilityRes.data.timezone} />

      <div className="mt-10">
        <h2 className="font-display text-h3 font-medium text-ink">Your standing pattern</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          The hours you normally work. Set this once, use the diary above for anything that
          changes week to week.
        </p>
        <div className="mt-4">
          <AvailabilityEditor availability={availabilityRes.data} />
        </div>
      </div>
    </AdminShell>
  );
}
