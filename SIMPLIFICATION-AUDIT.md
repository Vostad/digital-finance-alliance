# Phase 1 — Simplification & Performance Audit

**Date:** 3 September 2026
**Baseline commit:** `e950cc7` (frozen)
**Baseline deployment:** `dpl_99z6AXwuYVmNa9baR3NseAvbnzkJ` — Ready, aliased to `financialrails.org`
**Status:** audit only. No code was modified.
**Revision:** 2 — decisions Q1–Q6 locked on 3 September 2026; signed-in baseline measured.
**Revision:** 2 — decisions Q1–Q6 locked by the product owner on 3 September 2026; signed-in baseline now measured.

---

## A. Current performance baseline

### A.1 Method (repeatable after Phase 2)

Measurements were taken against the **production deployment**, not a dev server.
Two instruments, both re-runnable:

1. **Network timing** — `curl` against `https://financialrails.org`, 5 runs per
   route, median reported. Captures TTFB, total transfer, HTML payload.
2. **Build analysis** — byte and gzip sizes read from `.vercel/output/static`,
   the exact artefact that was deployed.

Database round trips are derived by **static analysis of the server code paths**
rather than by runtime sampling. This is deliberate: round-trip count is a
property of the code, is exact, and does not vary with cache state.

### A.2 Network baseline (production, warm, median of 5)

| Route | TTFB | Total | HTML |
|---|---:|---:|---:|
| `/` (public home) | 421 ms | 474 ms | 68.9 KB |
| `/forums/mena` (public, carries the intake form) | 398 ms | 657 ms | 118.6 KB |
| `/admin/login` (SSR, no session) | 381 ms | 386 ms | 6.8 KB |
| `/admin` (auth redirect, 307) | 685 ms | 685 ms | 0 KB |
| `/robots.txt` (static) | 503 ms | 503 ms | 0.2 KB |

### A.3 JavaScript baseline

39 chunks, **657.1 KB raw** total across the whole site.

| Chunk | Raw | Gzip | Loaded by |
|---|---:|---:|---|
| `index-B_9O9yEg.js` | 309.1 KB | **95.6 KB** | every route, admin included |
| `forums.mena-*.js` | 82.7 KB | 24.7 KB | public microsite only |
| `createServerFn-*.js` | 37.5 KB | 11.7 KB | every route calling RPC |
| `utils-*.js` | 26.6 KB | 8.4 KB | shared |
| `link-*.js` | 21.2 KB | 8.1 KB | shared |
| `styles-*.css` | 120.0 KB | **20.2 KB** | every route |

**Admin route chunks are already small and already code-split:**

| Route chunk | Raw |
|---|---:|
| `admin.leads._id` | 7.1 KB |
| `admin.leads.new` | 7.0 KB |
| `Shell` | 6.5 KB |
| `admin.index` | 5.9 KB |
| `admin.directory` | 5.4 KB |
| `admin.targets` | 4.8 KB |
| `admin.forecast` | 3.8 KB |
| `admin.governance` | 3.8 KB |
| `admin.insights` | 3.4 KB |
| `admin.pipeline` | 3.1 KB |
| `admin.leads.index` | 1.2 KB |

**Estimated admin first load ≈ 148 KB gzip** — `index` 95.6 + `createServerFn`
11.7 + `utils` 8.4 + `link` 8.1 + CSS 20.2 + Shell and route chunk ≈ 4.

The finding that matters: **route-level code splitting is already correct.**
The weight is in the shared entry chunk and the single shared stylesheet, not in
the admin screens. Splitting admin routes further would gain almost nothing.

### A.4 Database round trips before a screen is usable

Every server function independently resolves the auth context. There is **no
per-request memoisation** (`src/server/auth/context.ts:190`). Each call costs:

- 1 token verification (`auth.getClaims`)
- 3 DB queries — the `users` row, then `user_functions` + `user_event_scopes` in parallel

Every admin route also awaits `me()` in `beforeLoad` **before** the loader runs,
which makes the first data fetch a serial waterfall.

