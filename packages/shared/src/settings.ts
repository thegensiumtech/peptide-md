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
