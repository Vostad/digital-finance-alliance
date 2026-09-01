# FINANCIAL RAILS OS — BUILD SPECIFICATION

**Status:** approved · Gate 1 passed · Gate 2 passed (`4b9b1d5`)
**Platform:** financialrails.org · Supabase + Vercel + TanStack Start + Drizzle

> **PROVENANCE — read this first.**
> This file did not exist in the repository until the final build execution
> began. The specification lived in the approving conversation only. It is
> reconstructed here, verbatim in substance, from three approved sources:
> the Gate 1 stack-and-data-model approval, the Gate 2 outcomes verified
> against the live Supabase project, and the final build execution order.
> Where the reconstruction resolved a conflict, the conflict and its
> resolution are recorded in §R at the end. Nothing here is invented.

---

## §0 · GOVERNING PRINCIPLES

```
LEAN FRONT END.  STRONG DATA MODEL.  NO HIDDEN LEADS.  NO DUPLICATE PEOPLE.
```

- **Decide and propose, do not assume.** Inspect the repository and the live
  database before writing code.
- **Do not build a generic CRM. Do not over-engineer.**
- All timestamps stored UTC (`timestamptz`), rendered through the user's zone.
- Every monetary column carries a currency code alongside it.
- All writes validate authorization **server-side**. Never rely on UI hiding.
- **Do not invent data.** Do not seed fake commercial history and present it
  as real. Development fixtures must be marked DEMO and isolated.

---

## §1 · PRODUCT

The internal operating system for Financial Rails events and editions.
Not a CRM. The flow is:

```
CAPTURE → ASSIGN → WORK → TRACK → TARGET → FORECAST → COMMISSION → IMPROVE
```

### Work functions — three, and they are NOT roles

```
SPONSOR      DELEGATE      SPEAKER
```

A Team Member may hold any combination. One person or company may carry
several simultaneous workstreams with **different owners**:

```
John Smith / ABC Bank    Sponsor → Ahmed
                         Speaker → Sara
                         Delegate → Imran
```

Never create a duplicate person or company because the function or the owner
changed.

### User roles — exactly three

| Role | Reach |
|---|---|
| **SUPER ADMIN** | Complete visibility and control. Unscoped. |
| **ADMIN** | Operational access within *explicitly assigned* event scope. |
| **TEAM MEMBER** | Only permitted functions, and only their own workstreams. |

No additional system roles, ever.

### Events and editions

One Financial Rails OS. One shared database. Editions: MENA, ASIA, AFRICA,
and future editions. A person or company **persists across editions**:

```
TEMENOS   MENA 2026 → Sponsor → WON
          ASIA 2027 → Sponsor → PROSPECT      ← same company record
```

---

## §2 · PEOPLE AND COMPANIES

One person record. One company record.

- Multiple emails per person (`person_emails`), unique on `lower(email)` —
  this constraint **is** the identity rule.
- Company domains (`company_domains`), unique on `lower(domain)`. Free mail
  hosts are rejected as company identity.
- `normalized_name` on both, for the no-email match path.
- Merge is reversible for 30 days; the loser survives with `merged_into_id`
  set and every repointed FK captured in the merge snapshot.
- Erasure (§31) is the single audited exception to "never delete".

**Duplicate prevention must work on real data.** Before any manual creation,
search and show probable matches. Never silently create a duplicate.

---

## §3 · OPPORTUNITIES / WORKSTREAMS

There is no separate lead entity. **A lead is an opportunity at NEW.**

Every opportunity belongs to: person · company · edition · function · owner.

`owner_id` is nullable **by design**. NULL means UNASSIGNED, and the Super
Admin inbox is defined as `owner_id IS NULL` — a database property, not a
convention.

Different functions on the same person are independent workstreams and may
have different owners.

---

## §4 · PIPELINES — AUTHORITATIVE STAGE LISTS

