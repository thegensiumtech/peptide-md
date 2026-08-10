'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DoctorProfile } from '@peptide/shared';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { PortraitFrame } from '@/components/marketing/Primitives';
import { SavedNotice } from './SavedNotice';

export function DoctorProfileForm({ profile }: { profile: DoctorProfile }) {
  const [saved, setSaved] = useState(false);
  const [specialisms, setSpecialisms] = useState(profile.specialisms);
  const [draft, setDraft] = useState('');

  function addSpecialism() {
    const value = draft.trim();
    if (!value || specialisms.includes(value)) return;
    // New array rather than push — the list is state, not a mutable buffer.
    setSpecialisms([...specialisms, value]);
    setDraft('');
  }

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
          <CardHeader title="Identity" description="Shown at the top of the doctor’s page." />
          <CardBody className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name" htmlFor="name" required>
                <Input id="name" name="name" defaultValue={profile.name} />
              </Field>
              <Field label="Credentials" htmlFor="credentials" hint="Post-nominals, e.g. MBBS, MRCGP">
                <Input id="credentials" name="credentials" defaultValue={profile.credentials} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="GMC number"
                htmlFor="gmc"
                required
                hint="Displayed publicly so patients can verify registration."
              >
                <Input id="gmc" name="gmc" defaultValue={profile.gmcNumber} className="font-mono" />
              </Field>
              <Field label="Time zone" htmlFor="timezone" hint="The zone availability is set in.">
                <Input
                  id="timezone"
                  name="timezone"
                  defaultValue={profile.timezone}
                  className="font-mono"
                />
              </Field>
            </div>
            <Field
              label="Headline"
              htmlFor="headline"
              hint="One line, used as the heading on the doctor’s page."
            >
              <Input id="headline" name="headline" defaultValue={profile.headline} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Biography" description="Paragraphs are separated by a blank line." />
          <CardBody>
            <Field label="Bio" htmlFor="bio">
              <Textarea id="bio" name="bio" rows={12} defaultValue={profile.bio} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Areas" description="Shown as tags on the homepage and doctor page." />
          <CardBody>
            <ul className="flex flex-wrap gap-2">
              {specialisms.map((specialism) => (
                <li
                  key={specialism}
                  className="flex items-center gap-2 rounded border border-line bg-paper-deep px-3 py-1.5 text-micro text-ink"
                >
                  {specialism}
                  <button
                    type="button"
                    onClick={() => setSpecialisms(specialisms.filter((s) => s !== specialism))}
                    className="text-muted transition-colors hover:text-danger"
                  >
                    <span className="sr-only">Remove {specialism}</span>
                    <span aria-hidden>×</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <Field label="Add an area" htmlFor="specialism" className="min-w-56 flex-1">
                <Input
                  id="specialism"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addSpecialism();
                    }
                  }}
                  placeholder="e.g. Sleep and recovery"
                />
              </Field>
              <Button type="button" variant="secondary" size="md" onClick={addSpecialism}>
                Add
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:sticky xl:top-8 xl:self-start">
        <Card>
          <CardHeader title="Photograph" description="Appears on the homepage and doctor page." />
          <CardBody>
            <PortraitFrame
              name={profile.name}
              credentials={profile.credentials}
              gmcNumber={profile.gmcNumber}
            />
            <p className="mt-4 text-micro leading-relaxed text-muted">
              No photograph uploaded yet. Until one is added the frame shows the doctor’s initials
              and registration, so the page still reads as finished.
            </p>
            <Button type="button" variant="secondary" size="sm" className="mt-4">
              Upload a photograph
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SavedNotice
              show={saved}
              message="Profile saved. The public site has been updated."
              onDismiss={() => setSaved(false)}
            />
            <Button type="submit" size="lg" className="w-full">
              Save profile
            </Button>
            <Link
              href="/the-doctor"
              target="_blank"
              className="mt-4 block text-center text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
            >
              View the public page
            </Link>
          </CardBody>
        </Card>
      </div>
    </form>
  );
}
