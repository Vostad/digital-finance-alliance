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
