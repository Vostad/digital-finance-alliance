# FINANCIAL RAILS OS — BUILD LOG

Append-only record of the final build execution. One entry per boundary in
`FR-OS-SPEC.md` §21. Read this and the spec at the start of every boundary.

**Standing state**

| | |
|---|---|
| Branch | `v4-microsite` |
| Gate 1 | approved |
| Gate 2 | passed — `4b9b1d5` |
| Route consolidation | complete — `2bb8961` |
| Database | live Supabase, migrated, RLS default-deny verified |
| Commercial rows | **zero** — nothing seeded, nothing invented |

**Verification commands**

```
npm test                 # unit — no database, no network
npm run test:integration # live database, everything inside a rolled-back transaction
npm run verify:db        # RLS + anon-key + reference-data audit against the live project
npm run build            # production build + service-role leak check
```

---

## Boundary 0 · Reference data reconciliation and terminal-state constraints

**Commit:** `76c7d37`

**Why this boundary exists.** It is not in §21. It was forced by inspection:
the pipeline stages and loss reasons seeded at Gate 2 did not match the
authoritative lists in the approved spec, and two approved constraints had
never been implemented. Building pipelines on top of wrong stage keys would
have meant rewriting every downstream module.

**Built**

- `FR-OS-SPEC.md` — the spec did not exist on disk. Reconstructed from the
  approved Gate 1 model, the Gate 2 outcomes, and the final build order.
  Provenance and every reconciliation recorded in it (§R).
- `FR-OS-BUILD-LOG.md` — this file.
- **Migration `0004`** — `cancellation_reasons` table; `opportunities
  .cancellation_reason_key`; three CHECK constraints.
- **Migration `0005`** — replaces pipeline stages and loss reasons with the
  authoritative sets; seeds cancellation reasons; RLS on the new table.
- `scripts/verify-database.mjs` + `npm run verify:db` — repeatable live audit,
  promoted from a throwaway. Reused for the §41 final security audit.

**Corrections to previously reported work — stated plainly**

1. **`opportunities_won_requires_final_value` was never implemented.** It was
   approved at Gate 2 as addition 2 and my Gate 2 report implied it was in
   place. It was not. Added in `0004`, sponsor-only, and now enforced by the
   database.
2. **Seeded reference data contradicted the spec.** Sponsor had `verbal`
   instead of `meeting`; delegate and speaker had entirely wrong terminal
   states; `cancelled` existed for all three functions when §46.3 makes it
   sponsor-only. Replaced in `0005`. Safe because the database held zero
   opportunities — guarded by a `RAISE EXCEPTION` if ever replayed onto live
   pipeline data.

**Constraints now enforced by Postgres, not by hope**

| Constraint | Rule |
|---|---|
| `opportunities_won_requires_final_value` | a WON **sponsor** deal must carry `final_value` |
| `opportunities_lost_requires_reason` | `lost` / `declined` / `withdrawn` require a loss reason |
| `opportunities_cancelled_requires_reason` | `cancelled` requires a cancellation reason |

**Stage lists now live in the database** — sponsor 9, delegate 8, speaker 7,
exactly as `FR-OS-SPEC.md` §4. Sponsor probability ladder unchanged from Gate 1
(5/10/25/40/60/80/100/0), re-applied to the authoritative stage names.

**Tests**

| | |
|---|---|
| `npm test` | 83 passed |
| `npm run test:integration` | 18 passed |
| `npm run verify:db` | all passed — 24 tables RLS on, 0 policies, 0 grants, anon denied on 8/8 |
| `tsc --noEmit` | clean |

**Deferred:** nothing.

**Next:** Boundary 1 — People / Companies.

---

## Boundary 1 · People / Companies

**Commit:** `35a7de9`

**Built**

- `src/server/domain/identity.ts` — normalisation primitives. Accent folding,
  punctuation stripping, legal-suffix stripping, consumer-mail-host detection,
  graded match confidence (`certain` / `strong` / `possible`).
- `src/server/domain/audit.ts` — `recordAudit` and `diff`. Takes a transaction,
  so a change and the audit row describing it commit together or not at all.
- `src/server/domain/directory.ts` — matching, find-or-create, merge, search.
- `src/server/auth/scoped.ts` — added `directory` (the handle for the
  deliberately unscoped tables) and the exported `Tx` transaction type, so
  domain modules never import `db` directly and the eslint boundary holds.

**Duplicate prevention rests on three layers, all of them needed**

| Layer | What it catches |
|---|---|
| Unique index on `lower(email)` | two people clicking Save at the same instant |
| `findPersonMatches` / `findCompanyMatches` | the same person typed differently |
| Search-before-create in the UI (§5) | the operator who would not have looked |

Check-then-insert alone is a race. A unique index alone gives the user a
database error instead of "here they are". The write path catches `23505` and
re-reads, so the loser of a concurrent insert receives the winner's record.

**Decisions worth recording**

- `bank` is a stripped company suffix. `ABC Bank` and `ABC` therefore collapse
  to one match key. Intended for this market, where the same institution is
  written both ways constantly — and it produces a *candidate*, never an
  automatic merge.
- Suffix stripping never reduces a name to nothing, so a company genuinely
  called `AG` keeps an identity instead of colliding with every other
  suffix-only name.
- A `certain` match (email) returns the existing person rather than raising —
  that is the answer the caller wanted. A `strong` match raises
  `DuplicateError` carrying the candidates, and a human resolves it with
  `acceptMatchId`. There is deliberately no "create anyway" for `certain`.