| Route | Server calls | HTTP waves | Auth queries | Data queries | **Total DB** |
|---|---:|---:|---:|---:|---:|
| `/admin` (Today) | 2 | 2 serial | 6 | ~8 | **~14** |
| `/admin/leads/$id` | 2 | 2 serial + 3 internal waves | 6 | ~7 | **~13** |
| `/admin/targets` | 4 | 3 | 12 | ~4 | **~16** |
| `/admin/forecast` | 3 | 2 | 9 | ~4 | **~13** |
| `/admin/insights` | 3 | 2 | 9 | ~4 | **~13** |
| `/admin/governance` | 3 | 2 | 9 | ~3 | **~12** |
| `/admin/directory` | 3 | 2 | 9 | ~4 | **~13** |
| `/admin/leads` | 2 | 2 serial | 6 | 1 | **~7** |
| `/admin/pipeline` | 2 | 2 serial | 6 | ~2 | **~8** |

**Target is ≤ 5 round trips before the Dashboard is usable. Current is ~14.**

### A.5 Signed-in baseline (measured under Q6 approval)

A temporary least-privilege account (`AUDIT-perf`, role **admin**, scoped to one
event — not Super Admin) was created through the existing fixture mechanism,
used only for measurement, and **deleted immediately afterwards**. Verified
afterwards: one user remains (yours), zero event scopes, zero work functions,
zero auth users besides yours. The password existed only in process memory and
was never printed, stored, committed, or placed in any artefact. Authentication
used the `Authorization: Bearer` path the server already accepts
(`src/server/auth/context.ts:79`), so no credential entry was involved.

Production, 5 runs per route, median:

| Route | TTFB | Total | HTML |
|---|---:|---:|---:|
| `/admin` — **Dashboard** | **2,789 ms** | 2,791 ms | 16.3 KB |
| `/admin/leads` | 2,350 ms | 2,354 ms | 10.7 KB |
| `/admin/pipeline` | 2,393 ms | 2,395 ms | 16.3 KB |
| `/admin/targets` | 2,116 ms | 2,121 ms | 8.6 KB |
| `/admin/insights` | 2,266 ms | 2,268 ms | 16.0 KB |
| `/admin/directory` | 2,372 ms | 2,392 ms | 9.6 KB |
| `/admin/forecast` | **6,465 ms** | 6,473 ms | 15.4 KB |

**The finding that matters most in this audit.** These timings were taken with
the commercial tables essentially **empty** — one lead in the entire database.
The Dashboard still takes **2.8 seconds**, against a target of under 2. The cost
is therefore *not* data volume. It is round trips and per-call auth resolution,
and it will only grow as real data arrives.

`/admin/forecast` at 6.5 seconds is a consistent outlier across all five runs.
Under decision Q2 it loses its UI, so it is not on the Phase 2 critical path —
but it is recorded here because the backend remains and the cause is unexplained.

**Lead detail was not measured**: no suitable record existed at measurement time.
It should be measured in the Phase 2 before/after using a real record.

---

## B. Performance bottlenecks — concrete causes

Ranked by cost, each with a specific mechanism.

**B1 — Auth context re-resolved on every server function call.** *(3 DB queries × every call)*
`getAuthContext()` is not memoised per request. A route making 4 server calls
pays 12 identical auth queries. This is the single largest source of waste.
Fixing it is request-scoped caching only — the context must still be resolved
fresh **per request**, never across requests, or deactivation and scope changes
would go stale (§28).

**B2 — `me()` is a serial waterfall in front of every loader.** *(one full round trip)*
Every admin route awaits `me()` in `beforeLoad`, then starts loading data. The
first byte of real data cannot arrive until a complete round trip has finished.
The loader already receives the user through `context`; the same data could ride
along with the loader's own call.

**B3 — Dashboard loads far more than "what needs my attention".** *(~8 queries)*
`dashboard()` (`src/server/domain/dashboard.ts:283`) fans out to 7 branches:
headline, suggestions (itself 2 queries), follow-ups, conversion rates, team
standing, an unassigned inbox capped at 50, and **every edition joined to every
event**. The edition list and team standing are not needed to answer the
dashboard's question.

**B4 — Leads list has no pagination.** *(up to 200 rows in one payload)*
`listWorkstreams` takes `limit ?? 200` — a cap, not a page. There is no offset or
cursor, so the list cannot grow safely and the whole set is serialised into the
SSR payload.

**B5 — Targets route makes 4 sequential server calls.** *(12 auth queries)*
`me()`, then `targets()`, then `Promise.all([options, form])`. Three waves where
one would do.

