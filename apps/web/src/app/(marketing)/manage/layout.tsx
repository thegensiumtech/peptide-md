import { ManageSessionProvider } from '@/components/manage/ManageSession';

/**
 * The address the patient identified themselves with is held for the length of
 * the tab, so moving from the list to one appointment does not ask for it
 * twice. It is not a session and grants nothing, the server re-checks the
 * address against the booking on every single request.
 */
export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return <ManageSessionProvider>{children}</ManageSessionProvider>;
}
