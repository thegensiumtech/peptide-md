import type { Metadata } from 'next';
import { getPartnerMe, toPartner } from '@/lib/api/partner';
import { requirePartnerId, requireSession } from '@/lib/auth/session';
import { PartnerShell } from '@/components/partner/PartnerShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { CodeBlock, EndpointCard, ENDPOINTS, ERROR_CODES } from '@/components/partner/ApiDocs';

export const metadata: Metadata = {
  title: 'API documentation',
  robots: { index: false, follow: false },
};

/**
 * The partner API reference, with this partner's own credentials in it.
 *
 * Behind the portal login rather than public, because half of what makes it
 * useful is that the client ids are the reader's own: a developer at New You
 * can copy a curl command, paste their secret, and get a real response without
 * first working out which id is theirs.
 */
export default async function PartnerApiDocsPage() {
  const session = await requireSession('partner', '/partner/api-docs');
  requirePartnerId(session);

  const meRes = await getPartnerMe();
  if (!meRes.success) throw new Error('Partner unavailable');
  const partner = toPartner(meRes.data);

  // Whatever origin this deployment actually serves the API from, so the
  // examples are runnable rather than illustrative.
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  return (
    <PartnerShell
      user={session}
      partner={partner}
      title="API documentation"
      description="Everything needed to book into Dr Jinks’s diary from your own system. Build against the sandbox first; it is a separate diary, so nothing you do there reaches a real patient."
    >
      <Card>
        <CardHeader
          title="Authenticating"
          description="HTTP Basic, with your client id as the username and your secret as the password. Send it on every request."
        />
        <CardBody>
          <CodeBlock>{`curl ${baseUrl}/api/v1/availability \\
  -u "${partner.credentials.clientId}:YOUR_SECRET"`}</CodeBlock>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                Live client id
              </p>
              <p className="mt-1 break-all rounded border border-line bg-paper-deep px-4 py-3 font-mono text-sm text-ink">
                {partner.credentials.clientId}
              </p>
              <p className="mt-2 text-micro leading-relaxed text-muted">
                Books the doctor’s real diary. Every appointment counts towards your monthly
                invoice.
              </p>
            </div>

            <div>
              <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                Sandbox client id
              </p>
              <p className="mt-1 break-all rounded border border-accent/30 bg-accent-tint px-4 py-3 font-mono text-sm text-ink">
                {partner.sandboxCredentials?.clientId ?? 'Not yet issued, ask us for one'}
              </p>
              <p className="mt-2 text-micro leading-relaxed text-muted">
                Books a separate diary that is always wide open. Nothing here reaches a patient or
                the doctor, and none of it is ever invoiced.
              </p>
            </div>
          </div>

          <p className="mt-5 rounded border border-line bg-paper-deep px-4 py-3 text-micro leading-relaxed text-muted">
            Secrets are shown once, when they are issued or rotated, and are never recoverable. If
            you have lost yours, rotate it on the API credentials screen. The old secret keeps
            working for 24 hours afterwards so you can roll it without an outage.
          </p>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="How a booking is made"
          description="Three calls. The middle one is the one that matters, because it is what stops two people taking the same time."
        />
        <CardBody>
          <ol className="grid gap-3 text-sm leading-relaxed text-ink">
            <li>
              <span className="font-mono text-micro text-muted">1</span>{' '}
              <strong className="font-medium">Ask what is free.</strong> Nothing is reserved by
              asking, so treat the answer as a suggestion rather than a promise.
            </li>
            <li>
              <span className="font-mono text-micro text-muted">2</span>{' '}
              <strong className="font-medium">Hold the time</strong> as soon as your patient picks
              it, before they start typing their details. The hold locks that slot against our own
              website and every other partner, and expires on its own if the patient wanders off.
            </li>
            <li>
              <span className="font-mono text-micro text-muted">3</span>{' '}
              <strong className="font-medium">Confirm the booking</strong> against the hold. The
              patient is emailed a joining link and the doctor gets their intake answers.
            </li>
          </ol>

          <p className="mt-5 text-sm leading-relaxed text-muted">
            You take the payment on your own side. We never charge the patient and never ask them
            for a card. What you owe is counted per appointment and invoiced at month end.
          </p>
        </CardBody>
      </Card>

      <section className="mt-8">
        <h2 className="font-display text-h3 font-medium text-ink">Endpoints</h2>
        {ENDPOINTS.map((endpoint) => (
          <EndpointCard key={`${endpoint.method} ${endpoint.path}`} endpoint={endpoint} baseUrl={baseUrl} />
        ))}
      </section>

      <Card className="mt-8 overflow-hidden">
        <CardHeader
          title="Errors worth handling"
          description="Every response carries the same envelope. On a failure, success is false and error holds a sentence you could show a patient."
        />
        <CardBody>
          <CodeBlock>{`{
  "success": false,
  "data": null,
  "error": "That time has just been taken.",
  "code": "SLOT_TAKEN"
}`}</CodeBlock>
        </CardBody>
        <TableWrap>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th align="right">HTTP</Th>
              <Th>What to do</Th>
            </tr>
          </thead>
          <tbody>
            {ERROR_CODES.map((row) => (
              <Tr key={row.code}>
                <Td className="whitespace-nowrap font-mono text-sm">{row.code}</Td>
                <Td align="right" className="font-mono">
                  {row.status}
                </Td>
                <Td>{row.meaning}</Td>
              </Tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Rate limit"
          description="Per client id, counted per minute."
        />
        <CardBody>
          <p className="text-sm leading-relaxed text-ink">
            Your account is set to{' '}
            <span className="font-mono">{partner.rateLimitPerMinute}</span> requests per minute.
            Going over returns <span className="font-mono text-micro">429</span>. If that is too
            tight for how you have built things, tell us and we will raise it rather than have you
            work around it.
          </p>
        </CardBody>
      </Card>
    </PartnerShell>
  );
}
