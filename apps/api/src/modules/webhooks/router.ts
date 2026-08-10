import { Router, raw } from 'express';
import type Stripe from 'stripe';
import { prisma } from '@peptide/database';
import { logger } from '../../logger';
import { constructWebhookEvent } from '../../payments/stripe';
import { failBooking, recordSuccessfulPayment } from '../bookings/service';

export const webhookRouter = Router();

/**
 * Stripe webhook.
 *
 * The scope makes this the single source of truth for payment state: nothing
 * else can move a booking out of PENDING_PAYMENT. The browser returning from
 * Checkout is only a redirect, not proof of anything.
 *
 * Three properties matter here:
 *  - Signature verified against the raw body, so the endpoint cannot be spoofed.
 *  - Every event recorded before it is acted on, so a handler crash is
 *    replayable rather than a lost booking.
 *  - Idempotent by event id, because Stripe retries.
 */
webhookRouter.post('/stripe', raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') {
    return res.status(400).json({ success: false, data: null, error: 'Missing signature.' });
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(req.body as Buffer, signature);
  } catch (error) {
    logger.warn(
      { err: error instanceof Error ? error.message : error },
      'Rejected a webhook with an invalid signature'
    );
    return res.status(400).json({ success: false, data: null, error: 'Invalid signature.' });
  }

  // Record first. Acknowledging quickly stops Stripe retrying while we work.
  const record = await prisma.webhookEvent.upsert({
    where: { source_externalId: { source: 'stripe', externalId: event.id } },
    update: { attempts: { increment: 1 } },
    create: {
      source: 'stripe',
      externalId: event.id,
      type: event.type,
      payload: event as unknown as object,
      attempts: 1,
    },
  });

  if (record.processedAt) {
    logger.debug({ eventId: event.id, type: event.type }, 'Webhook already processed — ignoring');
    return res.json({ received: true, duplicate: true });
  }

  res.json({ received: true });

  try {
    await handleEvent(event);
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { processedAt: new Date(), error: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook failure';
    logger.error({ err: message, eventId: event.id, type: event.type }, 'Webhook handler failed');
    await prisma.webhookEvent.update({ where: { id: record.id }, data: { error: message } });
  }
});

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.bookingId ?? session.client_reference_id;
      if (!bookingId) {
        logger.error({ sessionId: session.id }, 'Checkout completed with no bookingId');
        return;
      }

      // Payment is confirmed, but the patient has not chosen a time yet — this
      // flow takes the money first. Marking PAID is what unlocks the calendar.
      await prisma.booking.update({
        where: { id: bookingId },
        data: { paymentStatus: 'PAID', amountPaid: session.amount_total ?? null },
      });

      await recordSuccessfulPayment({
        bookingId,
        paymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
        amount: session.amount_total ?? 0,
        currency: (session.currency ?? 'gbp').toUpperCase(),
      });

      logger.info({ bookingId }, 'Payment confirmed — calendar unlocked');
      return;
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.bookingId ?? session.client_reference_id;
      if (bookingId) await failBooking(bookingId, 'Checkout session expired');
      return;
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent;
      const bookingId = intent.metadata?.bookingId;
      if (!bookingId) return;

      await prisma.payment.create({
        data: {
          bookingId,
          stripePaymentIntentId: intent.id,
          amount: intent.amount,
          currency: intent.currency.toUpperCase(),
          type: 'FAILED',
          failureReason: intent.last_payment_error?.message ?? null,
        },
      });

      await failBooking(bookingId, intent.last_payment_error?.message ?? 'Payment failed');
      return;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
      if (!intentId) return;

      const payment = await prisma.payment.findFirst({
        where: { stripePaymentIntentId: intentId },
        orderBy: { createdAt: 'desc' },
      });
      if (!payment) return;

      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: 'REFUNDED' },
      });
      logger.info({ bookingId: payment.bookingId }, 'Refund recorded');
      return;
    }

    default:
      logger.debug({ type: event.type }, 'Unhandled webhook type');
  }
}