**B6 — Lead detail issues three serial waves.** `loadForWrite`, then a 3-way
parallel batch, then a 5-way parallel batch. Four of the five in the last batch
are process-cached reference data (stages, loss/cancellation/withdrawal reasons)
so they are cheap after first request, but the wave structure still serialises.

**B7 — One stylesheet for two products.** The 120 KB / 20.2 KB gz stylesheet
serves both the public microsite and the admin OS. Admin loads the microsite's
styles and vice versa.

**B8 — The shared entry chunk is 95.6 KB gz** and is the dominant download on
every admin screen. Worth inspecting, but this is framework and router code;
expect modest gains, not large ones.

---

## C. Current navigation audit

Eight primary items (`src/components/admin/Shell.tsx:27`).

| # | Item | Route | Classification | Why |
|---|---|---|---|---|
| 1 | Today | `/admin` | **Essential** | The attention screen. Becomes Dashboard. |
| 2 | Pipeline | `/admin/pipeline` | **Duplicate** | Same rows as Leads in board form. A view of Leads, not a destination. |
| 3 | Leads | `/admin/leads` | **Essential** | The core operational screen. |
| 4 | Targets | `/admin/targets` | **Move** | Belongs inside Events (§22). |
| 5 | Forecast | `/admin/forecast` | **Overly complex** | Projection tooling; not daily workflow. No home in the 4-item nav. |
| 6 | Insights | `/admin/insights` | **Useful, secondary** | Productivity metrics. Partly satisfies "basic performance" on Team. |
| 7 | Directory | `/admin/directory` | **Move / de-emphasise** | People, companies, duplicate queue, reversible merges. Duplicate detection must stay reachable. |
| 8 | Governance | `/admin/governance` | **Move** | Export belongs in Leads (§26); audit trail and erasure register belong in Settings. |

---

## D. Simplified navigation recommendation

Exactly as specified — no additions.

**Super Admin and Admin (identical structure, different server-side scope):**
`Dashboard · Leads · Events · Team`

**Team Member:** `My Leads · My Targets`

**Account menu (all roles):** Settings, Sign out.

Contextual placements:

| Capability | New location |
|---|---|
| Pipeline board | A view toggle inside **Leads** |
| Targets | Inside **Events**, and **My Targets** for Team Members |
| CSV export | Contextual action inside **Leads**, Super Admin only |
| Duplicate queue / merges | Inside **Leads** (duplicate detection is part of lead capture) |
| Audit trail, erasure register | **Settings** |
| Team performance | Inside **Team** |

---

## E. Work-function handling (Sponsor / Delegate / Speaker)

Verified against the running code.

| Question | Current answer |
|---|---|
| Where visible | A `function` filter on Today, Pipeline, Insights; a `Function` column on Leads; the function is fixed per opportunity |
| How filtered | `OpportunityFilters.function`, applied server-side inside `scopedQuery` |
| How created | `addLead` (manual) and `submitWebsiteLead` (website), function chosen at creation |
| How assigned | `setOwner`, gated by `assignableUsers(q, fn)` — only users holding that function are offered |
| How progressed | `moveStage`, using per-function ladders from `pipeline_stages` (sponsor 9, delegate 8, speaker 7) |
| How targeted | `targets` rows carry `function` + `metric`, so monetary and count targets coexist |
| Multiple owners per person | **Yes** — `opportunities` are per person **per edition per function**, each with its own `owner_id` |

**A unified Leads screen can expose all three without separate dashboards.**
The data model already treats a workstream as (person × edition × function), and
`otherWorkstreams` on the lead detail already shows the sibling workstreams with
a restricted projection. No structural change is needed — only that Leads gains
a function filter and the Dashboard's money cards are labelled Sponsor-scoped.

**Sponsor-only monetary KPIs are supportable today**: `estimated_value`,
`final_value` and `currency` live on `opportunities`, and filtering by
`function = 'sponsor'` is already a first-class filter.

---

## F. Existing capability mapping

**1 — Must remain primary**
Dashboard/attention · Leads list · Lead detail · Manual lead creation ·
Assignment · Activity logging · Follow-ups · Status transitions

**2 — Must remain secondary**
Targets (inside Events) · Team workload and basic performance · Event performance