- Merge never deletes: the source keeps its row, gains `merged_into_id`, and
  stops surfacing as a match.

**Tests** — 103 unit (20 new in `identity.test.ts`), 38 integration (20 new in
`integration/directory.test.ts`), covering §39 scenarios 7, 22, 23, 24 and the
concurrent-duplicate case.

| | |
|---|---|
| `npm test` | 103 passed |
| `npm run test:integration` | 38 passed |
| `npm run verify:db` | all passed |
| `tsc --noEmit` | clean |

**One functional test failure, fixed in place** (§46.2): a company-count
assertion sampled at the wrong moment in the fixture. Expectation corrected;
no code defect.

**Deferred to later boundaries:** merge reversal UI and the 30-day window
(the snapshot and audit row are written; the reverse action lands with Audit,
Boundary 14). People/company screens land with Dashboards, Boundary 9.

**Next:** Boundary 2 — Opportunities / Workstreams.

---

## Boundary 2 · Opportunities / Workstreams

**Commit:** `5558c71`

**Built**

- `src/server/domain/pipeline.ts` — stages, loss reasons and cancellation
  reasons read from the database and cached for 60s. Nothing about the ladder
  is compiled into the bundle: an operator may tune a stage probability (§4),
  and a hardcoded copy would silently disagree with the forecast.
- `src/server/domain/pipeline.ts` → `transitionError(fn, from, to)` — §46.3 in
  ONE pure function, so the API, the UI and the tests cannot drift apart.
- `src/server/domain/opportunities.ts` — create, change stage, load-for-write,
  filtered list, clone-into-edition.
- `src/server/test/integration/fixture.ts` — the shared live fixture. Users,
  events, editions, scopes; everything inside a rolled-back transaction.
  Reused by every boundary from here.

**Rules now enforced on the server, before the database sees the write**

| Rule | Behaviour |
|---|---|
| WON sponsor needs `final_value` | refused with a sentence naming what to supply |
| WON is terminal | cannot move backwards, cannot become LOST |
| CANCELLED only from WON | and refused entirely for delegate and speaker |
| CANCELLED needs a reason | refused without one |
| LOST needs a reason | refused without one |
| CANCELLED does not block a retry | a new sponsor workstream opens normally |

The CHECK constraints from Boundary 0 sit behind all of this. They are not
redundant — they are what holds if a future code path forgets to come through
`changeStage`.

**Decisions worth recording**

- A second **open** workstream for the same person, edition and function is
  refused; a closed one never blocks a retry. Two people working the same live
  deal without knowing it is the failure being prevented — not a person
  returning next year.
- Not-found and not-permitted answer identically in `loadForWrite`.
  Distinguishing them tells an unauthorised caller which ids exist.
- Moving back into an open stage clears `loss_reason_key` and `lost_at`, so a
  reopened deal cannot carry a stale loss reason into reporting.
- A renewal clone starts at the **entry** stage, carries the previous final
  value as the new estimate, and records `cloned_from_id`. The historical
  opportunity is untouched.
- `scopedQuery.directory` is now typed as connection-or-transaction, which is
  what lets the integration fixture substitute a transaction.

**Tests** — 124 unit (21 new in `transitions.test.ts`), 64 integration
(26 new in `integration/opportunities.test.ts`). §39 scenarios 1, 6, 7, 8, 12,
13, 17, 19 covered.

| | |
|---|---|
| `npm test` | 124 passed |
| `npm run test:integration` | 64 passed |
| `tsc --noEmit` | clean |

**One functional test failure, fixed in place** (§46.2): a status-change count
off by one — I had counted a refused transition as if it wrote a row. It does
not, and the corrected assertion now proves that refused transitions leave no
trace at all.

**Deferred:** assignment lands in Boundary 4, activities in Boundary 5, the
commission reversal that CANCELLED must trigger in Boundary 11 (the stage
machine already returns `cancelledCommission` for it to hook).

**Next:** Boundary 3 — Manual Lead Creation.

---

## Boundary 3 · Manual Lead Creation

**Commit:** `62891ff`

**Built**

- `src/server/domain/leads.ts` — `previewLead` (matching before save),
  `createLead` (company → person → one workstream per function),
  `otherWorkstreams` (§13), `permittedEditions`.
- `src/rpc/leads.ts` — the authenticated RPC surface. Every handler begins with
  `requireAuth()`; domain errors reach the client, internal ones are logged and
  replaced.

**The order is the design: company, then person, then workstreams.** Each step
feeds the next — the email's domain identifies the company, the company
sharpens the person match — and all of it happens before a single opportunity
row exists, so a duplicate is caught while there is nothing to unwind.

**Server-side authorization, proved live**

| Attempt | Result |
|---|---|
| Team Member opens a function they do not hold | refused — *"You are not assigned to speaker work."* |
| Admin files against an edition outside their scope | refused — *"outside the events you manage"* |
| Admin files inside their scope | permitted |
| Team Member lists workstreams | sees only their own |

**Decisions worth recording**

- Re-submitting when **every** requested function already has an open
  workstream **raises**, naming the remedy. A silent no-op reads as success and
  the operator walks away believing they filed something.
- A **mix** of new and existing opens the new ones and reports the skips in
  `skippedFunctions` — never swallowed.
- A different edition is a different workstream. Event memory means the same
  person legitimately carries five workstreams across two editions.
- Existing people are **backfilled**, not overwritten wholesale: a second
  submission often carries the phone number the first lacked.
