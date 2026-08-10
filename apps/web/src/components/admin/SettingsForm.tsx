'use client';

import { useState } from 'react';
import type { PlatformSettings } from '@peptide/shared';
import { formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Field';
import { SavedNotice } from './SavedNotice';

/**
 * Money is entered in major units because that is how a person thinks about a
 * price, and converted to the minor units the platform stores on save.
 */
export function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const [saved, setSaved] = useState(false);
  const [price, setPrice] = useState(settings.consultation.priceAmount / 100);
  const [partnerRate, setPartnerRate] = useState(
    settings.partnerDefaults.defaultRatePerAppointment / 100
  );

  const currency = settings.consultation.currency;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(true);
      }}
      className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
    >
      <div className="grid gap-6">
        <Card>
          <CardHeader
            title="Consultation"
            description="What a patient booking directly on peptidemd.com pays and gets."
          />
          <CardBody className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={`Price (${currency})`}
                htmlFor="price"
                required
                hint={`Charged at checkout. Currently ${formatMoney(price * 100, currency)}.`}
              >
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(Number(event.target.value))}
                  className="font-mono"
                />
              </Field>
              <Field label="Duration (minutes)" htmlFor="duration" required>
                <Input
                  id="duration"
                  type="number"
                  min={5}
                  step={5}
                  defaultValue={settings.consultation.durationMinutes}
                  className="font-mono"
                />
              </Field>
            </div>
            <Field
              label="Summary"
              htmlFor="summary"
              hint="Shown on the consultation details screen before payment."
            >
              <Textarea id="summary" rows={3} defaultValue={settings.consultation.summary} />
            </Field>
            <Field
              label="How it is delivered"
              htmlFor="delivery"
              hint="Appears on the confirmation screen and in the confirmation email."
            >
              <Textarea id="delivery" rows={2} defaultValue={settings.consultation.deliveryNote} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Partner defaults"
            description="Applied to a new partner unless their own record overrides it."
          />
          <CardBody className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={`Default rate per appointment (${currency})`}
                htmlFor="partner-rate"
                required
                hint={`Currently ${formatMoney(partnerRate * 100, currency)} per appointment.`}
              >
                <Input
                  id="partner-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={partnerRate}
                  onChange={(event) => setPartnerRate(Number(event.target.value))}
                  className="font-mono"
                />
              </Field>
              <Field
                label="Slot hold (minutes)"
                htmlFor="hold"
                required
                hint="How long a selected time is held while a patient finishes booking."
              >
                <Input
                  id="hold"
                  type="number"
                  min={1}
                  defaultValue={settings.partnerDefaults.slotHoldMinutes}
                  className="font-mono"
                />
              </Field>
            </div>
            <Field
              label="Default API rate limit (requests per minute)"
              htmlFor="rate-limit"
              hint="Applied per partner. Individual partners can be raised on their own record."
            >
              <Input
                id="rate-limit"
                type="number"
                min={1}
                defaultValue={settings.partnerDefaults.defaultRateLimitPerMinute}
                className="font-mono"
              />
            </Field>
            <p className="rounded border border-line bg-paper-deep px-4 py-3 text-micro leading-relaxed text-muted">
              Changing the default rate does not restate existing partners or any invoice already
              raised — rates are captured on each invoice at the moment it is generated.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Notifications" description="How confirmations and reminders are sent." />
          <CardBody className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="From name" htmlFor="from-name">
                <Input id="from-name" defaultValue={settings.notifications.fromName} />
              </Field>
              <Field label="From address" htmlFor="from-email">
                <Input
                  id="from-email"
                  type="email"
                  defaultValue={settings.notifications.fromEmail}
                  className="font-mono"
                />
              </Field>
            </div>
            <Field
              label="Reminder lead time (hours)"
              htmlFor="reminder"
              hint="How long before the appointment the reminder goes out."
            >
              <Input
                id="reminder"
                type="number"
                min={1}
                defaultValue={settings.notifications.reminderLeadHours}
                className="font-mono"
              />
            </Field>
            <div className="grid gap-3">
              <Checkbox
                defaultChecked={settings.notifications.notifyDoctorOnBooking}
                label="Notify the doctor when a booking is made"
                description="Applies to direct and partner bookings alike."
              />
              <Checkbox
                defaultChecked={settings.notifications.notifyDoctorOnCancellation}
                label="Notify the doctor when a booking is cancelled"
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="xl:sticky xl:top-8 xl:self-start">
        <Card>
          <CardHeader title="Current pricing" />
          <CardBody>
            <dl className="grid gap-4">
              <div>
                <dt className="eyebrow">Patient pays</dt>
                <dd className="mt-1.5 font-mono text-h3 text-ink">
                  {formatMoney(price * 100, currency)}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Partner pays per appointment</dt>
                <dd className="mt-1.5 font-mono text-h3 text-amber">
                  {formatMoney(partnerRate * 100, currency)}
                </dd>
              </div>
            </dl>

            <SavedNotice
              show={saved}
              message="Settings saved."
              onDismiss={() => setSaved(false)}
            />

            <Button type="submit" size="lg" className="mt-6 w-full">
              Save settings
            </Button>
          </CardBody>
        </Card>
      </div>
    </form>
  );
}
