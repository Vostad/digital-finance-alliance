# Phase 2 — Implementation Plan

**Status:** IMPLEMENTED and deployed 3 September 2026.
**Production:** `dpl_FoVzFh8xiVghzhFi4aL4V9XMWgDA` — Ready, aliased to `financialrails.org`.
**Rollback target:** `dpl_99z6AXwuYVmNa9baR3NseAvbnzkJ` — still available.
**Baseline:** commit `e950cc7`, deployment `dpl_99z6AXwuYVmNa9baR3NseAvbnzkJ` (**rollback target**).
**Decisions:** Q1–Q6 locked (see `SIMPLIFICATION-AUDIT.md` §O).

---

## 1. Can Team user management be built on the existing schema?

### YES. No migration is required.

Verified against the live database, not assumed:

| Requirement | Existing support | Verdict |
|---|---|---|
| Create user | `users` — `id, email, full_name` required; `role` defaults `team_member`; `status` defaults `invited` | No change |
| Assign system role | `user_role` enum = exactly `super_admin, admin, team_member` | No change |
| Assign work functions | `user_functions`, PK `(user_id, function)`; `work_function` enum = exactly `sponsor, delegate, speaker` | No change — idempotent upsert/delete |
| Assign event scope | `user_event_scopes`, PK `(user_id, event_id)`, FK `ON DELETE CASCADE` | No change |
| Activate / deactivate | `users.status` + `deactivated_at`; `setUserActive()` already implements it | Already exists |

**The one hard constraint:** `public.users.id → auth.users(id) ON DELETE RESTRICT`.
A `public.users` row cannot exist without a matching Supabase Auth user, so
creation is strictly ordered: **create the auth user first, then the app row.**

That is already the established pattern here. `src/server/auth/supabase.server.ts`
exposes `adminClient()` and already calls `auth.admin.updateUserById` for
`revokeUserSessions` / `restoreUserSessions`. Adding `auth.admin.createUser` is a
**same-module extension of existing architecture**, not a second user-management
system — exactly what Q5 requires.

`canManageUsers(ctx)` already exists and already returns Super-Admin-only
(`src/server/auth/permissions.ts:155`). **No new permission model is needed.**

**`invitations` stays unused.** The minimum flow — Super Admin creates the
account with `email_confirm: true` and a set password — needs no invitation row.
The table is left in place, untouched, and is not part of this work.

### The one genuine risk

Creation is a two-system write: Supabase Auth, then Postgres. If the auth user
is created and the app row then fails, an orphan auth user is left that can
authenticate but has no app context. `loadContext()` already handles this — it
throws `not_provisioned` — so the failure is **safe but untidy**. Phase 2 will
delete the auth user on app-row failure, and a test will cover it.

---

## 2. Files expected to change

### 2.1 Modified — server

| File | Change | Risk |
|---|---|---|
| `src/server/auth/context.ts` | Request-scoped memoisation of `getAuthContext()` | **High** — §28 |
| `src/server/auth/supabase.server.ts` | Add `createAuthUser()` / `deleteAuthUser()` wrappers around the existing `adminClient()` | High |
| `src/server/auth/accounts.ts` | Add `createUser`, `setUserRole`, `setUserFunctions`, `setUserEventScopes` — all behind `canManageUsers` | High |
| `src/server/domain/dashboard.ts` | Trim `dashboard()`: drop the edition list and team standing from the initial load; fold `suggestions()`' second query into the follow-up query | Medium |
| `src/server/domain/opportunities.ts` | Add cursor pagination to `listOpportunities`; join primary email from `person_emails` | Medium |
| `src/rpc/leads.ts` | Pagination params on `listWorkstreams`; export action wiring | Low |
| `src/rpc/dashboard.ts` | Return the user alongside the dashboard payload so `me()` can be dropped | Low |

### 2.2 New — server

| File | Purpose |
|---|---|
| `src/rpc/team.ts` | RPC surface for the four Team mutations. Thin wrappers only, matching `src/rpc/auth.ts` |

### 2.3 Modified — routes and components

| File | Change |
|---|---|
| `src/components/admin/Shell.tsx` | Nav 8 → 4; role-aware variant for Team Members (`My Leads`, `My Targets`); account menu with Settings and Sign out |
| `src/routes/admin.index.tsx` | Dashboard: ≤5 KPI cards; Sponsor-scoped labels; omit money cards entirely for delegate-/speaker-only users; drop `me()` waterfall |
| `src/routes/admin.leads.index.tsx` | The main build: §17 columns, pagination, search, small filter set, board toggle, Super-Admin export action |
| `src/routes/admin.leads.$id.tsx` | Collapse three query waves into two; no UI redesign |
| `src/routes/admin.leads.new.tsx` | Reachable from Leads; otherwise unchanged |

### 2.4 New — routes

| File | Answers |
|---|---|
| `src/routes/admin.events.tsx` | "How is this event performing?" — leads, pipeline, won revenue (Sponsor-scoped), team, targets |
| `src/routes/admin.team.tsx` | "Who is working what?" — roster, workload, minimal performance, Super-Admin user management |
| `src/routes/admin.settings.tsx` | Audit trail + erasure register, reached from the account menu |

