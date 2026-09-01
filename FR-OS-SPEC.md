# FINANCIAL RAILS OS — BUILD SPECIFICATION

**Status:** approved · Gate 1 passed · Gate 2 passed (`4b9b1d5`) · decisions D1–D7 locked
**Platform:** financialrails.org · Supabase + Vercel + TanStack Start + Drizzle

> **PROVENANCE.**
> This file did not exist in the repository until the final build execution
> began; the specification lived in the approving conversation only. It is
> reconstructed from the Gate 1 stack-and-data-model approval, the Gate 2
> outcomes verified against the live Supabase project, and the final build
> order. Section numbering is this document's own and is authoritative —
> references to the numbering of the original conversation have been removed.
> Reconstruction conflicts are recorded in §R; the rulings that settled them
> are in §D. Nothing here is invented.

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
- **No spec/code mismatch.** A capability described here must be implemented,
  not merely described. If it is deferred, this document says so explicitly.

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

### Identity keys — what may decide that two records are the same

| Entity | Identity key | Never an identity key |
|---|---|---|
| Person | `person_emails.email`, unique on `lower(email)` | name, normalized name |
| Company | `company_domains.domain`, unique on `lower(domain)` | name, normalized name |

**D7 — NAME NORMALISATION IS A CANDIDATE HEURISTIC ONLY.** Suffix stripping
(`Ltd`, `AG`, `Bank`, `Holdings`, …) exists to *surface a candidate for a human
to look at*. It must **never** silently attach one record to another, and it
must **never** act as the identity key. Every name-only match requires explicit
human confirmation.

Free mail hosts (`gmail.com`, `outlook.com`, …) are rejected as company
identity: one such domain row would merge every unrelated freelancer into a
single "company".

### Matching confidence

| Confidence | Basis | Behaviour |
|---|---|---|
| `certain` | email / domain exact | attaches automatically |
| `strong` | name match at the same company | **refuses**, returns candidates |
| `possible` | name match anywhere, or similar name | shown, never blocking |

**Duplicate prevention must work on real data.** Before any manual creation,
search and show probable matches. Never silently create a duplicate.

When a record is created despite name candidates existing — which happens on
the unattended website path, where no human is present to confirm — it is
**flagged for review** and surfaced in a possible-duplicates queue. Creating
something a human will later reconcile is acceptable; creating it invisibly is
not.

### Merge — D6, genuinely implemented

- Reversible for **30 days**, and the reversal is **implemented**, not merely
  described.
- Nothing is deleted. The loser keeps its row, gains `merged_into_id`, and
  stops surfacing as a match.
- Every repointed foreign key is captured in the `merges` snapshot so the
  reversal is exact rather than approximate.
- Both people and companies can be merged and un-merged.
- Merging is Super Admin or Admin only. Every merge and reversal is audited.

Erasure (§15) is the single audited exception to "never delete".

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

| Stage | Probability | Outcome flag |
|---|---|---|
| NEW | 5% | open |
| CONTACTED | 10% | open |
| QUALIFIED | 25% | open |
| MEETING | 40% | open |
| PROPOSAL | 60% | open |
| NEGOTIATION | 80% | open |
| WON | 100% | won |
| LOST | 0% | lost |
| CANCELLED | 0% | cancelled |

**D3 — the ladder above is locked.** Carries: estimated value, final value,
probability, owner, event, next action, loss reason.
**A WON sponsor opportunity MUST have `final_value`.**

### DELEGATE
```
NEW · CONTACTED · INTERESTED · APPLICATION · CONFIRMED · ATTENDED
DECLINED · LOST
```

**D2 — target achievement is CONFIRMED.** ATTENDED is a **separate operational
KPI** and creates no additional target achievement. A delegate who moves
CONFIRMED → ATTENDED remains one achievement, never two, and never zero.
Counts, not money. No commission in V1.

### SPEAKER
```
RESEARCH · CONTACTED · INTERESTED · INVITED · CONFIRMED
DECLINED · WITHDRAWN
```

**D4 — WITHDRAWN IS NOT A LOSS.** It is an attrition outcome:

- it **reduces the current confirmed-speaker count**
- it feeds a **withdrawal / attrition metric**
- it **does not** contaminate speaker loss or conversion rates

DECLINED is a loss (they never confirmed). WITHDRAWN is attrition (they
confirmed, then left). Aggregating the two would misreport both.
Count-based targets. No commission in V1.

### Outcome flags on `pipeline_stages`

| Flag | Meaning |
|---|---|
| `is_open` | still being worked; appears in follow-up queues and weighted pipeline |
| `is_won` | **the conversion event**. Stamps `won_at`. Drives target achievement |
| `is_lost` | lost before converting. Drives loss and conversion rates |
| `is_cancelled` | a WON deal undone. Sponsor only |
| `is_attendance` | fulfilled after converting — delegate ATTENDED |
| `is_attrition` | withdrew after converting — speaker WITHDRAWN |

