/**
 * Roles and permissions.
 *
 * Admin and doctor share one login at /admin/login and are separated by role.
 * Partner staff sign in separately at /partner/login and are additionally
 * scoped to a single partnerId, the scope document requires that no query can
 * ever return another partner's data.
 */

export const USER_ROLES = ['admin', 'doctor', 'partner'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PERMISSIONS = [
  'bookings.viewAll',
  'bookings.viewOwn',
  'bookings.manage',
  'doctor.editProfile',
  'doctor.manageAvailability',
  'settings.manage',
  'partners.manage',
  'invoices.manage',
  'partnerPortal.access',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** What each role may do. The doctor is deliberately narrow. */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: [
    'bookings.viewAll',
    'bookings.manage',
    'doctor.editProfile',
    'doctor.manageAvailability',
    'settings.manage',
    'partners.manage',
    'invoices.manage',
  ],
  // The doctor sees his own diary and controls his own availability. He does
  // not see commercial data, partner rates, invoices or platform settings.
  doctor: ['bookings.viewOwn', 'doctor.manageAvailability', 'doctor.editProfile'],
  partner: ['partnerPortal.access'],
};

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Set only for the partner role, the tenant this user is locked to. */
  partnerId: string | null;
}

export function can(user: Pick<SessionUser, 'role'> | null, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}