### SPONSOR
```
NEW · CONTACTED · QUALIFIED · MEETING · PROPOSAL · NEGOTIATION
WON · LOST · CANCELLED
```
Carries: estimated value, final value, probability, owner, event, next action,
loss reason. **A WON sponsor opportunity MUST have `final_value`.**

### DELEGATE
```
NEW · CONTACTED · INTERESTED · APPLICATION · CONFIRMED · ATTENDED
DECLINED · LOST
```
Counts, not money. No commission in V1.

### SPEAKER
```
RESEARCH · CONTACTED · INTERESTED · INVITED · CONFIRMED
DECLINED · WITHDRAWN
```
Count-based targets. No commission in V1.

### Transition rules (§46.3)

- **CANCELLED is a SPONSOR stage only.**
- CANCELLED is reachable **only from WON**.
- An opportunity that was never WON becomes **LOST**, not CANCELLED.
- WON is otherwise terminal; it cannot move backwards.
- CANCELLED requires a cancellation reason:
  `DEAL COLLAPSED · NON-PAYMENT · SPONSOR WITHDREW · EVENT CHANGE · OTHER`
- CANCELLED **automatically** creates the reversing commission entry via
  `reverses_entry_id`. No manual reversal is permitted.
- CANCELLED is excluded from closed revenue, win rate and target achievement.
- A cancelled workstream does not block a new sponsor workstream for the same
  person/company and edition.

### Loss reasons — required on terminal LOST

| Function | Reasons |
|---|---|
| Sponsor | PRICE · TIMING · BUDGET · WRONG AUDIENCE · COMPETITOR · NO RESPONSE · NOT INTERESTED · OTHER |
| Delegate | NOT INTERESTED · TIMING · NOT QUALIFIED · NO RESPONSE · OTHER |
| Speaker | DECLINED · TIMING · NOT AVAILABLE · WRONG FIT · NO RESPONSE · OTHER |

Terminal LOST without a reason is not permitted.

---

## §5 · MANUAL LEAD CREATION — FIRST CLASS

Every Team Member has `+ ADD LEAD`. Fields: person name, company, job title,
email, phone, country, function (multiple allowed), event/edition, lead
source, notes. Records `created_by` / `created_at` automatically. Runs
duplicate matching before saving. **Manual leads appear to Super Admin
immediately.**

---

## §6 · WEBSITE LEADS — REAL INTEGRATION

The public microsite is live at `/forums/mena`.

| Form | Creates |
|---|---|
| REQUEST THE PROSPECTUS | Sponsor opportunity · source WEBSITE · NEW · owner UNASSIGNED |
| APPLY TO ATTEND | Delegate opportunity · source WEBSITE · NEW · owner UNASSIGNED |

Required: server-side validation, rate limiting, spam protection, duplicate
matching, **raw submission preserved verbatim**. The submission must be stored
even if outbound email fails. No `mailto:`. No fake backend behaviour.

---

## §7 · OWNERSHIP AND ASSIGNMENT

Ownership is **per workstream**. Super Admin assigns anything; Admin only
inside permitted scope; Team Members never reassign. Every assignment change
is audited.

---

## §8 · ACTIVITY AND NEXT ACTIONS

Types: CALL · EMAIL · MEETING · FOLLOW-UP · NOTE · PROPOSAL · STATUS CHANGE ·
ASSIGNMENT · OTHER. Each stores user, timestamp, type, notes. **Append-only —
activity history cannot be silently deleted.**

Every active opportunity carries NEXT ACTION + DUE DATE. Surface overdue, due
today, upcoming.

---

## §9 · TARGETS

Super Admin sets targets by event · edition · function · team member · period.
Sponsor targets are monetary; delegate and speaker targets are counts. Team
Members see only targets for their permitted functions.

Show: TARGET · ACHIEVED · REMAINING · PIPELINE · FORECAST · PROGRESS %.

---

## §10 · COMMISSION — SPONSOR ONLY IN V1

Only sponsor opportunities participate. Delegate and speaker earn none.
Commission rules stay configurable for future extension, but **in V1 only
`sponsor` rules may be created or calculated**.