**Achievement is computed as `won_at IS NOT NULL AND NOT current stage
is_attrition`.** That is what makes D2 and D4 both true at once: ATTENDED
preserves the achievement it followed, WITHDRAWN removes it.

### Transition rules

- **CANCELLED is a SPONSOR stage only.**
- CANCELLED is reachable **only from WON**.
- An opportunity that was never WON becomes **LOST**, not CANCELLED.
- **WON is terminal for SPONSOR only.** For delegate and speaker the
  conversion stage has legitimate successors — CONFIRMED → ATTENDED,
  CONFIRMED → WITHDRAWN — and blocking them would make D2 and D4
  unreachable.
- Sponsor WON may move only to CANCELLED.
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

Terminal LOST without a reason is not permitted. WITHDRAWN takes a
**withdrawal reason**, not a loss reason — see D4.

---

## §5 · MANUAL LEAD CREATION — FIRST CLASS

Every Team Member has `+ ADD LEAD`. Fields: person name, company, job title,
email, phone, country, function (multiple allowed), event/edition, lead
source, notes. Records `created_by` / `created_at` automatically. Runs
duplicate matching before saving, and a name-only company match is offered as
a candidate the operator confirms — never applied silently (D7).
**Manual leads appear to Super Admin immediately.**

---

## §6 · WEBSITE LEADS — REAL INTEGRATION

The public microsite is live at `/forums/mena`.

| Form | Creates |
|---|---|
| REQUEST THE PROSPECTUS | Sponsor opportunity · source WEBSITE · NEW · owner UNASSIGNED |
| APPLY TO ATTEND | Delegate opportunity · source WEBSITE · NEW · owner UNASSIGNED |

**D5 — THE TARGET EDITION IS AN EXPLICIT SERVER-CONTROLLED MAPPING.** The
intake must never pick an edition by "whichever is currently active". Each
public form declares an intake key; the server resolves that key to exactly one
edition through `editions.public_intake_key`. `/forums/mena` maps to **MENA
2026**. A future edition form must be given its own key and its own explicit
mapping. An unmapped key is refused — and the raw submission is still stored.

Required: server-side validation, rate limiting, spam protection, duplicate
matching, **raw submission preserved verbatim**. The submission must be stored
even if outbound email fails. No `mailto:`. No fake backend behaviour.

---

## §7 · OWNERSHIP AND ASSIGNMENT

Ownership is **per workstream**. Super Admin assigns anything; Admin only
inside permitted scope; Team Members never reassign. Every assignment change
is audited.

An owner must hold the function they are being given. Assigning sponsor work
to a delegate-only Team Member would make the record owned and invisible at
once — a hidden lead by construction.

---

## §8 · ACTIVITY AND NEXT ACTIONS

Types: CALL · EMAIL · MEETING · FOLLOW-UP · NOTE · PROPOSAL · STATUS CHANGE ·
ASSIGNMENT · OTHER. Each stores user, timestamp, type, notes. **Append-only —
activity history cannot be silently deleted.** `status_change` and `assignment`
are written by the system and cannot be logged by hand.

Every active opportunity carries NEXT ACTION + DUE DATE. Surface overdue, due
today, upcoming.

---

## §9 · TARGETS

Super Admin sets targets by event · edition · function · team member · period.
Sponsor targets are monetary; delegate and speaker targets are counts. Team
Members see only targets for their permitted functions.

Achievement follows §4: `won_at IS NOT NULL AND NOT is_attrition`. Delegate
ATTENDED and speaker WITHDRAWN are reported as their own metrics beside the
target, never folded into it.

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

Weighted pipeline = `value × probability`, using the §4 sponsor ladder, with an
opportunity-level override that is recorded (`probability_overridden`).

Label the result **FORECAST**. Never call it guaranteed revenue.

---

## §12 · PRODUCTIVITY AND INSIGHTS

Dashboards answer: *What do I need to do? How am I doing? What can I still
achieve? What can I earn?*

Metrics computed from actual data only: contact rate, response rate, meeting
rate, proposal rate, close rate, average deal size, rejection rate, time to
close, pipeline velocity, **speaker attrition rate**, **delegate attendance
rate**. Where the sample is too small, display **NOT ENOUGH DATA**. No
fabricated statistics, no fake predictive certainty.

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

## §15 · DATA ERASURE

Super Admin only. Clears personal fields on a person, preserves the commercial
history in anonymised form, and records what was cleared — field **names**
only, never the values, which would defeat the purpose.

Never silently delete commercial records. This is the one audited exception to
"never delete".

---

## §16 · EVENT MEMORY / RENEWAL

