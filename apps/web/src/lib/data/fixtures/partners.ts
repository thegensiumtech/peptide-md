import type { Partner } from '@peptide/shared';

/**
 * Static partner records. The two named partners are the ones from the scope
 * discussion. New You Peptides, who will build against the API, and Five
 * Peptides, who take the drop-in embed.
 */
export const partners: Partner[] = [
  {
    id: 'ptr_newyou',
    name: 'New You Peptides',
    slug: 'new-you-peptides',
    status: 'active',
    integration: 'api',
    ratePerAppointment: 4500,
    currency: 'GBP',
    contactName: 'Dana Whitfield',
    contactEmail: 'dana@newyoupeptides.com.au',
    billingEmail: 'accounts@newyoupeptides.com.au',
    branding: {
      primaryColor: '#0B3C49',
      accentColor: '#E4572E',
      fontFamily: 'Inter',
      logoUrl: null,
      displayName: 'New You Clinic',
    },
    credentials: {
      clientId: 'pmd_live_ny_8f21c4a9',
      secretLastFour: '4d17',
      createdAt: '2026-08-02T09:14:00.000Z',
      lastRotatedAt: null,
      lastUsedAt: '2026-08-09T07:41:00.000Z',
    },
    // Fixtures are a design-time stand in; no sandbox pair is modelled.
    sandboxCredentials: null,
    rateLimitPerMinute: 120,
    createdAt: '2026-08-02T09:14:00.000Z',
  },
  {
    id: 'ptr_fivepeptides',
    name: 'Five Peptides',
    slug: 'five-peptides',
    status: 'active',
    integration: 'embed',
    ratePerAppointment: 4000,
    currency: 'GBP',
    contactName: 'Marcus Iles',
    contactEmail: 'marcus@fivepeptides.co.uk',
    billingEmail: 'billing@fivepeptides.co.uk',
    branding: {
      primaryColor: '#1B1F3B',
      accentColor: '#C9A227',
      fontFamily: 'Public Sans',
      logoUrl: null,
      displayName: 'Five Peptides Clinic',
    },
    credentials: {
      clientId: 'pmd_live_fp_2b70e5d3',
      secretLastFour: '9c02',
      createdAt: '2026-08-04T11:30:00.000Z',
      lastRotatedAt: '2026-08-08T16:02:00.000Z',
      lastUsedAt: '2026-08-09T06:12:00.000Z',
    },
    // Fixtures are a design-time stand in; no sandbox pair is modelled.
    sandboxCredentials: null,
    rateLimitPerMinute: 60,
    createdAt: '2026-08-04T11:30:00.000Z',
  },
  {
    id: 'ptr_apexlabs',
    name: 'Apex Labs',
    slug: 'apex-labs',
    status: 'suspended',
    integration: 'embed',
    ratePerAppointment: 4000,
    currency: 'GBP',
    contactName: 'Priya Raman',
    contactEmail: 'priya@apexlabs.co.uk',
    billingEmail: 'finance@apexlabs.co.uk',
    branding: {
      primaryColor: '#22333B',
      accentColor: '#5E8C61',
      fontFamily: 'Inter',
      logoUrl: null,
      displayName: 'Apex Labs Consults',
    },
    credentials: {
      clientId: 'pmd_test_ax_5e93b118',
      secretLastFour: '71ab',
      createdAt: '2026-07-28T13:05:00.000Z',
      lastRotatedAt: null,
      lastUsedAt: '2026-08-01T10:22:00.000Z',
    },
    // Fixtures are a design-time stand in; no sandbox pair is modelled.
    sandboxCredentials: null,
    rateLimitPerMinute: 60,
    createdAt: '2026-07-28T13:05:00.000Z',
  },
];
