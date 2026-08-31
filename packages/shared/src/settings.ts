/** Platform settings the admin controls. */

export interface ConsultationSettings {
  /** Minor units. The price a direct patient pays at checkout. */
  priceAmount: number;
  currency: string;
  durationMinutes: number;
  /** What the consultation covers, shown on the consultation details screen. */
  summary: string;
  inclusions: string[];
  /** How the consultation is delivered, the joining link is emailed on confirm. */
  deliveryNote: string;
}

export interface PartnerDefaults {
  /** Minor units. Applied to a new partner unless overridden on their record. */
  defaultRatePerAppointment: number;
  currency: string;
  /** Minutes a slot is held while a patient completes booking. */
  slotHoldMinutes: number;
  defaultRateLimitPerMinute: number;
}

export interface NotificationSettings {
  fromName: string;
  fromEmail: string;
  /** Hours before the appointment that the reminder is sent. */
  reminderLeadHours: number;
  notifyDoctorOnBooking: boolean;
  notifyDoctorOnCancellation: boolean;
}

export interface PlatformSettings {
  consultation: ConsultationSettings;
  partnerDefaults: PartnerDefaults;
  notifications: NotificationSettings;
}

/** Booking volume for one period, split the way the admin dashboard reports it. */
export interface VolumeBySource {
  period: string;
  direct: number;
  partner: number;
  total: number;
}

export interface DashboardSummary {
  upcomingCount: number;
  monthVolume: VolumeBySource;
  /** Minor units currently billable across all partners this month. */
  billableThisMonth: number;
  currency: string;
  /** Direct consultation revenue this month, minor units. */
  directRevenueThisMonth: number;
  volumeTrend: VolumeBySource[];
}

// --- Reporting ---------------------------------------------------------------

/**
 * Volume for one partner in one period.
 *
 * Separate from PartnerVolume, which is the live running total behind this
 * month's invoice. This one is historic and settled: the rate is whatever the
 * invoice for that period captured, so a rate change today never restates it.
 */
export interface PartnerPeriodVolume {
  partnerId: string;
  partnerName: string;
  period: string;
  appointmentCount: number;
  /** Minor units. Null where the period has no invoice and no rate to apply. */
  billableAmount: number | null;
}

/** Everything the reporting screen draws, for one requested window. */
export interface VolumeReport {
  from: string;
  to: string;
  /** One entry per period in the window, oldest first, gaps filled with zeroes. */
  bySource: VolumeBySource[];
  /** One entry per partner per period, partners with no volume omitted. */
  byPartner: PartnerPeriodVolume[];
  totals: {
    direct: number;
    partner: number;
    total: number;
    /** Minor units billable to partners across the whole window. */
    billableAmount: number;
    /** Minor units taken directly through Stripe across the whole window. */
    directRevenue: number;
  };
  currency: string;
}
