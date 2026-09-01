# DNS — SPF · DKIM · DMARC

Paste-ready records for a **dedicated sending subdomain**. Nothing here has been
applied: I have not touched DNS and will not.

## The subdomain

```
send.financialrails.org
```

Every record below hangs off it. The root `financialrails.org` is not modified.

**Why a subdomain, in one line:** sending reputation is scored per domain, and a
run of bounced invitations should not be able to affect whether your ordinary
mail from `financialrails.org` reaches an inbox. Keeping them separate means a
sending mistake stays contained.

---

## Records to paste

Host column is written both ways — most registrars want the relative name, a few
(Cloudflare among them) want the full name. Use whichever your panel expects.

### 1 · SPF

| Field | Value |
|---|---|
| **HOST** | `send` &nbsp;(full: `send.financialrails.org`) |
| **TYPE** | `TXT` |
| **VALUE** | `v=spf1 include:PROVIDER_SPF_HOST -all` |
| TTL | 3600 |

Replace `PROVIDER_SPF_HOST` with the one your email provider gives you:

| Provider | `include:` value |
|---|---|
| Resend | `amazonses.com` |
| Postmark | `spf.mtasv.net` |
| SendGrid | `sendgrid.net` |
| Amazon SES | `amazonses.com` |
| Mailgun | `mailgun.org` |

`-all` is a hard fail: mail from anywhere else claiming this subdomain is
rejected outright. That is the correct setting for a subdomain with exactly one
sender. Do not use `~all` here.

**One SPF record per host, ever.** Two TXT records both starting `v=spf1` is a
permerror and SPF stops working entirely. If you later add a second sender, add
a second `include:` to this one record.

---

### 2 · DKIM

**I cannot give you this value.** DKIM publishes a public key that your provider
generates and holds the private half of — inventing one would produce a record
that silently fails every signature check. Your provider shows the exact record
when you add `send.financialrails.org` as a sending domain.

It will have this shape:

| Field | Value |
|---|---|
| **HOST** | `SELECTOR._domainkey.send` &nbsp;(full: `SELECTOR._domainkey.send.financialrails.org`) |
| **TYPE** | `TXT` (some providers issue `CNAME` instead — paste what they give you) |
| **VALUE** | `v=DKIM1; k=rsa; p=<long base64 public key from your provider>` |
| TTL | 3600 |

Selectors by provider — so you can recognise the record when you see it:

| Provider | Selector | Record type |
|---|---|---|
| Resend | `resend` | TXT |
| Postmark | `<token>._domainkey` | CNAME |
| SendGrid | `s1`, `s2` (two records) | CNAME |
| Amazon SES | three `<token>._domainkey` | CNAME |
| Mailgun | `mailo`, `krs` or similar | TXT |

Paste the provider's record verbatim, including any trailing dot the panel adds.
A DKIM key broken across lines by a copy-paste is the single most common cause
of "it verified yesterday and not today".

---

### 3 · DMARC

| Field | Value |
|---|---|
| **HOST** | `_dmarc.send` &nbsp;(full: `_dmarc.send.financialrails.org`) |
| **TYPE** | `TXT` |
| **VALUE** | `v=DMARC1; p=none; rua=mailto:dmarc@financialrails.org; ruf=mailto:dmarc@financialrails.org; fo=1; adkim=s; aspf=s; pct=100` |
| TTL | 3600 |

`dmarc@financialrails.org` must be a mailbox that exists and that someone reads —
it is where the aggregate reports arrive. Change it before pasting if you would
rather they went elsewhere.

What the parameters do:

- `p=none` — **start here.** Monitor only: nothing is rejected while you confirm
  SPF and DKIM are aligned and passing. Tighten once the reports are clean.
- `adkim=s` / `aspf=s` — strict alignment. The `From:` domain must match the
  signing and envelope domains exactly, not merely share an organisational
  domain. Appropriate because this subdomain has one sender and no legacy mail.
- `fo=1` — send a forensic report when either check fails, not only when both do.
- `pct=100` — apply to all mail.

**The escalation, once reports are clean for two weeks:**

```
v=DMARC1; p=quarantine; rua=mailto:dmarc@financialrails.org; ruf=mailto:dmarc@financialrails.org; fo=1; adkim=s; aspf=s; pct=100
```

then, after two more clean weeks:

```
v=DMARC1; p=reject; rua=mailto:dmarc@financialrails.org; ruf=mailto:dmarc@financialrails.org; fo=1; adkim=s; aspf=s; pct=100
```

Do not skip to `p=reject`. If alignment is wrong you will not find out from a
report — you will find out because an invitation never arrived and nobody said so.

---

### 4 · The return-path record, if your provider asks for one

Some providers need a subdomain of their own for bounce handling, so that SPF
aligns on the envelope sender as well as the header.

| Field | Value |
|---|---|
| **HOST** | `bounce.send` &nbsp;(or whatever the provider names) |
| **TYPE** | `CNAME` |
| **VALUE** | provider-supplied |
| TTL | 3600 |

Resend and SES call it a "custom return path"; SendGrid calls it "link branding
and return path"; Postmark calls it a "Return-Path domain".

---

## One thing to check on the root domain — do not change it

You asked for nothing on the root, and there is nothing to add there. But note
how the two interact: a DMARC record on the root applies to subdomains by
inheritance **unless** the subdomain publishes its own — which `_dmarc.send`
above does, so it wins for `send.financialrails.org` regardless.

If the root has a DMARC record with an `sp=` parameter, that parameter is the
subdomain policy and it is overridden by the record above. If the root has
`p=reject` and no `sp=`, it would have applied to this subdomain — the record
above prevents that, which is exactly why the subdomain needs its own even at
`p=none`.

Worth reading, not changing:

```bash
dig +short TXT _dmarc.financialrails.org
```

---

## After pasting — verify before sending anything real

```bash
dig +short TXT send.financialrails.org
```

```bash
dig +short TXT _dmarc.send.financialrails.org
```

```bash
dig +short TXT resend._domainkey.send.financialrails.org
```

(substitute your provider's selector in the third)

Then send one message to a Gmail address, open it, `Show original`, and confirm
three lines read **PASS**: SPF, DKIM, DMARC. Only then point the application's
transactional mail at this subdomain.

Propagation is usually minutes and occasionally an hour. A record that does not
resolve after two hours is almost always the host field: a panel that appends the
zone to what you type turns `send.financialrails.org` into
`send.financialrails.org.financialrails.org`.
