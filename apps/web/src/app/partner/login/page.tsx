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
      lede="For companies offering Peptide MD consultations inside their own site. You will see your own appointments, totals and invoices, and nobody else’s."
      crossLink={{ href: '/admin/login', label: 'Peptide MD team? Sign in to the admin panel →' }}
      aside={showDemoAccounts ? <DemoAccounts accounts={partnerAccounts} /> : null}
    >
      <LoginForm action={signInPartner} next={searchParams.next} submitLabel="Sign in" />
    </AuthScreen>
  );
}
