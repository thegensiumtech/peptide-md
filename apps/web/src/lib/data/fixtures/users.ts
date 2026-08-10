import type { SessionUser } from '@peptide/shared';

/**
 * Demo accounts.
 *
 * Admin and doctor share the /admin/login screen and are separated by role
 * once signed in. Partner staff sign in at /partner/login and are pinned to
 * one partnerId, which is what scopes every query they can make.
 *
 * Passwords are not checked in this static build — any password is accepted
 * for a known email. Real authentication is JWT with bcrypt in the API.
 */
export interface DemoAccount extends SessionUser {
  /** Shown on the login screen so the build can be walked through. */
  hint: string;
}

export const demoAccounts: DemoAccount[] = [
  {
    id: 'usr_admin',
    name: 'Ross Calder',
    email: 'ross@peptidemd.com',
    role: 'admin',
    partnerId: null,
    hint: 'Full access — bookings, doctor, partners, rates and invoices',
  },
  {
    id: 'usr_doctor',
    name: 'Dr James Hartley',
    email: 'james@peptidemd.com',
    role: 'doctor',
    partnerId: null,
    hint: 'His own diary and his own availability only',
  },
  {
    id: 'usr_newyou',
    name: 'Dana Whitfield',
    email: 'dana@newyoupeptides.com.au',
    role: 'partner',
    partnerId: 'ptr_newyou',
    hint: 'New You Peptides — their own bookings, totals and invoices',
  },
  {
    id: 'usr_fivepep',
    name: 'Marcus Iles',
    email: 'marcus@fivepeptides.co.uk',
    role: 'partner',
    partnerId: 'ptr_fivepeptides',
    hint: 'Five Peptides — their own bookings, totals and invoices',
  },
];

export function findAccountByEmail(email: string): DemoAccount | null {
  const normalised = email.trim().toLowerCase();
  return demoAccounts.find((a) => a.email.toLowerCase() === normalised) ?? null;
}
