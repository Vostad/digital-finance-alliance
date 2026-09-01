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