---

## 3. Frontend files proposed for deletion

Only after the replacement screen is built, tested and verified — never before.

| File | Orphaned because | Capability it served | Still reachable? |
|---|---|---|---|
| `src/routes/admin.pipeline.tsx` | Board becomes a view toggle inside Leads | Board layout of the same rows | **Yes** — same RPC, same data |
| `src/routes/admin.targets.tsx` | Targets move inside Events and My Targets | Target setting and progress | **Yes** |
| `src/routes/admin.governance.tsx` | Split: export → Leads, audit + register → Settings | Export, audit trail, erasure register | **Yes** |
| `src/routes/admin.directory.tsx` | Q4 — Leads search replaces browsing; dedupe moves into the lead workflow | People/company browsing, duplicate queue, merges | **Partly** — browsing intentionally reduced |
| `src/routes/admin.forecast.tsx` | Q2 — no forecast UI | Forecast projections | **No** — intentionally unreachable (§O.4) |
| `src/routes/admin.insights.tsx` | Q3 — minimal team info only | Productivity analytics | **Partly** — detail intentionally unreachable (§O.4) |

**No server file is deleted. No domain module is deleted. No test is deleted.**
`forecast.ts`, `productivity.ts`, `directory.ts`, `commission.ts` and their
suites all remain and stay green.

---

## 4. Tests to add and change

### 4.1 New — Team management (`src/server/test/integration/team.test.ts`)

1. Super Admin can create a user; the app row and auth user are consistent.
2. Admin **cannot** create a user — refused server-side.
3. Team Member **cannot** create a user — refused server-side.
4. Role assignment is constrained to the three enum values; anything else refused.
5. Work-function assignment is constrained to the three enum values.
6. Event-scope assignment refuses an event the actor cannot administer.
7. **Scope escalation denied** — an Admin cannot widen their own event scope.
8. **Role escalation denied** — an Admin cannot raise themselves or anyone to Super Admin.
9. An existing user cannot gain scope through a Team mutation they are not authorized for.
10. Deactivated user is denied on the next request and on fresh login (regression).
11. Orphan safety: if the app row fails, the auth user is removed.

### 4.2 New — authorization freshness (`src/server/test/integration/auth-cache.test.ts`)

Guards the one high-risk optimisation. Each proves memoisation does **not** outlive its request:

12. Deactivation takes effect on the very next request.
13. Role change takes effect on the very next request.
14. Event-scope change takes effect on the very next request.
15. Work-function change takes effect on the very next request.
16. Two different users in concurrent requests never share a context.

### 4.3 New — simplified UX guarantees

17. Team Member cannot reach CSV export by direct RPC (UI bypassed).
18. Admin cannot reach CSV export by direct RPC, absent an explicit grant.
19. Delegate-only and speaker-only users receive **no Sponsor monetary values in the payload** — not merely hidden in the UI.
20. Pagination does not widen scope: page N obeys the same predicates as page 1.

### 4.4 Unchanged, must stay green

All 16 integration suites and 8 unit suites, unmodified. **No test will be
weakened or deleted to make the build pass**, including the commission and
forecast suites whose UI is being removed.

---

## 5. Performance plan

### 5.1 Step 1 — verify before optimising

Per your instruction, the mechanism is confirmed before any change:

`getRequest()` **is** exported from `@tanstack/react-start/server`. The intended
key is a `WeakMap<Request, Promise<AuthContext | null>>` — request-scoped *by
construction*, because the key is the request object itself. It cannot be shared
across users, cannot outlive the request, and is garbage-collected with it.
There is no TTL to tune and no global cache.

**One thing still to verify empirically as the first task of Phase 2:** whether
`beforeLoad` and `loader` share a single server request during SSR. If they do,
memoisation removes a full auth resolution on first load. If they do not, J1's
benefit is smaller and **J2 (removing the `me()` waterfall) carries the gain
instead**. This will be measured, not assumed, and the finding reported before
the optimisation lands.

### 5.2 Changes, in order of confidence

| # | Change | Expected effect |
|---|---|---|
| J1 | Request-scoped auth memoisation | −3 DB queries per additional server call in the same request |
| J2 | Remove the `me()` waterfall; return the user from the loader's own call | −1 serial round trip on **every** admin route |
| J3 | Drop the edition list and team standing from the Dashboard's initial load | −2 queries, one a 2-table join across all editions |
| J4 | Fold `suggestions()`' second query into the follow-up query | −1 query |
| J5 | Cursor pagination on the Leads list | Bounded payload as data grows |
| J6 | Collapse the Targets waves | −2 round trips (route is absorbed into Events regardless) |

### 5.3 Before / after

Measured with the identical method: a temporary least-privilege `AUDIT-` account,
5 runs per route, median, against production, deleted immediately afterwards.

