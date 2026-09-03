# Post-launch items

Recorded 3 September 2026, at the production baseline `e950cc7`.
The codebase is frozen at `e950cc7`. P1 was closed by configuration and a
redeployment only — no application code was changed.

---

## P1 — Transactional email delivery — CLOSED 3 September 2026

**Status:** resolved. Financial Rails sends only from `financialrails.org`.

- **Sender:** `Financial Rails <hello@financialrails.org>`
- **Provider:** Resend
- **Verified sending domain:** `financialrails.org`

The DNS was already in place at Namecheap and needed no change:

| Record | Name | Value |
|---|---|---|
| CNAME | `send.financialrails.org` | `send.forge.rmta.net` (delegates SPF + Return-Path MX to Resend) |
| TXT | `resend._domainkey.financialrails.org` | RSA public key, `p=MIGfMA0…` |
| TXT | `_dmarc.financialrails.org` | `v=DMARC1; p=none; rua=…; adkim=r; aspf=r` |

The root SPF (`v=spf1 include:zoho.in include:spf.efwd.registrar-servers.com ~all`)
was **not touched**. Resend authenticates through the `send.` subdomain, so
the existing Zoho Mail service on this domain is unaffected and no second SPF
record exists at the root.

Verified end to end on 3 September 2026 against the live production domain:
form submission → `form_submissions` + `people` row → `email_outbox` row →
Resend accepted on `attempts = 1` with `sent_at` stamped and `last_error` null.
All test records were removed afterwards.

`vostad.com` is no longer referenced anywhere in the email path.

### Minor gap noted while verifying

`sendViaResend()` parses the provider message id out of the response, but
`email_outbox` has no column to store it, so it is discarded. Nothing depends
on it today; it would make provider-side tracing easier if a message is ever
disputed. One column plus one assignment — not urgent.

---

## F1 — Erasure has no interface

**Severity:** functional gap, not a security defect.

`erasePerson()` in `src/server/domain/governance.ts:315` is implemented and
correctly authorized — it refuses anyone who is not a Super Admin, refuses a
second erasure of the same person, and preserves the commercial record while
clearing personal fields. It is exposed as the `erase` server function in
`src/rpc/governance.ts:81`.

**No client code calls it.** The Governance page renders only the erasure
register ("Nobody has been erased"), so a Super Admin cannot trigger an
erasure from the UI. Exercising it today requires a direct RPC call.

Verified by: 22/22 governance integration tests against the production
database, covering Super Admin success, Admin refusal, Team Member refusal,
and double-erasure refusal.

**To close:** add a confirmation control on the person's record that calls the
existing `erase` server function. No domain or authorization work is required —
only the interface. Worth treating as the first post-launch task if a subject
access or deletion request is plausible in the near term, since the obligation
to erase can arrive without notice.

---

## F2 — Transient cold-start failures

**Severity:** reliability observation; not reproducible.

Two one-off failures were seen during production verification:

| Where | Symptom | Retry |
|---|---|---|
| `/admin/leads/$id` | `504 GATEWAY_TIMEOUT` | 200 in 3.2–7.5s across three attempts |
| `/admin` | error page (500 handler) | 200 in ~2.9s on the next two requests |

Neither reproduced. Both are consistent with a serverless cold start opening
connections through the Supabase transaction pooler.

Relevant context, already in place:

- `src/server/db/client.ts` uses `max: 5` — `max: 1` previously wedged any page
  that fans out (workstream detail issues 8 concurrent queries), and the
  integration suite could not catch it because it runs inside one transaction.
- `prepare: false` and `fetch_types: false` are required on the pooler.
- `SET LOCAL idle_in_transaction_session_timeout` makes an interrupted request
  release its locks rather than holding them.

**To watch:** whether these recur under real usage. If they do, the first thing
to measure is cold-start connection time against the pooler, before changing
any pool settings. Do not tune `max` speculatively — the current value was
arrived at by measurement.

---

## Not post-launch items

For the avoidance of doubt, these were verified and are closed:

- Authorization is enforced server-side, proven by calling the export RPC
  directly with the UI bypassed: the identical request returned a real CSV for
  a Super Admin and a refusal for an Admin.
- CSRF protection is active on every server function.
- Commission privacy holds independently of event scope.
- A deactivated account is refused on its next request and on a fresh login.
- RLS default-deny: 26 tables, 0 policies, 0 grants; the anon key reads nothing.
- All `GOLIVE` test data was removed; only the real Super Admin account remains.
