import type { PlatformSettings } from '@peptide/shared';

export const platformSettings: PlatformSettings = {
  consultation: {
    priceAmount: 9500,
    currency: 'GBP',
    durationMinutes: 20,
    summary:
      'A private video consultation with Dr Hartley about peptide therapy, what you are taking, what you are trying to achieve, and whether it is the right route for you.',
    inclusions: [
      'Twenty minutes of the doctor’s time, one to one',
      'Review of anything you are currently taking',
      'A written summary emailed within 24 hours',
      'A straight answer, including when that answer is no',
    ],
    deliveryNote:
      'The consultation is held over video. Your joining link is in the confirmation email and again in the reminder.',
  },
  partnerDefaults: {
    defaultRatePerAppointment: 4000,
    currency: 'GBP',
    slotHoldMinutes: 10,
    defaultRateLimitPerMinute: 60,
  },
  notifications: {
    fromName: 'Peptide MD',
    fromEmail: 'appointments@peptidemd.com',
    reminderLeadHours: 24,
    notifyDoctorOnBooking: true,
    notifyDoctorOnCancellation: true,
  },
};
