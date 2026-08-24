import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro } from '@/components/marketing/PageIntro';
import { ContactForm } from '@/components/marketing/ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Ask a question before you book, or get help with an existing appointment. We answer within one working day.',
};

export default function ContactPage() {
  return (
    <>
      <PageIntro
        eyebrow="Contact"
        title="Ask before you book."
        lede="If you are not sure the consultation is right for you, ask. We would rather tell you it is not than take your money."
      />

      <section className="shell mt-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-20">
          <ContactForm />

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-line bg-surface p-6">
              <p className="eyebrow">Direct</p>
              <dl className="mt-5 space-y-5">
                <div>
                  <dt className="text-micro text-muted">Email</dt>
                  <dd className="mt-1">
                    <a
                      href="mailto:hello@peptidemd.co.uk"
                      className="font-mono text-sm text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
                    >
                      hello@peptidemd.co.uk
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-micro text-muted">Response time</dt>
                  <dd className="mt-1 text-sm text-ink">One working day</dd>
                </div>
                <div>
                  <dt className="text-micro text-muted">Existing appointment</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink-soft">
                    Reply directly to your confirmation email, it reaches the right place fastest
                    and already carries your booking reference.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 rounded-lg border border-danger/20 bg-danger-tint p-6">
              <p className="eyebrow text-danger">If it is urgent</p>
              <p className="mt-3 text-sm leading-relaxed text-ink">
                This form is not monitored out of hours and is not for emergencies. If you are
                unwell or worried about a reaction, contact NHS 111, your GP, or emergency
                services.
              </p>
            </div>

            <div className="mt-6 rounded-lg border border-line p-6">
              <p className="eyebrow">Companies</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                If you run a clinic or retailer and want to offer these consultations inside your
                own site, say so in the message and it will reach the right person.
              </p>
              <Link
                href="/partner/login"
                className="link-cta mt-4 inline-block text-micro text-ink underline decoration-line underline-offset-4"
              >
                Existing partner? Sign in
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
