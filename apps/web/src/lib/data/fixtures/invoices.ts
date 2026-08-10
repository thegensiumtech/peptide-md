import type { Invoice } from '@peptide/shared';
import { calculateInvoiceTotal } from '@peptide/shared';
import { bookings } from './bookings';

/**
 * Monthly partner invoices. July is closed and sent; August is the running
 * draft that the admin reviews before sending.
 *
 * The July counts are the worked example from the scope call: New You sent
 * sixty appointments and Five Peptides sent forty five. The twenty five direct
 * bookings Peptides MD took payment for sit outside partner billing entirely.
 */
interface InvoiceSeed {
  id: string;
  number: string;
  partnerId: string;
  partnerName: string;
  period: string;
  appointmentCount: number;
  rate: number;
  status: Invoice['status'];
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
}

const seeds: InvoiceSeed[] = [
  {
    id: 'inv_2026_07_newyou',
    number: 'INV-2026-07-NEWYOU',
    partnerId: 'ptr_newyou',
    partnerName: 'New You Peptides',
    period: '2026-07',
    appointmentCount: 60,
    rate: 4500,
    status: 'paid',
    issuedAt: '2026-08-01T08:00:00.000Z',
    dueAt: '2026-08-15T23:59:59.000Z',
    paidAt: '2026-08-06T10:14:00.000Z',
  },
  {
    id: 'inv_2026_07_fivepeptides',
    number: 'INV-2026-07-FIVEPEP',
    partnerId: 'ptr_fivepeptides',
    partnerName: 'Five Peptides',
    period: '2026-07',
    appointmentCount: 45,
    rate: 4000,
    status: 'sent',
    issuedAt: '2026-08-01T08:00:00.000Z',
    dueAt: '2026-08-15T23:59:59.000Z',
    paidAt: null,
  },
  {
    id: 'inv_2026_06_newyou',
    number: 'INV-2026-06-NEWYOU',
    partnerId: 'ptr_newyou',
    partnerName: 'New You Peptides',
    period: '2026-06',
    appointmentCount: 41,
    rate: 4500,
    status: 'paid',
    issuedAt: '2026-07-01T08:00:00.000Z',
    dueAt: '2026-07-15T23:59:59.000Z',
    paidAt: '2026-07-09T09:02:00.000Z',
  },
  {
    id: 'inv_2026_06_fivepeptides',
    number: 'INV-2026-06-FIVEPEP',
    partnerId: 'ptr_fivepeptides',
    partnerName: 'Five Peptides',
    period: '2026-06',
    appointmentCount: 28,
    rate: 4000,
    status: 'overdue',
    issuedAt: '2026-07-01T08:00:00.000Z',
    dueAt: '2026-07-15T23:59:59.000Z',
    paidAt: null,
  },
];

/** Ids of the August bookings that back each partner's running draft. */
function augustBookingIds(partnerId: string): string[] {
  return bookings
    .filter((b) => b.partnerId === partnerId && b.status !== 'cancelled')
    .map((b) => b.id);
}

const drafts: Invoice[] = [
  {
    id: 'inv_2026_08_newyou',
    number: 'INV-2026-08-NEWYOU',
    partnerId: 'ptr_newyou',
    partnerName: 'New You Peptides',
    period: '2026-08',
    appointmentCount: augustBookingIds('ptr_newyou').length,
    ratePerAppointment: 4500,
    totalAmount: calculateInvoiceTotal(augustBookingIds('ptr_newyou').length, 4500),
    currency: 'GBP',
    status: 'draft',
    pdfUrl: null,
    issuedAt: null,
    dueAt: null,
    paidAt: null,
    bookingIds: augustBookingIds('ptr_newyou'),
  },
  {
    id: 'inv_2026_08_fivepeptides',
    number: 'INV-2026-08-FIVEPEP',
    partnerId: 'ptr_fivepeptides',
    partnerName: 'Five Peptides',
    period: '2026-08',
    appointmentCount: augustBookingIds('ptr_fivepeptides').length,
    ratePerAppointment: 4000,
    totalAmount: calculateInvoiceTotal(augustBookingIds('ptr_fivepeptides').length, 4000),
    currency: 'GBP',
    status: 'draft',
    pdfUrl: null,
    issuedAt: null,
    dueAt: null,
    paidAt: null,
    bookingIds: augustBookingIds('ptr_fivepeptides'),
  },
];

const issued: Invoice[] = seeds.map((seed) => ({
  id: seed.id,
  number: seed.number,
  partnerId: seed.partnerId,
  partnerName: seed.partnerName,
  period: seed.period,
  appointmentCount: seed.appointmentCount,
  ratePerAppointment: seed.rate,
  totalAmount: calculateInvoiceTotal(seed.appointmentCount, seed.rate),
  currency: 'GBP',
  status: seed.status,
  pdfUrl: `/invoices/${seed.number}.pdf`,
  issuedAt: seed.issuedAt,
  dueAt: seed.dueAt,
  paidAt: seed.paidAt,
  // Historic invoices predate the fixture bookings, so the line detail for
  // them is summarised by count rather than itemised.
  bookingIds: [],
}));

export const invoices: Invoice[] = [...drafts, ...issued];
