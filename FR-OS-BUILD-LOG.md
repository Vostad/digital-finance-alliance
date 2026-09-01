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
