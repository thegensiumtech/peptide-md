import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signInAdmin } from '@/lib/auth/actions';
import { getSession } from '@/lib/auth/session';
import { demoAccounts } from '@/lib/data/fixtures/users';
import { AuthScreen, DemoAccounts } from '@/components/auth/AuthScreen';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Sign in. Peptide MD team',
  robots: { index: false, follow: false },
};

/**
 * One door for the Peptide MD team. Administrators and the doctor sign in
 * here and are separated by role afterwards, the doctor lands on the same
 * dashboard route but sees his own diary rather than the commercial view.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const session = await getSession();
  if (session) redirect(session.role === 'partner' ? '/partner/bookings' : '/admin');

  const staffAccounts = demoAccounts.filter((a) => a.role !== 'partner');

  return (
    <AuthScreen
      eyebrow="Peptide MD team"
      title="Sign in."
      lede="For Peptide MD administrators and the doctor. Your role decides what you see once you are in."
      crossLink={{ href: '/partner/login', label: 'Are you a partner? Sign in to the partner portal →' }}
      aside={<DemoAccounts accounts={staffAccounts} />}
    >
      <LoginForm action={signInAdmin} next={searchParams.next} submitLabel="Sign in" />
    </AuthScreen>
  );
}