**3 — Must remain available contextually**
Pipeline board (Leads view) · CSV export (Leads action, Super Admin) ·
Duplicate queue and merges (Leads) · Audit trail and erasure register (Settings)

**4 — Can be de-emphasised**
Forecast · Productivity insights · Directory browsing of people/companies

**5 — Frontend-only removal candidates**
Nothing qualifies yet. Every current admin route renders a capability that
either moves or is de-emphasised. Deletion decisions are listed in §I and are
conditional on your approval of §K and §O.

---

## G. Backend logic reused unchanged

No change proposed to any of it:

`scopedQuery` and the whole `src/server/auth/**` tree · RLS default-deny and all
migrations · CSRF middleware · role, event-scope and work-function enforcement ·
deactivation · commission calculation, reversal and privacy rules · pipeline
ladders and transition rules · sponsor cancellation and reversal · delegate
CONFIRMED/ATTENDED separation · speaker WITHDRAWN attrition · duplicate
detection and merge/unmerge · website intake with explicit MENA 2026 mapping ·
email outbox, Resend delivery and idempotency.

---

## H. Pages/components to simplify

| Screen | Change |
|---|---|
| `admin.index` (Today → Dashboard) | Cut to at most 5 KPI cards. Drop team standing and the full edition list from the initial load. Label Pipeline Value and Won Revenue as Sponsor-scoped; omit them entirely for delegate-/speaker-only users. |
| `admin.leads.index` (Leads) | Add the missing columns (§17), real pagination, one search box and a small filter set. Absorb the Pipeline board as a view toggle. Add the export action, Super Admin only. |
| `admin.leads.$id` (Lead detail) | Keep the structure; collapse the three query waves. Already close to the §18 target. |
| `admin.leads.new` | Keep. Already simple; duplicate detection stays. |
| `admin.targets` | Fold into a new Events screen. |
| `Shell.tsx` | Nav reduced to four items; role-aware variant for Team Members; account menu added for Settings. |
| **New: Events** | Does not exist today. Per-event operational view plus targets. |
| **New: Team** | Does not exist today. See §L and §O — most of what §24 requires has no backend. |
| **New: Settings** | Does not exist today. Needs a home for audit trail and erasure register. |

---

## I. Frontend files proposed for deletion

**None at this stage.** Every candidate is a move, not a deletion:

| File | Fate | Capability it served | Still available? |
|---|---|---|---|
| `admin.pipeline.tsx` | Absorbed into Leads as a view | Board layout of the same rows | Yes — same data, same RPC |
| `admin.targets.tsx` | Absorbed into Events | Target setting and progress | Yes |
| `admin.governance.tsx` | Split: export → Leads, audit + erasure register → Settings | Export, audit trail, erasure register | Yes |
| `admin.directory.tsx` | Duplicate queue and merges → Leads; browsing de-emphasised | People/company browsing, dedupe | Partly — see §O |
| `admin.forecast.tsx` | No home in the four-item nav | Forecast projections | **Decision required — see §O** |
| `admin.insights.tsx` | Partly absorbed into Team | Productivity metrics | Partly — see §O |

I will delete nothing until you approve §K and §O.

---

## J. Queries to remove, defer or parallelise

| # | Change | Effect |
|---|---|---|
| J1 | Memoise the auth context **per request** (never across requests) | −3 DB queries per extra server call; Dashboard −3, Targets −9 |
| J2 | Remove the `me()` waterfall; return the user from the loader's own call | −1 serial round trip on every admin route |
| J3 | Drop the edition list and team standing from the Dashboard's initial load; fetch on demand | −2 queries, one a 2-table join over all editions |
| J4 | Fold `suggestions()`' two queries into the follow-up query it already runs | −1 query |
| J5 | Add real pagination to `listWorkstreams` (cursor or offset) | Bounded payload; list stops growing with the table |
| J6 | Collapse Targets' 3 waves into 1 | −2 round trips, −6 auth queries |
| J7 | Merge Lead detail's second and third waves | −1 wave |
| J8 | Split the stylesheet, or scope admin styles | Smaller CSS on both products |

**J1 is the one to be careful with.** Request-scoped only. If it ever outlives a
request, a deactivated user could retain access — the exact failure §28 forbids.
It must be keyed to the request, and the deactivation test in §32 must prove it.