- §13's projection is enforced in the query, not the UI. `otherWorkstreams`
  returns exactly `id`, `function`, `stageKey`, `ownerId`, `editionId` — the
  test asserts that key list, so adding `finalValue` to it fails the build.

**Tests** — 124 unit, 86 integration (22 new in `integration/leads.test.ts`).
§39 scenarios 1, 2, 6, 7, 9, 10, 11, 23, 26, 28 covered.

| | |
|---|---|
| `npm test` | 124 passed |
| `npm run test:integration` | 86 passed |
| `tsc --noEmit` | clean |

**Three functional test failures, fixed in place** (§46.2) — all three were my
expectations, not defects: an all-functions-already-open case I expected to
return when it correctly raises, and two counts that ignored a fixture I had
just added.

**Deferred:** the `+ ADD LEAD` screen itself lands with Dashboards, Boundary 9,
where the admin shell exists to host it.

**Next:** Boundary 4 — Assignment / Ownership.

---

## Boundary 4 · Assignment / Ownership

**Commit:** `0a5e75c`

**Built** — `src/server/domain/assignment.ts`: `assignOwner`, `setSplit`,
`assignMany`, `assignableUsers`.

**The property proved:** ownership is per workstream. One person, three
functions, three different owners, and each owner sees exactly one record.

**Decisions worth recording**

- **An owner must be able to do the work.** A sponsor deal cannot be assigned
  to a delegate-only Team Member. Their dashboard is built to show only their
  permitted functions, so such a deal would be owned and invisible at the same
  time — the definition of a hidden lead. The same rule filters
  `assignableUsers`, so the impossible assignment is never offered.
- A deactivated account cannot be given work.
- Unassigning to `NULL` is legitimate and returns the record to the Super Admin
  inbox. NULL is a state, not a gap.
- **Bulk assignment checks every record individually.** It is a convenience for
  the operator, never a way around the per-record permission check — the test
  hands an Admin one in-scope and one out-of-scope id and asserts one assigned,
  one refused.
- The commission split is stored on the opportunity and copied onto the ledger
  entry at WON, so changing it later cannot reach backwards into money already
  earned. The database enforces the two shares total 100.

**Tests** — 101 integration (15 new), passing first run. §39 scenarios 3, 8,
25, 26 covered.

| | |
|---|---|
| `npm test` | 124 passed |
| `npm run test:integration` | 101 passed |
| `tsc --noEmit` | clean |

**Next:** Boundary 5 — Activities / Follow-ups.

---

## Boundary 5 · Activities / Follow-ups

**Commit:** `6f4d04f`

**Built** — `src/server/domain/activities.ts`: `logActivity`, `setNextAction`,
`timeline`, `followUps`, `attentionNeeded`.

**Append-only by construction.** The module exposes no update path and no
delete path, and a test asserts that by inspecting its own exports — "activity
history cannot be silently deleted" is only true if the code offers no way to
do it. A correction is a new entry, the way a ledger is corrected.

**Decisions worth recording**

- `status_change` and `assignment` **cannot be logged by hand.** They are
  written by the system as a side effect of the real action; letting someone
  type one would let them fabricate a stage history.
- Nothing can be recorded as having happened in the future.
- `occurred_at` is separate from `created_at`, and the timeline orders by
  `occurred_at`. You log yesterday's call today; a timeline that pretends it
  happened at the moment of typing makes response-time metrics meaningless.
- Logging an activity and setting the next action happen in **one transaction**,
  so the follow-up queue cannot be left honest-looking by a half-completed
  two-step.
- The follow-up queue excludes closed work by testing the stage's own `is_open`
  flag in SQL, not by a hardcoded list of stage keys that would rot the next
  time a stage is added.
- Day boundaries are computed in UTC. Rendering into the user's zone is the
  UI's job; the boundary must not move depending on which server answered.

**Tests** — 119 integration (18 new). §39 scenarios 4, 5, 9, 25 covered.

| | |
|---|---|
| `npm test` | 124 passed |
| `npm run test:integration` | 119 passed |
| `tsc --noEmit` | clean |

**Two defects found and fixed** (both mine, both real):

1. **A `Date` in a raw `sql` template reaches the driver unserialisable.** The
   typed column comparisons were fine — the column tells the driver what it is
   — but the bucketing `CASE` had no column to infer from. Now cast explicitly
   as `${d.toISOString()}::timestamptz`.
2. **The shared fixture declared Team Member functions in the context but never
   wrote the `user_functions` rows.** Boundary 4 refuses an owner who does not
   hold the function, so the mismatch surfaced as what looked like a code
   defect. The fixture now writes rows that match the contexts it hands out.

**Four test expectations corrected** — the timeline legitimately includes
system-written `assignment` rows (§9 lists it as an activity type), and orders
by `occurred_at`, so a meeting logged last but dated yesterday sorts last.

**Next:** Boundary 6 — Website Integration.

---

## Boundary 6 · Website Integration

**Commit:** `91758d8`

**Built**

- Migrations `0006`/`0007` — `email_outbox` table, RLS enabled, grants revoked.
- Migration `0008` — the event calendar. **Configuration, not commercial
  history**: every value is a published fact from the live public site (MENA,
  Dubai, 18–19 November 2026). No person, company, opportunity, target or
  commission row is seeded anywhere in this repository.
- `src/server/domain/email.ts` — the outbox. Write the intent, then send.
- `src/server/domain/intake.ts` — the public intake pipeline.
- `src/rpc/intake.ts` — **the only server function with no `requireAuth()`**.
- `src/lib/dubai-summit.ts` — `submitLead` now posts to the OS. The `mailto`-
  free TODO stub is gone.
