# DNS for peptidemd.co.uk

The domain is registered with GoDaddy and using GoDaddy nameservers
(`ns07/ns08.domaincontrol.com`). Everything below is added in
**GoDaddy → My Products → Domains → peptidemd.co.uk → DNS → Manage Zones**.

Two things to know about the GoDaddy form before you start:

- **Name** is relative to the domain. Enter `staging`, not
  `staging.peptidemd.co.uk`. GoDaddy appends the domain itself, and typing the
  full name produces `staging.peptidemd.co.uk.peptidemd.co.uk`.
- **MX priority** is its own field. Put `10` in it and only the hostname in
  Value.
- **TTL** is a dropdown, not a number. Take whatever it defaults to, which is
  1/2 Hour on some record types and 1 Hour on others. Either is fine. The one
  to avoid is **1 Week**: if an IP changes or a DKIM token is re-issued,
  resolvers would keep serving the dead value for seven days.
- **CNAME values** are sometimes silently suffixed with your own domain. After
  saving, check the row reads `....dkim.amazonses.com` and not
  `....dkim.amazonses.com.peptidemd.co.uk`.

## 1. The site

The live site runs on the apex and `www`. GoDaddy's parking records for both
must be **deleted first**, otherwise the new ones will not save.

| Type | Name | Value |
|---|---|---|
| A | `@` | `100.29.81.212` |
| CNAME | `www` | `peptidemd.co.uk` |

`@` means the domain itself. GoDaddy currently has two parking A records on
`@` (`15.197.148.33` and `3.33.130.190`) and a `www` record pointing at them.
Delete all of those, then add the two above.

## 2. Email sending, SES DKIM

Three CNAMEs. These are what let SES sign mail as this domain, and until all
three resolve the domain stays unverified and no mail sends.

| Type | Name | Value |
|---|---|---|
| CNAME | `mleje32njth3ngckwfmqe4b4ip2la45t._domainkey` | `mleje32njth3ngckwfmqe4b4ip2la45t.dkim.amazonses.com` |
| CNAME | `rmnwfo5hxbuptvfho2myf225zhcd7gms._domainkey` | `rmnwfo5hxbuptvfho2myf225zhcd7gms.dkim.amazonses.com` |
| CNAME | `scwi3zmoue5e6gnwldjvfzrex5rtaisi._domainkey` | `scwi3zmoue5e6gnwldjvfzrex5rtaisi.dkim.amazonses.com` |

These tokens are specific to the **eu-west-2 (London)** SES identity. If the
region ever changes, all three change with it.

## 3. Email sending, custom MAIL FROM

Without these, the invisible return-path on every email belongs to
`amazonses.com` rather than to us. SPF then passes for Amazon and not for the
sending domain, so DMARC alignment fails and confirmation emails are more
likely to be filtered.

| Type | Name | Value | Priority |
|---|---|---|---|
| MX | `mail` | `feedback-smtp.eu-west-2.amazonses.com` | 10 |
| TXT | `mail` | `v=spf1 include:amazonses.com ~all` | |

## 4. DMARC, edit rather than add

**GoDaddy has already created a `_dmarc` record.** It currently reads:

```
v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;
```

Do **not** add a second one. A domain with two DMARC records has no valid
policy at all, and receivers discard both.

**Edit** the existing record and change `p=quarantine` to `p=none`, leaving
everything else as it is:

```
v=DMARC1; p=none; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;
```

`p=quarantine` tells receivers to spam-folder anything that fails. On a domain
that has never sent mail and whose DKIM records are not live yet, that means
the first confirmation emails land in spam and the domain starts building a
poor reputation. `p=none` monitors without punishing while we confirm SPF and
DKIM are aligning, which is the normal rollout order.

Put it back to `p=quarantine` once mail has been flowing cleanly for a couple
of weeks. That is a real improvement, just not the right first step.

## What happens after the records are added

Propagation is usually minutes on GoDaddy, occasionally up to an hour. Then, on
our side:

1. SES marks the domain verified and DKIM active.
2. Request SES production access, which lifts the 200 emails per day sandbox
   cap and, more importantly, allows sending to addresses that have not been
   individually verified. **This is the item that currently blocks Ross from
   receiving anything at his real address.** Approval is manual and typically
   takes a working day.
3. Issue the Let's Encrypt certificate for `staging.peptidemd.co.uk` and point
   nginx at it.
4. Switch the app over: `WEB_URL`, `API_URL`, `AWS_REGION=eu-west-2`,
   `SES_FROM_EMAIL=appointments@peptidemd.co.uk`.
5. Update the Stripe webhook endpoint to the new hostname.

## Before the site is indexed

The domain going live and the site being ready for the public are two separate
things. These are outstanding at the time of writing:

1. **The doctor is invented.** The site publishes "Dr Mark Jinks, MBBS
   MRCGP, GMC 7214883" on `/the-doctor`, in the portrait frame on the home
   page, and in the page's meta description, which is the text Google shows in
   results. The name and the number are placeholders. GMC numbers are seven
   digits, so 7214883 may well belong to a real doctor who is not ours. This
   has to be the real name, credentials and registration number before anyone
   outside the team sees the site.
2. **The legal pages are drafts** and say so in a visible banner. Privacy,
   terms and the medical disclaimer need Ross's legal advisor.
3. **Stripe is in test mode.** Real cards are declined. Live keys are needed
   from the TDH Stripe account before the site can take money.
4. **SES is in the sandbox.** Confirmation emails only reach individually
   verified addresses, so a real patient booking would receive nothing.
5. **The diary and admin panel hold seeded demo data**, including invented
   patients, partners and invoices.

Because of 1 and 2, indexing is opt-in. `apps/web/src/app/layout.tsx` emits
`noindex` unless `NEXT_PUBLIC_ALLOW_INDEXING=true` is set. The site is fully
reachable by anyone with the link either way; this only stops search engines
recording placeholder content that is awkward to get removed later. Set it once
the content above is real.

## Region

SES is in **eu-west-2 (London)**. The EC2 instance and the RDS database are
still in **us-east-1**, inherited from the Balmoral setup they share.

For a UK clinic storing patient names, contact details and intake answers about
their health, that database belongs in the UK or the EU. It is not a blocker
for staging with seeded data, but production should be built in eu-west-2
end to end. Flagging it here so it is a decision rather than an accident.