| Metric | Before (measured) | Target |
|---|---:|---:|
| Dashboard TTFB | **2,789 ms** | **< 2,000 ms** |
| Dashboard DB round trips | **~14** | **≤ 5** |
| Leads TTFB | 2,350 ms | < 2,000 ms |
| Admin JS + CSS (gzip) | ~148 KB | no regression |
| Serial HTTP waves before data | 2 | 1 |

**Honest caveat.** The baseline was taken with an essentially empty database, so
these are floor values. Phase 2's "after" run must be taken under comparable
conditions or the comparison is meaningless — and the report will say which.

If a target cannot be reached without architectural or schema change beyond this
specification, no workaround will be invented: the measurement, the target, the
reason and the exact blocker will be reported instead.

---

## 6. Deployment sequence

Exactly as specified, with rollback recorded first.

1. **Rollback target recorded:** `dpl_99z6AXwuYVmNa9baR3NseAvbnzkJ` — the current Ready production deployment.
2. Change → run full test suite → **Preview deploy** → verify on the preview URL.
3. Production deploy only after preview passes.
4. Confirm `READY`, correct commit, alias intact.
5. Verify on the production domain: login; Dashboard, Leads, Events, Team; public microsite; **website intake still creates a lead**; **transactional email still sends**.
6. Re-run `npm run verify:db` and confirm schema unchanged, RLS intact, no migration introduced.
7. If production breaks: **roll back immediately** to the recorded deployment; do not debug in broken production.

---

## 7. Live production data — handling rule

A **real inbound lead** arrived during the audit: *Ibrahim / Ibrahim & Co. /
`ibrahim@ibrahimco.com`*, created 3 September 2026 03:32 via the website
prospectus form, with the acknowledgement email delivered (`sent_at` stamped).

**This is genuine business data. It must not be deleted, modified, or used as a
test fixture.** It is useful as the record for measuring Lead detail before and
after — read-only.

No test data will be introduced into production. Any temporary measurement
account is `AUDIT-` prefixed, least-privileged, and removed immediately.

---

## 8. What this plan does not do

No public microsite changes · no email architecture changes · no integrations ·
no analytics, reporting or workflow builders · no AI, notifications, messaging or
calendar · no new roles or permission models · no commission UI · no forecast UI ·
no separate People or Companies directory · **no schema migration**.

**Awaiting final implementation approval. Nothing has been built.**

---

# IMPLEMENTATION RESULT — 3 September 2026

## Deviations from this plan, and why

Three, all recorded rather than quietly taken.

**1. `admin.targets.tsx` was kept, not deleted.** The plan listed it for deletion
with targets moving "inside Events and My Targets". Team Members need a route to
reach My Targets, so deleting this file and creating an equivalent one would have
been churn with a rename. It is now the **My Targets** screen — own targets only,
shown in navigation for team members alone. Managers manage targets inside
Events. Primary navigation still holds exactly four items for managers.

**2. `admin.directory.tsx` was kept, stripped, not deleted.** The plan listed it
for deletion with "duplicate queue and merge/unmerge → inside the Leads
workflow". Deleting it outright would have left decision D7 — *merge reversal
must be genuinely implemented* — with a working, tested backend and **no way for
a person to reach it**. People and company BROWSING is gone as Q4 requires; what
remains is the duplicate queue and the reversible-merge list, retitled
**Duplicates**, out of primary navigation.

**3. The Pipeline board layout is gone, not moved.** The plan said "view toggle
inside Leads". The board was not rebuilt as a toggle. The same rows, the same
scope and the same stage are all present in Leads as a `Status` column with a
work-function filter, but the by-stage column layout no longer exists. This is
the one capability genuinely reduced rather than relocated, and it is listed in
the final report as an acceptance criterion not fully met.

## A pre-existing bug this work exposed

`loadStages` cached its RESULT, not its in-flight promise. The lead form asks for
all three ladders at once through `Promise.all`, so on a cold process all three
callers found an empty cache and raced.

It had been hidden by an accident: the old dashboard called `conversionRates`,
which warmed the cache before anyone reached the form. Making the dashboard
leaner removed that warming, and `/admin/leads/new` began returning 500 —
reproducible from cold module state, and confirmed absent on `e950cc7` only
because of the warming.

Fixed as single-flight (the promise is cached, and a rejection is cleared rather
than kept), which also removes two duplicate queries from that screen.
`pipeline-cache.test.ts` covers it and fails against the old implementation.

## Integration-suite failures that are NOT from this work

23 tests fail. The identical 23 fail on `e950cc7`, proved by running the suite in
a separate git worktree at that commit against the same database.

The cause is the real Ibrahim lead. Those tests assert **whole-table** counts —
`expect(committedRowsAfter["opportunities"]).toBe(0)`, `expect(peopleAfterFirst).toBe(1)`
— which were true only while production held no commercial rows. They are now
permanently false and will stay so.

No test was weakened, deleted, or skipped to accommodate this. The fix is to make
those assertions delta-based (sample before the fixture, compare after), which
`authorization.test.ts` already does for `events`. That is a separate piece of
work and is not in this pass.