- `src/components/site/DubaiSummit.tsx` — honeypot field, real error state,
  busy state, and the modal-open timestamp for the timing guard. **No visual
  change to the microsite** beyond an error line that only renders on failure.

**The order is the guarantee**

1. raw submission recorded **verbatim, always**
2. then match, resolve, open the workstream
3. then queue the acknowledgement — failure swallowed

Step 1 first because §6 requires the raw submission preserved even when the
rest fails: a form filled in and then lost to a transient error is a lost
customer nobody knows about. Step 3 last and non-fatal because §46.5 says
email must never prevent lead creation.

**Verified end to end through the real browser**, not just by unit test:

```
public form at /forums/mena
  → form_submissions   prospectus | processed | ip hashed | person linked
  → opportunities      sponsor / new / owner UNASSIGNED / source website / MENA 2026
  → email_outbox       prospectus_delivery → …  | sent: NOT SENT (no provider)
```

The verification person, company, workstream, submission and outbox row were
then **deleted**; `verify:db` re-run clean, zero commercial rows.

**Decisions worth recording**

- A spam rejection returns **the same response a success returns**. Telling a
  bot it was detected teaches whoever wrote it what to change.
- Rate limiting counts rows in the database, not in process memory. Serverless
  functions are many and short-lived; an in-process counter resets on every
  cold start and limits nothing.
- The IP is **hashed**, never stored raw. A rate limit must recognise a repeat
  visitor; it does not need to know who they are, and a raw IP is personal data
  §31 would then owe an answer about.
- The synthetic system actor has **no user id** — `created_by` is null on a
  website submission, because no user acted and pretending one did is worse
  than the gap.
- A repeated submission still stores the raw payload and marks the submission
  `failed` when the workstream is already open, so a human can see exactly what
  arrived.

**Tests** — 125 unit, 140 integration (21 new). §39 scenarios 20, 21, 22 and
repeated-submission covered. Passed first run.

| | |
|---|---|
| `npm test` | 125 passed |
| `npm run test:integration` | 140 passed |
| `npm run verify:db` | all passed |
| `npm run build` | exit 0 — 53 client files, no secrets |
| client bundle | 0 hits for postgres / drizzle / service_role / pooler |

**OPEN GAP — EMAIL (§46.5).** No transactional provider is configured. Every
email path is built and every message is written to `email_outbox`; nothing is
sent, and `outboxSummary` reports `providerConfigured: false` honestly. To
close it: publish the DNS in `docs/fr-os/dns-email-authentication.md`, set
`EMAIL_PROVIDER_API_KEY` and `EMAIL_FROM_ADDRESS`, and implement the provider
call in `drainOutbox`. Deliberately left unimplemented rather than stubbed to
look successful.

**Next:** Boundary 7 — Pipelines (largely delivered in Boundary 2; the
remaining work is the board and stage-move UI).

---

## Boundaries 1 / 2 / 6 · REVISION — locked decisions D1–D7

**Commit:** `76c0071`

Seven rulings were issued after reviewing the reconstructed spec. Five of them
contradicted code already shipped, so those boundaries were corrected before
Boundary 7 began rather than layering new work on wrong foundations.

| # | Decision | What changed |
|---|---|---|
| **D1** | Spec numbering is this document's own | `FR-OS-SPEC.md` rewritten; every `§46.3`-style reference removed; §15 Data Erasure added as its own section rather than a dangling cross-reference |
| **D2** | Delegate achievement is CONFIRMED | ATTENDED is no longer `is_won`; new `is_attendance` flag |
| **D3** | Sponsor ladder locked | already correct — no change |
| **D4** | Speaker WITHDRAWN is attrition, not loss | no longer `is_lost`; new `is_attrition` flag; withdrawal reasons seeded |
| **D5** | Explicit intake mapping | `editions.public_intake_key`, unique; the "whichever edition is active" guess is gone |
| **D6** | Merge reversal genuinely implemented | `mergeCompanies`, `reverseMerge`, `reversibleMerges`, real `merges` snapshots |
| **D7** | Name is a heuristic, never identity | a name match can no longer attach; `possibleDuplicate*` review queue |

**The achievement rule that makes D2 and D4 both true**

```
won_at IS NOT NULL  AND  the current stage is not is_attrition
```

Reading the **timestamp** rather than the current stage flag is the whole
trick. A delegate moving CONFIRMED → ATTENDED keeps the one achievement they
earned; a speaker moving CONFIRMED → WITHDRAWN loses it. A flag-only rule
cannot express both at once, and a naive `is_won` on ATTENDED would have made
achievement drop when a delegate actually turned up.

**D4 also forced a transition-rule correction.** "WON is terminal" had been
applied to all three functions. CONFIRMED is the won stage for delegate and
speaker too, so the rule made D2 and D4 literally unreachable. It is now
**sponsor-only**, with delegate and speaker permitted exactly the successors
§4 names.

**D6 — what the snapshot buys.** `merges.snapshot` records the ids of the rows
each merge actually moved. The reversal moves back precisely those. A reversal
that guessed "move every email back" would steal the survivor's own address the
first time two records genuinely shared one. The test asserts the survivor
keeps its own emails and the loser gets back exactly the one it arrived with.

**D7 — the heuristic still finds, it just cannot act.** `bank` remains a
stripped suffix, so `ABC Bank` and `ABC` still collide as *candidates*. The
test asserts they are created as **separate** companies, that the collision is
reported to the caller, that it appears in the review queue, that a name match
is never rated `certain`, and that a domain match still attaches instantly.

