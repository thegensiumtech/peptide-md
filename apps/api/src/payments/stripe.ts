import Stripe from 'stripe';
import { config } from '../config';

export const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  // Pinned deliberately: an account-level API version change should never
  // silently alter webhook payload shapes under a running deployment.
  apiVersion: '2025-02-24.acacia',
  appInfo: { name: 'Peptide MD', version: '1.0.0' },
  // Stripe's own retry, so a transient network blip does not lose a checkout.
  maxNetworkRetries: 2,
});

export interface CheckoutRequest {
  bookingId: string;
  reference: string;
  amount: number;
  currency: string;
  patientEmail: string;
  consultationName: string;
  durationMinutes: number;
}

/**
 * Creates the Checkout session the patient is redirected to.
 *
 * The price is built inline rather than from a stored Price id: the
 * consultation fee is an admin setting that can change, and pinning it to a
 * Stripe Price would mean the two drift. `bookingId` in the metadata is what
 * lets the webhook find its way back to our record.
 */
export async function createCheckoutSession(request: CheckoutRequest): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: request.patientEmail,
    client_reference_id: request.bookingId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: request.currency.toLowerCase(),
          unit_amount: request.amount,
          product_data: {
            name: request.consultationName,
            description: `${request.durationMinutes}-minute private video consultation`,
          },
        },
      },
    ],
    metadata: { bookingId: request.bookingId, reference: request.reference },
    payment_intent_data: {
      metadata: { bookingId: request.bookingId, reference: request.reference },
    },
    // The patient picks their time only after payment clears, so success
    // returns them to the slot screen carrying the booking.
    success_url: `${config.WEB_URL}/book/slot?booking=${request.bookingId}&session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.WEB_URL}/book/payment?booking=${request.bookingId}&cancelled=1`,
    // Abandoned sessions expire rather than lingering. Nothing was held, so
    // nothing needs releasing — but it closes the booking out cleanly.
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  });
}

export function constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, config.STRIPE_WEBHOOK_SECRET);
}

export async function refundPayment(
  paymentIntentId: string,
  reason: Stripe.RefundCreateParams.Reason = 'requested_by_customer'
): Promise<Stripe.Refund> {
  return stripe.refunds.create({ payment_intent: paymentIntentId, reason });
}
