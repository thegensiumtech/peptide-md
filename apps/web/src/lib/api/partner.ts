import type {
  ApiResponse,
  BookingStatus,
  Invoice,
  Partner,
  PartnerVolume,
} from '@peptide/shared';
import { fail, ok } from '@peptide/shared';
import { apiFetch } from './server';

/**
 * Partner portal data.
 *
 * There is no partner id in any of these calls, the API reads it from the
 * signed token. A portal screen cannot ask for another partner's data because
 * it has no way to express the question.
 */

interface PartnerMeResponse {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  integration: 'embed' | 'api';
  ratePerAppointment: number;
  currency: string;
  contactName: string;
  contactEmail: string;
  billingEmail: string;
  rateLimitPerMinute: number;
  branding: {
    primaryColor: string;
    accentColor: string;
    fontFamily: string;
    logoUrl: string | null;
    displayName: string;
  };
  credentials: {
    clientId: string;
    secretLastFour: string;
    createdAt: string;
    lastRotatedAt: string | null;
    lastUsedAt: string | null;
  } | null;
  sandboxCredentials: {
    clientId: string;
    secretLastFour: string;
    createdAt: string;
    lastUsedAt: string | null;
  } | null;
  volume: PartnerVolume & { period: string };
}

export interface PartnerBookingRow {
  id: string;
  reference: string;
  /** The API lowercases its enums to match the shared union exactly. */
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  patientName: string;
  patientTimezone: string;
  createdAt: string;
}

export async function getPartnerMe(): Promise<ApiResponse<PartnerMeResponse>> {
  const result = await apiFetch<PartnerMeResponse>('/api/partner/me');
  if (!result.success || !result.data) return fail(result.error ?? 'Partner unavailable');
  return ok(result.data);
}

export async function getPartnerBookings(): Promise<ApiResponse<PartnerBookingRow[]>> {
  const result = await apiFetch<PartnerBookingRow[]>('/api/partner/bookings');
  if (!result.success || !result.data) return fail(result.error ?? 'Bookings unavailable');
  return ok(result.data);
}

export async function getPartnerInvoices(): Promise<ApiResponse<Invoice[]>> {
  const result = await apiFetch<Invoice[]>('/api/partner/invoices');
  if (!result.success || !result.data) return fail(result.error ?? 'Invoices unavailable');
  return ok(result.data);
}

/** Shapes the API record into the Partner type the portal components expect. */
export function toPartner(record: PartnerMeResponse): Partner {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    status: record.status,
    integration: record.integration,
    ratePerAppointment: record.ratePerAppointment,
    currency: record.currency,
    contactName: record.contactName,
    contactEmail: record.contactEmail,
    billingEmail: record.billingEmail,
    branding: record.branding,
    credentials: {
      clientId: record.credentials?.clientId ?? 'Not yet issued',
      secretLastFour: record.credentials?.secretLastFour ?? '----',
      createdAt: record.credentials?.createdAt ?? new Date().toISOString(),
      lastRotatedAt: record.credentials?.lastRotatedAt ?? null,
      lastUsedAt: record.credentials?.lastUsedAt ?? null,
    },
    // Separate from `credentials` deliberately. /me used to return whichever
    // credential was newest, which is the sandbox one, so every partner was
    // shown a sandbox client id as though it were their live credential.
    sandboxCredentials: record.sandboxCredentials
      ? {
          clientId: record.sandboxCredentials.clientId,
          secretLastFour: record.sandboxCredentials.secretLastFour,
          createdAt: record.sandboxCredentials.createdAt,
          lastUsedAt: record.sandboxCredentials.lastUsedAt ?? null,
        }
      : null,
    rateLimitPerMinute: record.rateLimitPerMinute,
    createdAt: record.credentials?.createdAt ?? new Date().toISOString(),
  };
}
