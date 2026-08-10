import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signInPartner } from '@/lib/auth/actions';
import { getSession } from '@/lib/auth/session';
import { demoAccounts } from '@/lib/data/fixtures/users';
import { AuthScreen, DemoAccounts } from '@/components/auth/AuthScreen';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Partner portal sign in',
  robots: { index: false, follow: false },
};

export default async function PartnerLoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const session = await getSession();
  if (session) redirect(session.role === 'partner' ? '/partner/bookings' : '/admin');

  const partnerAccounts = demoAccounts.filter((a) => a.role === 'partner');

  return (
    <AuthScreen
      eyebrow="Partner portal"
      title="Sign in."
      lede="For companies offering Peptide MD consultations inside their own site. You will see your own appointments, totals and invoices — and nobody else’s."
      crossLink={{ href: '/admin/login', label: 'Peptide MD team? Sign in to the admin panel →' }}
      aside={<DemoAccounts accounts={partnerAccounts} />}
    >
      <LoginForm action={signInPartner} next={searchParams.next} submitLabel="Sign in" />
    </AuthScreen>
  );
}
