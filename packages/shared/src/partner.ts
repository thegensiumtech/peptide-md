/**
 * White-label partner domain — accounts, per-appointment rates, branding for
 * the embedded widget, API credentials, and monthly invoices.
 */

export const PARTNER_STATUSES = ['active', 'suspended'] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const PARTNER_INTEGRATIONS = ['embed', 'api'] as const;
/** 'embed' is the drop-in widget; 'api' is a partner building their own front end. */
export type PartnerIntegration = (typeof PARTNER_INTEGRATIONS)[number];

/** Colours and type the embedded widget renders in, so it reads as the partner. */
export interface PartnerBranding {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoUrl: string | null;
  /** Name shown to the partner's patients — never 'Peptide MD'. */
  displayName: string;
}

export interface PartnerCredentials {
  clientId: string;
  /** Masked everywhere except the moment of issue or rotation. */
  secretLastFour: string;
  createdAt: string;
  lastRotatedAt: string | null;
  lastUsedAt: string | null;
}

export interface Partner {
  id: string;
  name: string;
  slug: string;
  status: PartnerStatus;
  integration: PartnerIntegration;
  /** Charged per appointment sent through, in minor units. */
  ratePerAppointment: number;
  currency: string;
  contactName: string;
  contactEmail: string;
  billingEmail: string;
  branding: PartnerBranding;
  credentials: PartnerCredentials;
  /** Requests per minute allowed against the partner API. */
  rateLimitPerMinute: number;
  createdAt: string;
}

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface Invoice {
  id: string;
  /** e.g. INV-2026-07-NEWYOU */
  number: string;
  partnerId: string;
  partnerName: string;
  /** Billing period, 'YYYY-MM'. */
  period: string;
  appointmentCount: number;
  /** Minor units, captured at generation so later rate changes never restate history. */
  ratePerAppointment: number;
  totalAmount: number;
  currency: string;
  status: InvoiceStatus;
  pdfUrl: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  /** Booking ids counted into this invoice — the evidence behind the total. */
  bookingIds: string[];
}

export function calculateInvoiceTotal(
  appointmentCount: number,
  ratePerAppointment: number
): number {
  return appointmentCount * ratePerAppointment;
}

/** Volume for one partner in the current period, for admin and portal headers. */
export interface PartnerVolume {
  partnerId: string;
  partnerName: string;
  period: string;
  appointmentCount: number;
  ratePerAppointment: number;
  runningTotal: number;
  currency: string;
}