Supports percentage · fixed amount · tier/threshold · per team member ·
per event. **No rate is hardcoded anywhere.**

Commission calculates from **FINAL CONTRACTED VALUE at WON** — never from
estimated value, never from collected cash. The rate is **locked at WON**:
changing a rule later must never alter historical commission.

Supports revisions, reversals, cancellation, secondary-owner split, via an
append-only ledger where the balance is `SUM(amount)` and a reversal is a
negative row carrying `reverses_entry_id`.

**Commission is reporting only. Not payroll. Not accounting.**

Visibility: Team Member sees only their own. Super Admin sees all. Admin sees
commission **only if explicitly granted** (`can_view_commission`, default
false). Managing rules is a separate grant (`can_manage_commission_rules`).

---

## §11 · FORECAST

Super Admin sees TOTAL PIPELINE · WEIGHTED PIPELINE · CLOSED REVENUE · TARGET
· REMAINING · FORECAST.

Weighted pipeline = `value × probability`, using the approved sponsor-stage
probabilities, with an opportunity-level override that is recorded
(`probability_overridden`).

Label the result **FORECAST**. Never call it guaranteed revenue.

---

## §12 · PRODUCTIVITY AND INSIGHTS

Dashboards answer: *What do I need to do? How am I doing? What can I still
achieve? What can I earn?*

Metrics computed from actual data only: contact rate, response rate, meeting
rate, proposal rate, close rate, average deal size, rejection rate, time to
close, pipeline velocity. Where the sample is too small, display
**NOT ENOUGH DATA**. No fabricated statistics, no fake predictive certainty.

Suggestions are **deterministic and data-driven — no model calls**. Every
suggestion traces to actual records.

---

## §13 · CROSS-WORKSTREAM VISIBILITY

If a Team Member works a company or person they MAY see: the other
workstream, its owner, its current status — so they do not duplicate outreach.

They MAY NOT see: private notes, opportunity value, private activity,
commission, private targets.

---

## §14 · SEARCH, FILTERS, EXPORT

Search people · companies · opportunities · events · team members, by name,
company, email, phone. Filters: event, edition, function, owner, status, lead
source, priority, date, company, country. **Every result respects
permissions.**

Super Admin can export permitted data as CSV, authorization respected.

---

## §15 · EVENT MEMORY / RENEWAL

Person and company history persists across editions. A WON sponsor
opportunity can be **cloned into a new edition** at NEW status with a new
owner, via `cloned_from_id`. The historical opportunity is preserved
untouched.

---

## §16 · AUDIT

Audit lead creation, assignment, reassignment, status changes, owner changes,
target changes, commission changes, commission reversal, merge, renewal.
Show WHO · WHEN · WHAT CHANGED. **No silent changes.**

---

## §17 · SECURITY (already built and verified at Gate 2)

Supabase + Vercel + Drizzle + `scopedQuery(ctx)` + RLS default-deny.

1. RLS on, default deny, every table. The anon key reads nothing.
2. Service role key is **server-only** — never in a client bundle, never
   `VITE_`-prefixed. Build-time check fails the build if it leaks.
3. Deactivation ends access immediately: ctx resolution reads the user row on
   every request; deactivation also revokes the refresh token; access-token
   TTL lowered accordingly.
4. Role and scope are **domain data, not JWT claims**.
5. One migration tool: **drizzle-kit**. The Supabase CLI never writes schema.
6. Runtime uses the **pooled** connection (transaction mode, 6543).

Do not introduce Neon, Better Auth, a second database, or a second auth
provider.

---

## §18 · EMAIL

Approved transactional provider, on a dedicated sending subdomain
(`send.financialrails.org`, SPF/DKIM/DMARC — see
`docs/fr-os/dns-email-authentication.md`).

Paths: invites · password reset · prospectus delivery · application
acknowledgement.