**Migrations** — `0009` (columns + unique index), `0010` (apply D2/D4/D5 to
reference data, guarded, with the invariants re-asserted in SQL so a later edit
reverting them fails the migration).

**Tests** — 136 unit (11 new for D2/D4 transitions), 166 integration (26 new in
`integration/merge.test.ts` for D6/D7).

| | |
|---|---|
| `npm test` | 136 passed |
| `npm run test:integration` | 166 passed |
| `npm run verify:db` | all passed |
| `npm run build` | exit 0 |

**Two functional test failures, fixed in place** — both were my expectations of
the company-merge counts. The corrected assertion is stronger: `abc` owns zero
domains *because* the human-confirmed domain attached to `abcBank`, so the zero
is evidence D7 worked.

**Next:** Boundary 7 — Pipelines.

---

## Boundary 7 · Pipelines

**Commit:** `26fb7e7`

**A data-integrity gap D4 opened, found and closed first.** Making WITHDRAWN
attrition rather than loss meant `changeStage` no longer set a reason for it —
while the `opportunities_lost_requires_reason` CHECK still demanded one. Moving
a speaker to WITHDRAWN would have failed with a raw constraint violation.

Fixed the way R4 settled the same question for cancellations: **a withdrawal
gets its own reason set and its own column.** `withdrawal_reasons` table,
`opportunities.withdrawal_reason_key`, its own CHECK, and `withdrawn` removed
from the loss CHECK. The four stopgap `withdrew_*` rows 0010 put into
`loss_reasons` are deleted — one careless `WHERE loss_reason_key IS NOT NULL`
would have counted a withdrawal as a loss.

**Built**

- Migrations `0011`/`0012` — withdrawal reasons, column, constraints, RLS.
- `src/server/domain/board.ts` — `pipelineBoard` and `conversionRates`.
- `src/server/domain/opportunities.ts` — attrition and attendance in the stage
  machine, with `withdrawn` / `attended` as their own audit actions.
- `src/rpc/leads.ts` — `board`, `rates`, `moveStage`, `setOwner`,
  `setCommissionSplit`, `owners`.

**Decisions worth recording**

- **One query per board, not one per column.** Nine round trips to draw one
  screen, with counts drifting between the first and the last if anyone is
  working — and every figure is aggregated *inside* the caller's scope, so the
  totals can never disagree with the rows beneath them.
- `totalValue` uses `coalesce(final, estimated)`. Summing only estimates would
  make the WON column read zero on a board where money has actually closed.
- Weighted pipeline uses the probability **on the opportunity**, not the stage
  default. An operator who overrode it meant the override, and a forecast
  quietly using the ladder instead would contradict the card.
- **`MIN_SAMPLE = 10`.** A close rate over four opportunities is noise
  presented as a percentage. Below the threshold the rate is `null` and the raw
  counts are still returned, so a screen can say NOT ENOUGH DATA and show why.
- **Attrition and attendance are measured against those who CONVERTED**, not
  against every opportunity opened. You cannot withdraw from something you
  never confirmed.

**The two tests that matter most**

| | Before | After | Meaning |
|---|---|---|---|
| Delegate achieved, then one ATTENDS | 2 | **2** | D2 — attending changes nothing |
| Speaker achieved, then one WITHDRAWS | 2 | **1** | D4 — attrition removes achievement |
| Speaker loss count, same withdrawal | 1 | **1** | D4 — and is *not* a loss |

Both numbers moving would misreport the loss rate and the attrition rate at
once, which is precisely what D4 exists to prevent.

**Tests** — 137 unit, 186 integration (20 new in `integration/pipeline.test.ts`).

| | |
|---|---|
| `npm test` | 137 passed |
| `npm run test:integration` | 186 passed |
| `npm run verify:db` | all passed |
| `npm run build` | exit 0 |

**One infrastructure fix:** the integration hook timeout was 30s and a fixture
opening twenty workstreams is sixty-odd round trips to a remote Supabase.
Raised to 180s — failing a suite for latency rather than for a defect teaches
the wrong lesson.

**Next:** Boundary 8 — Search / Filters.

---

## Boundary 8 · Search / Filters

**Commit:** `10fdb20`

**Built** — `src/server/domain/search.ts` (`globalSearch`), plus `search` and
`searchPeopleAndCompanies` on the RPC surface. Filters were delivered in
Boundary 2 as `opportunityFilterSql` and are exposed through `board`, `rates`
and `listWorkstreams`.

**One search box, three different permission rules underneath.** Applying one
rule to all three sections would break the system in one direction or the
other:

| Section | Rule | Why |
|---|---|---|
| People, companies | open to every active user | §2 — you cannot be told to find the existing person before creating one and also be prevented from seeing them |
| Opportunities | `q.where.opportunities()` | a Team Member searching a company finds their own workstreams, never a colleague's |
| Team members | projected per role | the Gate 2 ruling |

The user projection reuses `visibleUserFields` rather than reimplementing the
rule in SQL — one implementation instead of two that drift. An Admin searching
for a Super Admin gets **name and id and nothing else**; the test asserts email
and role come back `null`.

**Decisions worth recording**

- A one-character query returns nothing. It matches most of the database and
  produces a list nobody can read.
- Person search covers name, phone, **every** email on the record, and the
  employer's name — normalised on both sides, so `Zubeyde` finds `Zübeyde`.
- Company search covers name and **domain**, so pasting an email domain finds
  the institution.