Projected Dashboard round trips after J1–J4: **~5**, from ~14.

---

## K. Capabilities that move out of primary navigation

| Capability | From | To | Reachable? |
|---|---|---|---|
| Pipeline board | Primary nav | Leads view toggle | Yes |
| Targets | Primary nav | Events, and My Targets | Yes |
| CSV export | Governance page | Leads action, Super Admin only | Yes |
| Audit trail | Governance page | Settings | Yes |
| Erasure register | Governance page | Settings | Yes |
| Duplicate queue / merges | Directory | Leads | Yes |
| People / company browsing | Directory | Search within Leads | Reduced |
| Productivity metrics | Insights | Team | Reduced |
| Forecast | Primary nav | — | **See §O** |

---

## L. Schema gaps discovered

Checked every field the §17 Leads table requires against the live schema.

| Required column | Exists? | Where |
|---|---|---|
| Name | Yes | `people.full_name` |
| Company | Yes | `companies.name` |
| Email | Yes, **via join** | `person_emails.email` (`is_primary` flag) — one-to-many, not on `people` |
| Phone | Yes | `people.phone` |
| Event | Yes | `editions` → `events` |
| Interest / Work function | Yes | `opportunities.function` |
| Source | Yes | `opportunities.source` |
| Status | Yes | `opportunities.stage_key` |
| Assigned To | Yes | `opportunities.owner_id` |
| Created | Yes | `opportunities.created_at` |
| Next Follow-up | Yes | `opportunities.next_action_due_at` |

**No schema change is required for the Leads screen.** Email costs one join to
`person_emails` filtered on `is_primary`.

**One genuine gap, reported not fixed (§4):** §24 requires assigning system
roles, work functions and event scope. The tables exist (`user_functions`,
`user_event_scopes`, `users.role`) but **no application code writes to any of
them** — they are read-only in `src/server/auth/context.ts` and
`src/server/domain/assignment.ts`. This is a missing write path, not a missing
column. No migration needed.

---

## M. Security and regression risks

| Risk | Severity | Mitigation |
|---|---|---|
| Auth memoisation (J1) outliving a request → stale privilege | **High** | Request-scoped only; re-run the deactivation, role-change and scope-change tests |
| Team screen requires new role/scope write paths | **High** | New privileged writes in the most sensitive area. Super-Admin-only, server-enforced, audit-logged, with tests before UI |
| User creation touches Supabase Auth admin API | **High** | Uses the service-role client; must stay behind `scopedQuery` discipline and the eslint import guard |
| Export moving into Leads | Medium | Authorization already server-side and proven; do not let placement imply permission |
| Admin and Super Admin sharing nav structure | Medium | Identical UI, different server scope. Re-run cross-event and cross-function tests |
| Removing screens hides a capability entirely | Medium | §O must be approved explicitly |
| Pagination changing result sets | Low | Scope predicates unchanged; assert filtered counts in tests |

---

## N. Tests required after changes

**Reuse unchanged:** all 16 integration suites and 8 unit suites must stay green,
unmodified. No test may be weakened to pass.

**Re-run as regression:** login · Super Admin / Admin / Team Member access ·
deactivation denial · lead creation · website intake (both paths, MENA 2026) ·
duplicate detection · assignment and reassignment · status changes · notes,
calls, meetings · follow-ups · sponsor cancellation and commission reversal ·
delegate CONFIRMED vs ATTENDED · speaker WITHDRAWN · CSV authorization ·
commission privacy · cross-event, cross-function and URL-manipulation denial.

**New tests required:**

1. Auth memoisation does not survive a request boundary — deactivate mid-flight, next request denied.
2. Role change takes effect on the next request.
3. Event-scope change takes effect on the next request.
4. Team Member cannot reach CSV export by direct RPC call.
5. Admin cannot reach CSV export by direct RPC call, absent an explicit grant.
6. Delegate-only and speaker-only users receive no Sponsor monetary KPI in the payload — not merely hidden in the UI.
7. Pagination does not widen scope: page N obeys the same predicates as page 1.
8. If Team management is built: non-Super-Admins cannot create users, change roles, or alter scope, tested by direct RPC.

**Performance re-measurement:** repeat §A.1 exactly — same routes, 5 runs,
median; same build analysis; same static round-trip count. Report before/after.

