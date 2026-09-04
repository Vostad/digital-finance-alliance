# DNS — SPF · DKIM · DMARC, as actually configured

**Status: all three are live and passing.** Verified against `1.1.1.1` on 4 September 2026, from
the records themselves rather than a provider dashboard.

> **This document previously described a setup that was never applied.** It prescribed a
> dedicated `send.financialrails.org` sending domain with `include:amazonses.com` and a strict
> `_dmarc.send` record, and stated that DNS had not been touched. That is not what exists. The
> domain was verified with Resend against the **root** domain, and `send.` exists as the return
> path rather than the sending identity. What follows is the live configuration.

---

## What is configured

Mail is sent through **Resend**, authenticated on the **root** domain
`financialrails.org`. Zoho serves ordinary mailboxes on the same domain, and the two coexist.

### SPF

| Host | Value |
|---|---|
| `financialrails.org` | `v=spf1 include:zoho.in include:spf.efwd.registrar-servers.com ~all` |
| `send.financialrails.org` | `v=spf1 ip4:52.3.252.119 ip4:44.222.39.36 ip4:199.249.231.0/24 ~all` |

**The root SPF does not list Resend, and does not need to.** SPF is evaluated against the
envelope return-path, not the `From:` header. Resend sets the return path on
`send.financialrails.org`, which carries its own SPF and its own bounce MX
(`feedback.forge.rmta.net`). SPF therefore passes on the subdomain.

### DKIM

| Host | Type | Value |
|---|---|---|
| `resend._domainkey.financialrails.org` | `TXT` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCblWc9…` |

Resend signs with `d=financialrails.org`. A second selector, `zmail._domainkey`, carries Zoho's
key for ordinary mailboxes — different selector, no conflict, do not remove it.

### DMARC

| Host | Value |
|---|---|
| `_dmarc.financialrails.org` | `v=DMARC1; p=none; rua=mailto:zanid.mir@financialrails.org; adkim=r; aspf=r` |

There is **no** `_dmarc.send` record, and none is needed: DMARC is evaluated on the
organisational domain of the `From:` header, and the root record covers the subdomain by
inheritance.

---

## Why it passes

DMARC requires SPF **or** DKIM to pass *and align*. Both do here, and the relaxed alignment
flags are what make that true:

- **SPF** passes on `send.financialrails.org` (the return path). `aspf=r` — relaxed — means
  alignment holds because that subdomain shares an organisational domain with the `From:`
  domain. Under `aspf=s` it would **fail**, because strict alignment requires an exact match.
- **DKIM** passes signed as `d=financialrails.org`. `adkim=r` holds trivially; here strict would
  also pass, since the signing domain is the root itself.

That is why the 3 September send succeeded, and it is the reason **the two `r` flags must not be
changed to `s` without moving the return path onto the root** — tightening them would break a
working configuration, silently, in a way only a DMARC report would reveal.

---

## The one thing still to do — DMARC is at `p=none`

`p=none` is **monitor only**. Nothing failing DMARC is quarantined or rejected today; the policy
observes and reports. That is the correct place to start and the wrong place to stay: until the
policy has teeth, the domain can still be spoofed.

Aggregate reports go to `zanid.mir@financialrails.org`. Read them, and when they show no
legitimate mail failing alignment for **two weeks**, move to:

```
v=DMARC1; p=quarantine; rua=mailto:zanid.mir@financialrails.org; adkim=r; aspf=r
```

Then, after **two more clean weeks**:

```
v=DMARC1; p=reject; rua=mailto:zanid.mir@financialrails.org; adkim=r; aspf=r
```

**Do not skip to `p=reject`.** If alignment is wrong you will not learn it from a report — you
will learn it because a prospectus never arrived and nobody said so. Keep `adkim=r` / `aspf=r`
at every step for the reason above.

Worth adding at the same time, once reports are being read: `fo=1`, so a forensic report is
generated when *either* check fails rather than only when both do.

---

## Verifying it, at any time

```bash
dig +short TXT financialrails.org @1.1.1.1
```
```bash
dig +short TXT send.financialrails.org @1.1.1.1
```
```bash
dig +short TXT resend._domainkey.financialrails.org @1.1.1.1
```
```bash
dig +short TXT _dmarc.financialrails.org @1.1.1.1
```

Query a resolver explicitly rather than the system one, and read the records rather than a
dashboard — a provider panel showing "verified" is reporting its own last check, not the current
state of the zone.

**End to end:** send one message to a Gmail address, open it, `Show original`, and confirm SPF,
DKIM and DMARC all read **PASS**.

---

## Rules for not breaking this

- **One SPF record per host, ever.** Two TXT records both starting `v=spf1` is a permerror and
  SPF stops working entirely. To add a sender, add an `include:` to the existing record.
- **Do not remove `zmail._domainkey`.** It is Zoho's, for ordinary mailboxes, and is unrelated to
  transactional mail.
- **Do not switch `adkim` / `aspf` to `s`** while the return path is on `send.` — see above.
- **Do not delete `send.financialrails.org`.** It looks unused. It is the return path, and
  without it SPF fails and DMARC then rests on DKIM alone.
- A DKIM key broken across lines by a copy-paste is the most common cause of "it verified
  yesterday and not today".

---

## What the application does with this

`EMAIL_PROVIDER_API_KEY` and `EMAIL_FROM_ADDRESS` are set in **Vercel Production only**.
`src/server/domain/email.ts` sends only when both are present; absent, `sendViaResend` returns
`"no provider configured"` and writes `last_error` rather than `sent_at`, so a message is never
recorded as delivered when it was not.

**Preview and local environments deliberately have neither**, and must not be given them: a
preview build that physically cannot email a real sponsor is the correct default.