Person and company history persists across editions. A WON sponsor
opportunity can be **cloned into a new edition** at the entry stage with a new
owner, via `cloned_from_id`. The historical opportunity is preserved
untouched.

---

## §17 · AUDIT

Audit lead creation, assignment, reassignment, status changes, owner changes,
target changes, commission changes, commission reversal, merge, **merge
reversal**, renewal and erasure. Show WHO · WHEN · WHAT CHANGED.
**No silent changes.**

---

## §18 · SECURITY (built and verified at Gate 2)

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

## §19 · EMAIL

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

## §20 · UI / UX

A lean operating system. Prioritise clarity, speed, readability, data
density, fast action.

Do **not** build: giant heroes, decorative dashboard graphics, excessive
cards, unnecessary animation, giant whitespace, fake AI interfaces.

**Minimum interface text: 13px.** Do not sacrifice readability for density.

Responsive: desktop full; tablet fully functional; mobile must support add
lead, view lead, update status, add note, schedule follow-up, view target,
view commission. Do not force the desktop layout onto mobile.

---

## §21 · OUT OF SCOPE — DO NOT BUILD

Content/CMS module (keep architecture extensible only) · accounting ·
invoicing · payroll · HR · full email client · telephony · marketing
automation · social media · AI chatbot · generic project management ·
generic enterprise CRM features.

Do not redesign the public microsite. Do not recreate
`/forum/dubai-summit` or `/forums/financial-rails-mena`.

---

## §22 · BUILD ORDER (implementation boundaries, not releases)

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

## §23 · COMPLETION CRITERIA

Not complete because it compiles, renders, or the database exists. Complete
when the real workflows work end to end, and:

```
NO DUPLICATE PEOPLE.   NO HIDDEN LEADS.        NO BROKEN PERMISSIONS.
NO FAKE DATA.          NO FAKE INTELLIGENCE.   NO GENERIC CRM BLOAT.
NO SPEC/CODE MISMATCH.
```

---

## §D · LOCKED DECISIONS

Final. Each was a judgment call surfaced during spec reconstruction and ruled
on explicitly.

| # | Decision |
|---|---|
| **D1** | This document's section numbering is authoritative. References to the original conversation's numbering are removed. |
| **D2** | Delegate target achievement is **CONFIRMED**. ATTENDED is a separate operational KPI and creates no additional achievement. |
| **D3** | The sponsor probability ladder is locked: 5 · 10 · 25 · 40 · 60 · 80 · 100. |
| **D4** | Speaker **WITHDRAWN is not a loss.** It is attrition: it reduces the confirmed-speaker count and feeds a withdrawal metric, without contaminating loss or conversion rates. |
| **D5** | Website intake resolves its edition through an **explicit server-controlled mapping**, never by "whichever edition is active". `/forums/mena` → MENA 2026. |
| **D6** | Merge reversal is **genuinely implemented**, in the People / Companies boundary. No spec/code mismatch. |
| **D7** | Company-name normalisation is a **candidate heuristic only** — never an identity key, always requiring human confirmation. Documented and tested. |

---

## §R · RECONCILIATIONS MADE DURING RECONSTRUCTION

**R1 — Pipeline stages.** The stages seeded at Gate 2
(`drizzle/0002_seed_pipeline_reference.sql`) were derived from the Gate 1
summary and did not match the authoritative lists in §4.

| Function | Seeded at Gate 2 | §4 (authoritative) |
|---|---|---|
| Sponsor | …qualified, proposal, negotiation, **verbal**, won… | …qualified, **meeting**, proposal, negotiation, won… |
| Delegate | new, contacted, **qualified, invited, registered**, declined, **cancelled** | new, contacted, **interested, application, confirmed, attended**, declined, **lost** |
| Speaker | **new**, contacted, **qualified**, invited, confirmed, declined, **cancelled** | **research**, contacted, **interested**, invited, confirmed, declined, **withdrawn** |

**Resolution:** §4 wins. Replaced in `drizzle/0005`. Safe to replace outright
because the database held zero opportunities — guarded by a `RAISE EXCEPTION`
that refuses to run against live pipeline data.

**R2 — CANCELLED scope.** Gate 2 seeded `cancelled` for all three functions.
**Resolution:** sponsor only; delegate and speaker gained the terminal states
named in §4.

**R3 — Loss reasons.** Gate 2 seeded invented keys. **Resolution:** §4's sets
replaced them.

**R4 — Cancellation reasons.** A concept absent from the Gate 1 data model.
**Resolution:** modelled as a distinct reference set rather than overloading
`loss_reasons`, because a cancellation is not a loss and the two must never be
aggregated in win-rate reporting. The same reasoning later produced the
separate `is_attrition` outcome for D4.

**R5 — `opportunities_won_requires_final_value`** was approved at Gate 2 and
had never been implemented. Added in `drizzle/0004`, sponsor only.