**Tests** — 137 unit, 202 integration (16 new in `integration/search.test.ts`).
Passed first run.

| | |
|---|---|
| `npm test` | 137 passed |
| `npm run test:integration` | 202 passed |
| `tsc --noEmit` | clean |

**Next:** Boundary 9 — Dashboards. The first boundary with real UI: the admin
shell, the three role dashboards, and the `+ ADD LEAD` screen.

---

## Boundary 9 · Dashboards

**Commit:** `4e8b129`

**The first boundary with real UI.** Everything before this was operable only
through the RPC surface.

**Built**

- `src/server/domain/dashboard.ts` — `headline`, `suggestions`, `teamStanding`,
  and the assembled `dashboard` view.
- `src/rpc/dashboard.ts`, plus `workstream`, `logWork`, `board`, `rates`,
  `moveStage`, `setOwner` on the leads surface.
- `src/components/admin/primitives.tsx` — the complete UI vocabulary.
- `src/components/admin/Shell.tsx` — header, nav, content column.
- Routes: `/admin` (Today), `/admin/pipeline`, `/admin/leads`,
  `/admin/leads/new`, `/admin/leads/$id`.

**TWO PRODUCTION DEFECTS FOUND BY ACTUALLY OPENING THE APP.** Neither was
visible from code or from the test suite.

1. **`max: 1` on the connection pool wedged any page that fanned out.** The
   workstream detail issues eight queries in one `Promise.all`; over the
   transaction pooler they never completed and never errored — the page simply
   loaded forever. Each of the eight returned in ~100ms when run alone. Raised
   to `max: 5` and reduced the fan-out to two groups. My original comment
   claimed one connection per instance was the right shape; it was wrong the
   moment one request needed two queries at once.
2. **`fetch_types: false` was missing.** postgres.js introspects array types on
   first use, and the transaction pooler cancels that catalog query
   (`57014 query_canceled`). Found while diagnosing the above.

Both are runtime-only and would have shipped. **The integration suite passed
throughout** — because it runs inside an explicit transaction, which reserves a
connection and hides exactly this class of bug.

**§20 audit — measured, not eyeballed**

| | |
|---|---|
| Font sizes in the rendered admin | **13 · 14 · 17 · 22 · 26** |
| Anything below 13px | **none** |
| Page scrolls sideways at 390px | **no** (`bodyScrollWidth` 390 = viewport) |
| Wide content | contained in `overflow-x:auto` — nav and tables scroll, the page does not |

One readability fix from the audit: 85 elements sat at the 13px floor and one
above it. Dense, legal, and hard to scan. Table cells moved to 14px so labels
and meta sit one step below the data rather than beside it.

**Verified live at 1440 / 1024 / 390**, signed in as a Super Admin: dashboard,
pipeline board, leads list, workstream detail. **Mobile write path proved end
to end** — logged an activity and set a next action at 390px and read both back
out of the database.

One more fix from that: `router.invalidate()` was not awaited, so the timeline
did not refresh after logging. The write had succeeded; the screen just did not
say so.

**Decisions worth recording**

- A manager with no function selected defaults to **sponsor** — the only
  function carrying money. Leaving it null showed no rates at all, which reads
  as a broken panel rather than a deliberate absence.
- Suggestions carry the filter that produced them, so clicking one opens
  exactly the rows it counted rather than an approximation.
- Closed revenue **excludes cancelled**. A revenue figure counting money that
  was won and then collapsed is the most misleading number this system could
  print.
- No sidebar. Six destinations do not justify 15% of a laptop screen, and on
  mobile the nav scrolls horizontally rather than hiding behind a tap.

**Tests** — 137 unit, 202 integration.

| | |
|---|---|
| `npm test` | 137 passed |
| `npm run test:integration` | 202 passed |
| `npm run verify:db` | all passed |
| `npm run build` | exit 0, no secrets in 61 client files |

**Note on the suite's one assumption:** the integration tests assert a
commercially empty database. Seeding the DEMO fixture for the UX audit failed
29 of them on count assertions; removing it restored all 202. That is the
tests behaving correctly — but it means the suite cannot run against a database
holding real pipeline data.

**DEMO fixture** — two accounts and seven workstreams, every record prefixed
`DEMO`, created for the audit and **deleted**. Database back to zero
commercial rows, `verify:db` green.

**Next:** Boundary 10 — Targets.

---

## Boundary 10 · Targets

**Commit:** `a17e75f`

**Built**

- `src/server/domain/targets.ts` — `setTarget`, `updateTarget`,
  `targetProgress`, `targetableUsers`.
- `src/rpc/targets.ts`.
- `/admin/targets` — every row shows TARGET · ACHIEVED · REMAINING · PIPELINE ·
  FORECAST · PROGRESS, plus a "beside it" column carrying D2 attendance and D4
  withdrawals.
- `/admin/directory` — search, the D7 review queue, and the D6 un-merge. Both
  were implemented at Boundary 1 but unreachable; a capability the spec
  describes and no screen exposes is the mismatch D6 exists to forbid.

**The property the tests hold to:** every figure beside a target is measured
against the **same owner, function, edition and window the target names**. A
progress number computed over a different scope than the target it sits next to
is worse than no number.

**Decisions worth recording**

- A target always belongs to a person. There is no faceless event target —
  a number with nobody accountable for it is a wish, and the event roll-up is a
  sum over people who are.
- **Only a Super Admin sets or changes targets.** An Admin who could set their
  own team's numbers could set them low, and every progress figure in the
  system becomes unfalsifiable. `updateTarget` audits the previous value,
  because moving a target is how a miss becomes a hit on paper.
