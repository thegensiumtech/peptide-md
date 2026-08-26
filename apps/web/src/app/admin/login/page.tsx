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
/**
 * Demo accounts are development only.
 *
 * This panel listed real administrator email addresses on the live site, under
 * the heading "Any password is accepted", which stopped being true the moment
 * the API took over authentication. Handing an attacker a list of valid
 * usernames is a gift on its own; pairing it with an invitation to guess is
 * worse. It renders only when the build is not production.
 */
const showDemoAccounts = process.env.NODE_ENV !== 'production';

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
      aside={showDemoAccounts ? <DemoAccounts accounts={staffAccounts} /> : null}
    >
      <LoginForm action={signInAdmin} next={searchParams.next} submitLabel="Sign in" />
    </AuthScreen>
  );
}
