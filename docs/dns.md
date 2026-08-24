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
- **TTL** is a dropdown, not a number. Leave every record on the default
  **1/2 Hour**. Short enough that changing an IP or re-issuing a DKIM token
  propagates in minutes rather than sitting cached for a day.

## 1. The site

| Type | Name | Value |
|---|---|---|
| A | `staging` | `100.29.81.212` |

That is the staging server. The apex (`peptidemd.co.uk`) and `www` are left on
GoDaddy's parking page deliberately, see [Why not the apex yet](#why-not-the-apex-yet).

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

## 4. DMARC

| Type | Name | Value |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none;` |

`p=none` monitors without rejecting anything, which is the right setting while
we confirm every legitimate sender passes. Tighten to `p=quarantine` once mail
has been flowing cleanly for a couple of weeks.

No `rua=` reporting address is set, because reports need a mailbox on the
domain to arrive at and there is not one yet.

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

## Why not the apex yet

`peptidemd.co.uk` and `www` stay parked until a production server exists.

The box at `100.29.81.212` runs Stripe **test** keys and a seeded demo diary.
Pointing the public domain at it would put a site that takes fake payments and
shows invented appointments on the address people will find in search results
and on business cards. Staging gets its own subdomain, production takes the
apex when it is built, and nothing has to be migrated later.

## Region

SES is in **eu-west-2 (London)**. The EC2 instance and the RDS database are
still in **us-east-1**, inherited from the Balmoral setup they share.

For a UK clinic storing patient names, contact details and intake answers about
their health, that database belongs in the UK or the EU. It is not a blocker
for staging with seeded data, but production should be built in eu-west-2
end to end. Flagging it here so it is a decision rather than an accident.