- `progressPct` is **null**, not 0, when the target is zero. A percentage of
  nothing is undefined, and printing 0% invites it to be read as failure.
- Achievement excludes cancelled deals and attrition; D2 attendance and D4
  withdrawals are reported in their own column beside the target.

**Tests** — 137 unit, **225 integration** (23 new in
`integration/targets.test.ts`), covering the sponsor money path, D2, D4,
per-role visibility, and §39 scenario 28.

| | |
|---|---|
| `npm test` | 137 passed |
| `npm run test:integration` | 225 passed |
| `npm run verify:db` | all passed |
| `npm run build` | exit 0 |

### TWO INFRASTRUCTURE PROBLEMS FOUND AND FIXED

**1 · `DIRECT_DATABASE_URL` no longer resolved — migrations were broken.**
`db.<project-ref>.supabase.co` is IPv6-only on current Supabase projects and
returns `ENOTFOUND` from an IPv4 network, which reads like a bad password
rather than a routing failure. Repointed at the **session-mode pooler** — same
host as the runtime string, port 5432 — verified it performs full DDL, and
corrected `.env.example`, `supabase-setup.md` and `migrations.md`, all of which
gave the now-wrong endpoint. The previous `.env` was backed up alongside it;
both remain gitignored.

**2 · A killed test run can wedge the whole suite.** `withFixture` holds an
open transaction; killing vitest mid-run leaves it *idle in transaction*, and
because `person_emails` is unique on `lower(email)`, the next run's identical
insert blocks on that index **forever**. One suite sat at 580s with all 20
tests skipped. Diagnosed via `pg_stat_activity`; the fix is to let a run finish
or terminate the abandoned backend. Recorded here because it looks exactly like
a code hang and is not one.

**Next:** Boundary 11 — Commission.

---

## Boundary 11 · Commission

**Commit:** `c704877`

**Built** — `src/server/domain/commission.ts`: `resolveRule`, `computeAmount`,
`recordEarnedCommission`, `reverseCommissionFor`, `ledger`,
`commissionSummary`, `simulate`, `createRule`, `supersedeRule`. Wired into
`changeStage` so commission and the stage change commit **in one transaction**.

**The four properties, each of which fails silently if wrong**

| | Proved by |
|---|---|
| Base is **final contracted value** | 100k estimated, 80k contracted, 10% → **8,000**, never 10,000 |
| Rate is **locked at WON** | rule changed to 20% afterwards; the entry still reads **8,000 at 10%** |
| CANCELLED **reverses automatically** | a linked **−10,000** row appears with no manual step |
| Balance is `SUM(amount)` | 18,000 → **8,000** after cancellation, earned and reversed reported separately |

**Decisions worth recording**

- **Not one number in this module decides what anyone earns.** Every rate,
  fixed amount and tier is read from `commission_rules`.
- **Rules resolve by specificity** — person beats edition beats event beats the
  house rule — and ties break on the most recently effective. Resolved **per
  person**, because a split does not mean both parties earn at the same rate.
- **Rules are versioned, never edited.** `supersedeRule` closes the old one at
  the moment the new one starts, so "which rule applied the day this was won"
  always has one answer.
- **The reversal carries the same locked terms as what it undoes.** A reversal
  computed from today's rule could differ from what was actually paid.
- **Nothing is deleted.** The earned entry survives its own reversal, so the
  history of what someone was told they had earned remains.
- Both write paths are **idempotent** — re-entering them writes nothing.
- **Tiers are marginal, not a cliff.** 200k over 0–100k@5% and 100k+@10% pays
  15,000, not 20,000. A cliff would mean earning *less* just below a boundary
  than just above it. A property test asserts a larger deal never pays less.
- **The simulator resolves the same rule and calls the same pure function** the
  WON path does. A simulator with its own arithmetic is a second opinion that
  eventually contradicts the ledger.
- No rule configured returns **null**, not zero. Zero implies a rule that pays
  nothing; null says nobody has configured one.

**Tests** — 137 unit, **245 integration** (20 new). §39 scenarios 14, 15, 16
covered, plus reversal idempotency and the marginal-tier property.

| | |
|---|---|
| `npm test` | 137 passed |
| `npm run test:integration` | 245 passed |
| `npm run verify:db` | all passed |

**One recurring trap, now named.** A JS `Date` inside a **raw** `sql` template
reaches the driver unserialisable — the typed helpers are fine because the
column tells the driver what it is. This has caught the build twice (Boundary 5,
and here). Added `tsAt(date)` with the explanation at the definition, so the
requirement is visible at the call site rather than at runtime.

**One test corrected:** the split test named a speaker-only member as secondary
owner on a sponsor deal. Boundary 4 refused it, correctly — an owner must hold
the function.

**Next:** Boundary 12 — Forecast.

---

## Boundary 12 · Forecast

**Commit:** `b1f9776`

**FIRST — the interrupt hazard from Boundary 10 is now FIXED, not documented.**

Every fixture transaction sets `SET LOCAL idle_in_transaction_session_timeout =
'60s'`, so a killed test run is reclaimed by Postgres instead of holding the
unique email index indefinitely. `SET LOCAL` scopes it to the transaction, so it
cannot leak onto a pooled connection and affect application queries — which
matters, because the transaction pooler hands that backend to somebody else the
moment we are done.