---

## O. Capability classification (locked)

Every existing capability, classified as required. Nothing is dropped silently.

### O.1 Primary UI

| Capability | Screen |
|---|---|
| Attention view | Dashboard |
| Lead list, search, filter | Leads |
| Lead detail, timeline, actions | Leads → detail |
| Manual lead creation + duplicate detection | Leads → add |
| Assignment / reassignment | Leads (list and detail) |
| Activity logging, follow-ups, status changes | Leads → detail |
| Event performance | Events |
| Team roster and workload | Team |
| Team Member work | My Leads |
| Team Member targets | My Targets |

### O.2 Secondary UI

| Capability | Location | Note |
|---|---|---|
| Targets (admin view) | Inside Events | Not primary nav (§22) |
| Minimal team performance | Inside Team | Only what existing data already supports (Q3) |
| Settings | Account menu → Settings | Classified **Secondary UI**, not "no path", because the account-menu entry is being built |
| Audit trail | Settings | Moved from Governance |
| Erasure register (read-only list) | Settings | Moved from Governance |

### O.3 Contextual UI

| Capability | Location |
|---|---|
| Pipeline board | View toggle inside Leads |
| CSV export | Action inside Leads, Super Admin only, server-enforced |
| Duplicate queue and merge/unmerge | Inside the Leads workflow |
| Person / company lookup | Search inside Leads (Q4 — no separate directory) |

### O.4 Intentionally no UI path

Locked by decision. **No backend is deleted in any row below.**

| Capability | Why | Backend intact? | Tests depend on it? | Schema change if built later? |
|---|---|---|---|---|
| **Commission** — statements, ledger, rules, simulation, reversal | Q1: deliberately out of this pass. Calculated and stored automatically on WON and cancellation; correct and auditable in the database, simply not displayed | **Yes — fully.** `src/server/domain/commission.ts` untouched | **Yes.** `commission.test.ts` and the sponsor-cancellation suites exercise it directly and stay green | **No.** `commission_entries`, `commission_rules`, `commission_rule_tiers` already exist. A future UI needs RPC + screen only |
| **Forecast** | Q2: no UI, and no contextual home invented to give it one | Yes — `forecast.ts` untouched | Yes — forecast integration tests stay green | No |
| **Email outbox status / retry** (`emailStatus`, `retryEmail`) | No operational UI exists today and none is in the locked navigation. RPCs remain defined but uncalled | Yes | Indirectly, via email tests | No |
| **Erasure execution** (`erasePerson`) | Previously logged as F1. Register is visible in Settings; *executing* an erasure still has no control | Yes — authorization verified 22/22 | Yes — `governance.test.ts` proves Admin and Team Member are refused | No |
| **Productivity — detailed analytics** | Q3: only minimal contextual info on Team. The detailed view has no home | Yes — `productivity.ts` untouched | Yes | No |
| **People / company directory browsing** | Q4: Leads search replaces it | Yes — `directory.ts` untouched | Yes — dedupe and merge tests stay green | No |

### O.5 Backend-only capability

Never had a UI and is not gaining one: audit-log writing, scoped-query
enforcement, RLS default-deny, CSRF middleware, pipeline ladder and transition
rules, commission calculation and reversal, delegate CONFIRMED/ATTENDED
separation, speaker WITHDRAWN attrition, company-domain inference, email outbox
drain and Resend delivery, website intake edition mapping.

### O.6 Standing risk this creates

Two obligations now have working, tested backends and **no way for a person to
invoke them**: erasure execution, and any commission enquiry. If a data-subject
deletion request or a commission dispute arrives, answering it requires a
developer with database access. That is a deliberate, approved trade — recorded
here so it is a known position rather than a surprise.

## Summary

- Route-level code splitting is already correct; admin chunks are 1.2–7.1 KB.
- The real cost is **~14 DB round trips and 2 serial HTTP waves** before the Dashboard is usable, driven by un-memoised auth and the `me()` waterfall.
- **No schema change is needed** for the simplified Leads screen.
- **Six capabilities already have no UI path**, commission being the largest.
- **Three §24 Team requirements have no backend at all** and would be new privileged code.
- Nothing is proposed for deletion until §K and §O are approved.

**Phase 1 ends here. No implementation has begun.**