**If no provider is configured:** build every email path completely, log the
intended payload to the database instead of sending, keep lead creation
successful, and report it as an open gap. Never fall back to `mailto:`. Email
failure must never prevent lead creation.

---

## §19 · UI / UX

A lean operating system. Prioritise clarity, speed, readability, data
density, fast action.

Do **not** build: giant heroes, decorative dashboard graphics, excessive
cards, unnecessary animation, giant whitespace, fake AI interfaces.

**Minimum interface text: 13px.** Do not sacrifice readability for density.

Responsive: desktop full; tablet fully functional; mobile must support add
lead, view lead, update status, add note, schedule follow-up, view target,
view commission. Do not force the desktop layout onto mobile.

---

## §20 · OUT OF SCOPE — DO NOT BUILD

Content/CMS module (keep architecture extensible only) · accounting ·
invoicing · payroll · HR · full email client · telephony · marketing
automation · social media · AI chatbot · generic project management ·
generic enterprise CRM features.

Do not redesign the public microsite. Do not recreate
`/forum/dubai-summit` or `/forums/financial-rails-mena`.

---

## §21 · BUILD ORDER (implementation boundaries, not releases)

```
 1 People / Companies          9 Dashboards
 2 Opportunities / Workstreams 10 Targets
 3 Manual Lead Creation        11 Commission
 4 Assignment / Ownership      12 Forecast
 5 Activities / Follow-ups     13 Productivity
 6 Website Integration         14 Audit / Export / Erasure
 7 Pipelines                   15 Final UX polish
 8 Search / Filters            16 Full verification
```

At each boundary: re-read this file and `FR-OS-BUILD-LOG.md`, inspect what
exists, implement, typecheck, lint, run permission tests, run functional
tests, commit, append to the build log, continue.

**A failing permission / RLS / scope / authorization test HALTS the run.**
Report and wait. Functional failures are fixed in place and the build
continues.

---

## §22 · COMPLETION CRITERIA

Not complete because it compiles, renders, or the database exists. Complete
when the real workflows work end to end, and:

```
NO DUPLICATE PEOPLE.   NO HIDDEN LEADS.        NO BROKEN PERMISSIONS.
NO FAKE DATA.          NO FAKE INTELLIGENCE.   NO GENERIC CRM BLOAT.
```

---

## §R · RECONCILIATIONS MADE DURING RECONSTRUCTION

**R1 — Pipeline stages.** The stages seeded at Gate 2
(`drizzle/0002_seed_pipeline_reference.sql`) were derived from the Gate 1
summary and do **not** match the authoritative lists in §4. Divergences:

| Function | Seeded at Gate 2 | §4 (authoritative) |
|---|---|---|
| Sponsor | …qualified, proposal, negotiation, **verbal**, won… | …qualified, **meeting**, proposal, negotiation, won… |
| Delegate | new, contacted, **qualified, invited, registered**, declined, **cancelled** | new, contacted, **interested, application, confirmed, attended**, declined, **lost** |
| Speaker | **new**, contacted, **qualified**, invited, confirmed, declined, **cancelled** | **research**, contacted, **interested**, invited, confirmed, declined, **withdrawn** |

**Resolution:** §4 wins. A migration replaces the seeded reference data. Safe
to replace outright because the database holds zero opportunities — verified
at Gate 2 and re-verified before the migration ran.

**R2 — CANCELLED scope.** Gate 2 seeded a `cancelled` stage for all three
functions. §46.3 states CANCELLED is a **sponsor** stage. **Resolution:**
§46.3 wins; delegate and speaker lose `cancelled` and gain the terminal
states named in §4.

**R3 — Loss reasons.** Gate 2 seeded invented keys. §14 gives the
authoritative sets. **Resolution:** §14 wins; the seed is replaced.

**R4 — Cancellation reasons are a new concept** not present in the Gate 1
data model. **Resolution:** modelled as a distinct reference set rather than
overloading `loss_reasons`, because a cancellation is not a loss and the two
must never be aggregated together in win-rate reporting.
