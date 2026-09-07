import { ENDPOINTS, ERROR_CODES } from '@/components/partner/ApiDocs';
import { CONVENTIONS, GLOSSARY, OVERVIEW, WALKTHROUGH } from './content';
import { TryItOut } from './TryItOut';

/**
 * The whole reference, rendered once and used in two places: inside the
 * partner portal, where the reader is signed in and sees their live pair, and
 * behind a shared link, where an outside developer sees the sandbox only.
 *
 * Keeping it in one component is what stops the two drifting. A shared link
 * that documented a slightly older API than the portal would be worse than not
 * offering one.
 */

export function DocsBody({
  baseUrl,
  partnerName,
  sandboxClientId,
  liveClientId,
  shared = false,
}: {
  baseUrl: string;
  partnerName: string;
  sandboxClientId: string | null;
  /** Omitted on a shared link: an outside reader gets the sandbox only. */
  liveClientId?: string | null;
  shared?: boolean;
}) {
  return (
    <div className="grid gap-12">
      {/* ---------- Orientation ---------- */}
      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="font-display text-h2 font-medium text-ink">
          Before you write any code
        </h2>
        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          {OVERVIEW.map((section) => (
            <div key={section.id}>
              <h3 className="font-display text-h3 font-medium text-ink">{section.title}</h3>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 32)} className="text-sm leading-relaxed text-ink-soft">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Your credentials ---------- */}
      <section aria-labelledby="creds-heading" className="rounded-lg border border-line bg-surface p-6 sm:p-8">
        <h2 id="creds-heading" className="font-display text-h3 font-medium text-ink">
          {partnerName}&rsquo;s credentials
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          The client id is the username in HTTP Basic auth. The secret is the password, and it is
          shown once when it is issued or rotated, so it is not repeated here.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
              Sandbox client id
            </p>
            <p className="mt-1 break-all rounded border border-line bg-paper-deep px-4 py-3 font-mono text-sm text-ink">
              {sandboxClientId ?? 'Not issued yet'}
            </p>
            <p className="mt-2 text-micro leading-relaxed text-muted">
              A separate practice diary. Book, move and cancel freely: nothing reaches a real
              patient, and none of it is invoiced.
            </p>
          </div>

          {shared ? (
            <div>
              <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                Live client id
              </p>
              <p className="mt-1 rounded border border-dashed border-line px-4 py-3 text-sm text-muted">
                Not shown on a shared link
              </p>
              <p className="mt-2 text-micro leading-relaxed text-muted">
                Ask {partnerName}&rsquo;s account owner for the live pair when the integration is
                finished and ready to take real appointments.
              </p>
            </div>
          ) : (
            <div>
              <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                Live client id
              </p>
              <p className="mt-1 break-all rounded border border-line bg-paper-deep px-4 py-3 font-mono text-sm text-ink">
                {liveClientId ?? 'Not issued yet'}
              </p>
              <p className="mt-2 text-micro leading-relaxed text-muted">
                Books the doctor&rsquo;s real diary. Every appointment counts towards the monthly
                invoice.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ---------- Walkthrough ---------- */}
      <section aria-labelledby="walkthrough-heading">
        <h2 id="walkthrough-heading" className="font-display text-h2 font-medium text-ink">
          A first integration, in order
        </h2>
        <ol className="mt-6 grid gap-px overflow-hidden rounded-lg border border-line bg-line">
          {WALKTHROUGH.map((step) => (
            <li key={step.step} className="grid gap-2 bg-surface p-5 sm:grid-cols-[3rem_1fr] sm:gap-5 sm:p-6">
              <span className="font-mono text-h3 font-medium text-accent">
                {String(step.step).padStart(2, '0')}
              </span>
              <div>
                <h3 className="font-display text-h3 font-medium text-ink">{step.title}</h3>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">{step.body}</p>
                {step.endpoint ? (
                  <p className="mt-2 font-mono text-micro text-muted">{step.endpoint}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Conventions ---------- */}
      <section aria-labelledby="conventions-heading">
        <h2 id="conventions-heading" className="font-display text-h2 font-medium text-ink">
          Rules that apply to every call
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {CONVENTIONS.map((section) => (
            <div key={section.id} className="rounded-lg border border-line bg-surface p-5 sm:p-6">
              <h3 className="font-display text-h3 font-medium text-ink">{section.title}</h3>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 32)} className="text-sm leading-relaxed text-ink-soft">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Endpoints, interactive ---------- */}
      <section aria-labelledby="endpoints-heading">
        <h2 id="endpoints-heading" className="font-display text-h2 font-medium text-ink">
          Endpoints
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Every call is listed with what it is for, what it takes, and what comes back. Press
          &ldquo;Try it out&rdquo; on any of them to run it against the API for real and see the
          response.
        </p>
        <div className="mt-6">
          <TryItOut
            endpoints={ENDPOINTS}
            baseUrl={baseUrl}
            sandboxClientId={sandboxClientId}
            liveClientId={shared ? null : liveClientId}
          />
        </div>
      </section>

      {/* ---------- Error codes ---------- */}
      <section aria-labelledby="errors-heading">
        <h2 id="errors-heading" className="font-display text-h2 font-medium text-ink">
          Error codes
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Branch on the code, never on the wording. Several of these are ordinary outcomes in a
          busy diary rather than faults in your integration.
        </p>
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="border-b border-line px-5 py-3 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                  Code
                </th>
                <th className="border-b border-line px-5 py-3 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                  HTTP
                </th>
                <th className="border-b border-line px-5 py-3 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                  What it means and what to do
                </th>
              </tr>
            </thead>
            <tbody>
              {ERROR_CODES.map((row) => (
                <tr key={row.code}>
                  <td className="border-b border-line px-5 py-3 align-top font-mono text-ink">
                    {row.code}
                  </td>
                  <td className="border-b border-line px-5 py-3 align-top font-mono text-muted">
                    {row.status}
                  </td>
                  <td className="border-b border-line px-5 py-3 align-top text-ink-soft">
                    {row.meaning}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- Glossary ---------- */}
      <section aria-labelledby="glossary-heading">
        <h2 id="glossary-heading" className="font-display text-h2 font-medium text-ink">
          Terminology
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Every word this API uses, defined. Nothing below assumes you have seen the platform
          before.
        </p>
        <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
          {GLOSSARY.map((entry) => (
            <div key={entry.term} className="bg-surface p-5">
              <dt className="font-display text-h3 font-medium text-ink">{entry.term}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{entry.definition}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