`integration/interrupt.test.ts` proves it is **enforced**, not merely accepted:
it opens a transaction with a 1s timeout, sits idle past it, and asserts the
next statement fails. Postgres terminates the backend, so postgres.js reports
`CONNECTION_CLOSED` rather than `25P03` — the stronger evidence, since the
session was reclaimed rather than merely errored. A third test asserts no
session anywhere is idle in transaction beyond the guard.

**Built** — `src/server/domain/forecast.ts`, the `forecastView` /
`setProbability` / `overrides` RPCs, and `/admin/forecast`.

**Decisions worth recording**

- **CLOSED REVENUE is the only figure here describing money the business
  actually has**, and it excludes cancelled deals. The test wins 70k and
  cancels a 40k, and asserts revenue is 70k rather than 110k.
- **Both weightings are kept.** `weightedPipeline` follows the probability on
  the opportunity; `weightedAtLadder` forces the same sum back onto the
  configured stage defaults. The gap between them **is** the human adjustment,
  and the screen shows all three.
- **Setting a probability back to the ladder CLEARS the override flag.**
  Otherwise the count of human-adjusted deals inflates with every deal somebody
  looked at and agreed with.
- Editions with nothing open, nothing closed and no target are skipped — an
  empty row on a forecast screen is noise.
- The word FORECAST and the sentence *"not committed revenue and no part of it
  is guaranteed"* are returned by the domain layer, not written into one
  template, so no screen can render the number without them.

**Tests** — 137 unit, **267 integration** (19 forecast + 3 interrupt guard).
Passed first run.

| | |
|---|---|
| `npm test` | 137 passed |
| `npm run test:integration` | 267 passed |
| `npm run build` | exit 0 |

**Next:** Boundary 13 — Productivity.

---

## Boundary 13 · Productivity

**Commit:** `d7f1ca6`

**Built** — `src/server/domain/productivity.ts` (`metrics`, `insights`), the
`productivityMetrics` / `productivityInsights` RPCs, and `/admin/insights`.

**Decisions worth recording**

- **Denominators differ on purpose, and each metric states its own.** A
  response rate measured against every opportunity rather than against those
  actually contacted flatters the team by counting people they never called.
  `basis` carries the sentence — *"of those contacted"*, *"of those met"*,
  *"of those that reached an outcome"* — and the screen prints it under the
  label.
- **Function-specific metrics appear only where they mean something.** Sponsor
  has no attrition rate; speaker has no average deal size, because speakers are
  not priced.
- **"High value" is the top quartile of THIS caller's own open estimates**, not
  a threshold invented here. A fixed number is wrong for every team but the one
  it was chosen for, and stops meaning anything as deal sizes move.
- **Every insight carries the ids it counted**, and the screen lets you open
  them. A suggestion you cannot check is a suggestion you have to believe.
- Average deal size and time-to-close refuse below the sample too. Two wins is
  not a distribution.
- The response-rate heuristic is **explicitly approximate and labelled so** in
  the code: the system records what the team *did*, so a reply is only visible
  because somebody logged it.

**Tests** — 137 unit, **286 integration** (19 new). Passed first run. The
assertion that matters most: the rows an insight names are checked to actually
have the property claimed — the "never contacted" list is verified against the
set that was contacted.

| | |
|---|---|
| `npm test` | 137 passed |
| `npm run test:integration` | 286 passed |
| `npm run build` | exit 0 |

**Next:** Boundary 14 — Audit / Export / Erasure.

---

## Boundary 14 · Audit / Export / Erasure

**Commit:** `accb88a`

**Built** — `src/server/domain/governance.ts` (`auditTrail`, `historyFor`,
`exportCsv`, `erasePerson`, `erasureRegister`), `src/rpc/governance.ts`, and
`/admin/governance`. The route **redirects** a non-Super-Admin rather than
rendering a shell it cannot fill; the server refuses each call independently
regardless.

**Decisions worth recording**

- **The audit trail is Super Admin only.** An Admin reading it would see target
  changes, commission adjustments and role changes across the whole business,
  none of which their event scope entitles them to — and it is one table, so
  there is no partial view that is both useful and safe. `historyFor` gives the
  scoped, per-record view instead: seeing who moved a deal you own is part of
  working it.
- **Export goes through the same scoped queries the screens use**, never a raw
  table read. One download is the easiest way to defeat every permission in the
  system.
- **Exporting is itself audited.** A copy of the pipeline leaving the building
  is an event somebody may need to account for.
- **CSV injection is neutralised, not dropped.** A cell beginning `=`, `+`, `-`
  or `@` executes as a formula in Excel and Sheets, and this data arrives from a
  public web form. The test plants `=cmd|'/c calc'!A1` as a person's name and
  asserts it is still present *and* prefixed.
- **Erasure destroys the person, not the business record.** Name, job title,
  phone, country and every email address are cleared; every opportunity,
  activity, commission entry and audit row survives under the same person id.
  The test asserts the 8,500 commission earned on that person's deal is still
  there afterwards.
- **The erasure register stores field NAMES only.** A test asserts the erased
  person's name appears nowhere in the register — storing what was erased is
  the obvious mistake, and it would defeat the entire purpose.

**Tests** — 137 unit, **308 integration** (22 new). §39 scenarios 29–31 and the
unauthorized-export case covered.

| | |
|---|---|
| `npm test` | 137 passed |
| `npm run test:integration` | 308 passed |
| `npm run build` | exit 0 |

**One test corrected:** the audit-action list was sampled before the export and
erasure the same fixture went on to perform. Moved to the end.

**Next:** Boundary 15 — Final UX polish.
