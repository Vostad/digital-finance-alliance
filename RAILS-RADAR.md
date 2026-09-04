# Rails Radar — V1 build record

**Branch:** `rails-radar` (off `main` @ `8c8d75e`, clean tree)
**Rollback target:** `dpl_5zVrpvzkepwE8BAz9rjrvj2nB74B` — Ready, production, aliased to
`financialrails.org`, created 3 Sep 2026 21:20 IST.
*(This supersedes `dpl_FoVzFh8xiVghzhFi4aL4V9XMWgDA` in `PHASE-2-PLAN.md`, which is stale.)*

**Status:** built, typechecked, linted, 257 tests passing, production build succeeds.
**Migration 0013 APPLIED** to the Supabase database, and the boundary verified against Postgres
by connecting as the `anon` role (§6). Radar tables are **empty by design**.
**Not yet done:** preview deploy — blocked on Preview-scoped env vars (§7).

---

## 0. FINDINGS LOG

Findings surfaced during the build and recorded here so they survive the branch. **SEC-**
entries are security; **GAP-** entries are surface completeness — a thing that was built but
could not be reached.

### SEC-1 — Authorization boundary bypassable by relative import · **CLOSED**

| | |
|---|---|
| **Found** | 3 September 2026, while testing Radar's own import fence |
| **Closed** | 3 September 2026, commit `b97c6b6` |
| **Severity** | High — unscoped CRM read/write, and the service-role client, reachable from any file |
| **Pre-existing** | Yes. Not introduced by Radar. |

`eslint.config.js` describes the authorization boundary as "enforced by tooling", and
`scopedQuery(ctx)` is the control that makes §37 true. The enforcement had a hole: the
`no-restricted-imports` rules used minimatch `group` globs, and `**` does not match an import
specifier beginning with `../`. So the boundary depended on how the import was *spelled*:

```
import { db } from "@/server/db/client"   ->  blocked
import { db } from "../db/client"          ->  NOT blocked
```

It covered all three guarded modules — the raw `db` handle (unscoped access to every CRM
table), `auth/supabase.server` (the service-role client, which bypasses RLS and can mint a
session for any user), and `env.server` (secrets). `src/server/domain/*.ts` sits one directory
from `src/server/db/`, so `../db/client` is the spelling a person reaches for without thinking.

**This matters beyond Radar:** the CRM holds sponsor, delegate and speaker data, and this
system is about to take real traffic around an event.

**How it surfaced:** Radar's own fence was written with the same `group` pattern and was tested
rather than assumed. It failed the test. Checking whether the existing rules shared the defect
showed they did.

**Fix:** all three patterns converted to anchored regexes (`(^|/)db/client$` and equivalents),
which match every spelling and depth. `src/server/test/import-boundary.test.ts` (26 tests)
lints both spellings of all three through the *real* config — not a fixture of it — so
converting them back to globs fails the suite. It also asserts the deliberate exemptions
(`auth/scoped`, `db/client`, the integration fixture) still pass.

Linting all of `src/` after the tightening found **no existing import newly in violation**, so
nothing in the codebase had been relying on the gap. One Radar module (`submissions.ts`) had
been passing lint *only* because of it; that is now an explicit allowlist entry instead of an
accident, so it survives the fix.

### SEC-2 — No privacy policy anywhere on the platform · **OPEN, deliberately not fixed**

| | |
|---|---|
| **Found** | 3 September 2026 |
| **Status** | OPEN. Out of scope for this branch by instruction. |
| **Severity** | Compliance/legal, not technical |

`financialrails.org` has **no privacy route at all**. `src/routes/` contains no `privacy`,
`legal` or `terms` file. The footer link is inert text in every place it appears:

- `src/components/site/Footer.tsx:114` — "Privacy Policy | Terms & Conditions", not a link
- `src/components/site/EventMicrosite.tsx:1035` — same
- `src/components/site/DubaiSummit.tsx:1780` — with a comment saying so outright:
  *"Privacy and Terms have no routes yet, so they stay inert text"*

Meanwhile the platform **is** collecting personal data:

- the public intake endpoint (`src/rpc/intake.ts`) takes name, email, company and role from
  the forums and microsite forms, and opens a CRM record from it
- the CRM holds sponsor, delegate and speaker contact data
- `form_submissions` retains the raw submission verbatim

`/radar/privacy` was written for Rails Radar only, because Radar collects an email address on
two forms and a footer link pointing nowhere on a page that collects personal data is worse
than no link. It is **deliberately scoped to Radar** and does not speak for the platform —
asserting site-wide commitments would mean inventing them.

**To close:** a real site-wide privacy policy, routed, with the three inert footer links
pointed at it. Worth doing before the event drives traffic to the forms.

---

### GAP-1 — Server mutations shipped with no way to reach them · **CLOSED**

| | |
|---|---|
| **Found** | 4 September 2026, **before any real data was entered** |
| **Closed** | 4 September 2026 |
| **Severity** | Functional. Nothing broke; things silently could not be done. |

Two related defects, both invisible to every check that existed:

**`saveRoute` had no screen.** It was implemented, validated, ontology-enforced and migrated —
and the admin surface had no route tab at all. Types passed, lint passed, the build passed,
257 tests passed. A route could not be created by any means. Radar's central object is the
route; a corridor without one renders its empty state, so the product could not hold data.

**No upsert could edit.** Every form called its `save*` with `id: null`, so all five entities
could be created and none corrected. The consequence was worse than it sounds: the
re-verification queue surfaces stale records **and re-verifying one is an edit**, so the queue
was decorative. An accepted inaccuracy report could never be acted on either. Records could
also never move `draft → published` after creation.

**Why nothing caught it.** Every existing check verifies that what exists is *correct*. None
verified that what exists is *reachable*. A server function with no caller is well-typed,
lint-clean and fully tested in isolation — it simply never runs.

**Fix.** Route tab built, with per-corridor drill-down and structural-history entry; edit paths
added for rail, provider, corridor, route and licence; licence delete wired.
`src/server/test/admin-reachability.test.ts` (35 tests) now parses every `createServerFn` in
the Radar RPC surface and fails if one has no UI reference, asserts every upsert passes an
existing id, and re-asserts that reviewing a submission still cannot write to a live record.

**Follow-on:** the two read endpoints left unreferenced here — `railIndex` and `providerIndex` —
were closed by **GAP-2**, and the test itself was generalised beyond Radar under **GAP-3**.
Radar's own surface now carries no debt entry of any kind, and the suite asserts that.

### GAP-2 — Orphan detail pages, and the rails index as the answer · **CLOSED**

| | |
|---|---|
| **Found** | 4 September 2026 |
| **Closed** | 4 September 2026 |
| **Severity** | Distribution. The corridor-page SEO strategy is the whole traffic thesis. |

Rail and provider **detail** pages were in the sitemap with **nothing linking to them**. Until a
corridor publishes, no page on the site points at either, and a page nothing links to is a page
that does not get indexed — a sitemap entry is a hint, not an internal link.

Two index pages close it, and every Radar page now links to both from the header.

`/radar/providers` is deliberately plain: name, type, last verified. It exists to give every
profile an internal link, not to be a second search product.

`/radar/rails` is **written as a reference**, because it can be. "What are payment rails" is a
real informational query, and the honest answer to it is a correct taxonomy — which this product
already has to get right internally:

> A rail moves value. An asset is what moves. A network is what it moves over. A messaging
> system is not a settlement system.

Almost everything written on this subject conflates at least two of those. Setting the four out
plainly, with every rail correctly categorised and messaging networks visibly separated from
settlement systems, is a better page than any explainer written around the brand — and it is
generated from the same rows the rest of the product is verified against. The taxonomy is
definitional and makes no claim about any named system; those come from rows, each with its
own source.

Both are in the generated sitemap, and both were removed from the reachability debt list.

### GAP-3 — Twelve orphaned server functions in the CRM · **OPEN, for your decision**

| | |
|---|---|
| **Found** | 4 September 2026, generalising the reachability test beyond Radar |
| **Status** | CLASSIFIED 4 Sep 2026, handed to the simplification run. Not actioned in this branch by decision. |
| **Severity** | Dead code. Not an open door — every one is still authenticated and authorized server-side. |

Generalising the reachability check across all of `src/rpc` (72 functions, 10 modules) found
**12 functions with no UI reference at all**. Most were almost certainly orphaned by the Phase 2
admin simplification, which cut the navigation from eight destinations to four: the screens
went, the server functions stayed. That is the exact failure mode this test now guards.

**Eight are reads** — they compute and return, nothing more: `emailStatus`, `forecastView`,
`productivityInsights`, `productivityMetrics`, `recordHistory`, `owners`,
`searchPeopleAndCompanies`, `workstreamsForPerson`.

**Four are genuine writes**, each verified by reading the domain function it calls rather than
inferring from the HTTP method:

| Function | Writes via | |
|---|---|---|
| `setProbability` | `overrideProbability` | `forecast.ts:229` |
| `setCommissionSplit` | `setSplit` | `assignment.ts:113` |
| `changeTarget` | `updateTarget` | `targets.ts:110` |
| `retryEmail` | `drainOutbox` | `email.ts:149` |

Two names mislead and were checked individually: **`recordHistory` only reads** (`historyFor`),
and **`emailStatus` only reads** (`outboxSummary`). HTTP method is not a reliable signal here —
most of the reads use POST to pass parameters — so `kind` in the debt list is a human judgement,
recorded per entry.

#### Decision, recorded 4 September 2026 — all of it is CRM work for the simplification run

**None of this is actioned in the Radar branch.** GAP-3 belongs to the pending admin
simplification, which audits exactly this surface; this log is handed to it as an input so the
twelve orphans do not have to be rediscovered.

| | Function | Rationale |
|---|---|---|
| **WIRE** | `changeTarget` | Targets can be created and never changed — the same create-only failure found in Radar, sitting in the CRM. A Super Admin sets a target in January and cannot revise it. Not optional. |
| **WIRE** | `emailStatus` + `retryEmail` | Together, in one small screen. The outbox has no status view and no retry, so the email system is **completely unobservable from the UI**. A prospectus request that silently fails to send is a lost sponsor lead nobody finds out about. |
| **DEFER** | `setProbability` | A specified feature, not dead code. Wire it **when there is a real pipeline to forecast** — probability override is meaningless against an empty or trivial pipeline. Stays grandfathered until then. |
| **DEFER** | `setCommissionSplit` | A specified feature, not dead code. Wire it **the first time two people share a deal** — a split has no meaning with a single owner. Stays grandfathered until then. |
| **LEAVE** | the eight reads | Harmless, and the simplification may wire some of them. Deleting now creates churn against a rewrite that has not happened. |

**Note for whoever runs the simplification:** `GRANDFATHERED_WRITES` in
`src/server/test/rpc-reachability.test.ts` still names all four. Wiring `changeTarget` or
`retryEmail` will fail the suite until its entry is removed from `KNOWN_UNREFERENCED` — that is
the intended pressure, not a bug. `emailStatus` is a read and sits in the read section of the
same list.

#### Outbox checked live, 4 September 2026 — nothing is stuck

Run because the microsite forms are live and a silent send failure would be invisible. Read-only,
no writes, addresses not printed.

```
email_outbox        1 row   ·   sent 1   ·   pending 0   ·   failed 0
                    kind prospectus_delivery, 1 attempt, no error
                    2026-09-03T03:32:47Z
form_submissions    1 row   ·   2026-09-03T03:32:38Z
```

The submission and the send are nine seconds apart, so the intake → outbox → provider path
worked end to end. **"Sent" here is a real delivery, not a default:** `sent_at` is written only
when the provider returns `ok` (`src/server/domain/email.ts:96` returns
`"no provider configured"` and writes `last_error` instead when the keys are absent), and this
row has one attempt and a null error.

Two things this does **not** show, stated so the reassurance is not read too widely:

- volume is one message. This is a configuration test passing, not a system proven under load.
- `EMAIL_PROVIDER_API_KEY` and `EMAIL_FROM_ADDRESS` are **absent from the local `.env`** and set
  in **Vercel Production only**. Anything run locally against this database cannot send, and a
  local `emailSent: false` means nothing about production.

That single row is the argument for wiring `emailStatus` + `retryEmail`: the system currently
works, and there is no way to see that it works, so the first failure will be found by a sponsor
who never got their prospectus.

**Frozen, so it can only get better.** `GRANDFATHERED_WRITES` in
`src/server/test/rpc-reachability.test.ts` names exactly these four. Adding a fifth fails the
suite — that is what makes "a mutation may never be parked on the debt list" enforceable rather
than a convention. Verified by negative test in both directions: a new orphaned mutation fails,
and so does an entry that has been wired up and left on the list.

### GAP-4 — `email_outbox` does not record which address sent · **OPEN, for the simplification run**

| | |
|---|---|
| **Found** | 4 September 2026, verifying DNS against the one delivered message |
| **Status** | OPEN. Recorded, not fixed — CRM code, and a simplification pass is pending. |
| **Severity** | Auditability. Nothing is wrong with delivery; the record of it is incomplete. |

`email_outbox` stores `to_email`, `subject`, `body`, `payload`, `sent_at`, `failed_at`,
`last_error` and `attempts`. It does **not** store the address the message was sent *from*, and
`payload` on the one live row holds only `name` and `company`.

The sending address comes from `EMAIL_FROM_ADDRESS`, read at send time from the environment
(`src/server/domain/email.ts:95`). Change that variable and every historic row silently
re-describes itself: the outbox will claim messages were sent from an address they were not.

**Why it matters here specifically.** This platform's whole argument is that a claim carries the
evidence for it. Asked "which address sent the 3 September prospectus", the answer had to be
*read the environment variable in the Vercel dashboard and assume it has not changed since* —
which is exactly the kind of answer Rails Radar exists to refuse. A provenance-first system that
does not record the provenance of its own outbound mail is inconsistent with itself.

It is also operationally real: the moment a second sending identity exists — a summit address, a
different subdomain, a provider migration — historic rows become unattributable, and a
deliverability problem cannot be traced to the identity that caused it.

**Fix, when the simplification runs:** add `from_email text` to `email_outbox`, populate it at
queue or send time from the same value handed to the provider, and surface it on the outbox
screen being built for `emailStatus` + `retryEmail` (GAP-3). Backfilling the single existing row
is optional and probably not worth it; a null there is honest.

### NOTE — email keys are deliberately absent from Preview

Not a gap. Recorded because it will otherwise look like one, and someone will "fix" it.

`EMAIL_PROVIDER_API_KEY` and `EMAIL_FROM_ADDRESS` are scoped to **Production only** and are
deliberately **not** added to Preview or local environments.

`sendViaResend` returns `"no provider configured"` when either is missing
(`src/server/domain/email.ts:96`) and writes `last_error` rather than `sent_at`, so a preview
build **physically cannot deliver mail to a real person**. Preview deployments run the same
intake path as production against the same database; without this, testing the prospectus form
on a preview URL would email an actual sponsor from an actual address.

The message still queues, so the path is fully exercisable — what is withheld is only the ability
to hand it to a provider. That is the correct default, not an omission. **Do not add these two
variables to Preview.**

### GAP-5 — Two defaults that were wrong rather than absent · **CLOSED**

| | |
|---|---|
| **Found** | 4 September 2026, first hands-on use of the preview |
| **Closed** | 4 September 2026 |
| **Severity** | One display, one data integrity. |

Both shipped through typecheck, lint, build and 334 tests, because neither is a missing value —
each is a **default that is wrong**. Nothing threw.

**1 · `/admin/radar` drew a Team Member's navigation for a Super Admin.**
`<Shell>` takes an optional `role` and falls back to `navFor("team_member")`. `admin.radar.tsx`
never passed it, so the same session showed all five destinations on `/admin` and "My Leads · My
Targets" on `/admin/radar`. A display bug, not an authorization one — every RPC still resolves
identity server-side and refuses independently — but a nav that misreports who you are is not
acceptable either. `radarOverview()` now returns the viewer and the route passes the role.

**2 · Verification dates were stamped in UTC.**
Date defaults used `toISOString()`. An editor in GST+4 at 01:30 on the 4th is at 21:30 UTC on the
3rd, so **every record entered in the evening was dated a day early**. On a product whose whole
claim is "verified on this date, against this source", that is a data-integrity bug wearing the
costume of a formatting nit — and it would have been baked into the first real corridor. Dates
are now built from local calendar parts, for new records and when editing existing ones.

**Neither was catchable by a type.** `role` is legitimately optional; both date expressions are
well-typed strings. `src/server/test/admin-shell-contract.test.ts` covers both, and was
negative-tested in each direction.

**Found while writing it — recorded, not fixed:** `admin.leads.$id.tsx` renders
`<Shell title="Not found">` with no role on its not-found early return, so that one screen draws
the wrong nav for everybody. Its main render is correct. Real but minor, and CRM code — this
branch is kept clean of CRM edits, so it is an explicit exception in the test rather than a
silent pass. One line closes it when that file is next opened.

### PERF-1 — The Radar admin's first paint · **FIXED**

| | |
|---|---|
| **Found** | 4 September 2026, reported as "the admin is loading slowly" |
| **Fixed** | 4 September 2026 |
| **Cause** | Request waterfall and over-fetching. **Not** cold start, **not** the SSO challenge. |

#### What it was, measured before guessing

| | `/admin` | `/admin/radar` |
|---|---|---|
| server-function calls | 1 | **5, in 2 sequential waves** |
| authorization resolutions | 1 | **5** |
| DB queries before first paint | dashboard's own | **~17** |

Each of the five ran `requireRadarEditor()` independently. They arrive as five separate HTTP
requests, so the request-scoped memoisation in `context.ts` cannot help across them — measured at
**56ms each**, ~280ms of pure re-authentication before any data moved.

**Three of the five served tabs that were not open.** The default tab is the submission queue;
corridors, rails and providers — nine queries and three authorizations, including a five-way
fan-out over provider child tables — rendered nothing on arrival.

`listCorridorsForAdmin` also carried a correlated subquery per row: an N+1 written in SQL.

#### Ruling out the other two candidates

- **Not cold start.** Production warm TTFB is flat across static and DB-touching pages —
  `/intelligence` 455ms, `/admin` 456ms, `/` 473ms. No cold-start signature. The ~450ms is
  distance to the region, identical for every route.
- **Not SSO.** The challenge is an edge redirect, identical for `/admin` and `/admin/radar`, and
  the difference is visible *within* an authenticated session. Constant, so not the variable.
- **The database is empty.** These are round-trip counts, not data volume — which means the cost
  would not have improved as records were added. It would have got worse.

#### The fix

One `radarScreen()`: one authorization, one `Promise.all`, returning exactly what the screen
paints — the viewer, the headline counts, the **stale counts** (not rows), and the queue. Every
other tab fetches when it is opened, once, via `useLazy`. The corridor drill-down takes one
`routeContext()` call for its routes plus the provider and rail lists its form selects from —
lists that previously loaded on every visit to populate a form most visits never open. The
correlated subquery became a `LEFT JOIN … GROUP BY`.

#### Measured, production build, same method both times

| | Before | After |
|---|---|---|
| server-function calls | 5 (2 waves) | **1** |
| authorization resolutions | 5 | **1** |
| DB queries at first paint | ~17 | **9**, all parallel |
| DB time | 294ms | **169ms** |
| HTTP waves | 2 | **1** |
| cost of the removed wave | — | **456ms** |
| **total removed per load** | | **~580ms** |

Baseline for scale: one round trip to the pooler is 54ms; one HTTP round trip to the function is
~456ms from the measuring location.

#### Not done, deliberately

No schema, auth, RLS or authorization change. **The admin simplification was not started** — this
is confined to how the Radar screen loads its own data. The CRM dashboard was measured for
comparison and not touched.

The reachability suite caught a consequence of the refactor immediately: `submissionQueue` became
orphaned once `radarScreen` returned the queue inline. Deleted rather than parked — the Radar
surface carries no debt entries, and the test asserts that separately.

### DOMAIN — Radar moved to railsradar.com, one codebase · 4 September 2026

Radar is published on **railsradar.com**; the platform stays on financialrails.org. Same
deployment, same route tree, same admin login. No split.

#### The mechanism, and why a plain rewrite would not have worked

The instruction was to "scope the rewrite". A server-side rewrite alone would have broken on the
first click: the **client** router builds its location from `window.location`, so it would look
for `/corridors`, find no such route, and 404 on navigation while SSR looked fine.

TanStack Router has a `rewrite` option — a `{ input, output }` URL pair that runs on the server
**and** in the browser:

```
input   railsradar.com/corridors  ->  /radar/corridors     (what the router matches)
output  /radar/corridors          ->  /corridors           (what the browser is shown)
```

So the route files stay `radar.*`, `index.tsx` is untouched, and nothing is renamed. It is
host-conditional, so financialrails.org is byte-for-byte unaffected.

**Consequence worth knowing:** every Radar link must be a `<Link>`, never a bare `<a href>` — an
anchor bypasses `output` and would emit a path that only resolves on the other origin. Ten
anchors were converted, and a test now fails if one comes back.

#### A bug found in this work, by reading rendered HTML

The scoping check first ran against the *internal* path. The input rewrite puts `/radar` in
front of everything on that host, so "starts with /radar" was **always true** — the redirect
branch was unreachable, and `railsradar.com/forums` would have 404ed rather than going home. It
surfaced from a rendered `/contact` link in the Radar shell, not from any check that existed.
Scoping is now judged on the public path against a named segment list, and is the regression
case in `two-origin.test.ts`.

#### What changed

| | |
|---|---|
| `src/lib/radar-host.ts` | **new** — origins, the rewrite pair, the scoping predicate, `radarUrl()` |
| `src/router.tsx` | `rewrite: radarRewrite` |
| `src/server.ts` | cross-origin 301s both ways; robots.txt and sitemap on the Radar origin |
| `src/routes/__root.tsx` | bare layout now host-aware as well as path-aware |
| `src/routes/radar*.tsx` | canonicals and `og:url` → railsradar.com; 10 anchors → `<Link>` |
| `src/components/radar/Shell.tsx` | Contact points absolutely at the platform |
| `src/server/radar/sitemap.ts` | emits `railsradar.com`, prefix-free |
| `src/routes/admin.radar.tsx` | links to the public site are absolute |
| `vite.config.ts` | dev `allowedHosts`, so two-origin behaviour is testable locally |

#### What did NOT change

No schema, no auth, no RLS, no authorization. No route renamed, no site page touched, no
rebrand — Radar keeps the existing tokens. **The admin stays at
financialrails.org/admin/radar**, behind the one login, and railsradar.com/admin 301s away from
it rather than serving a second front door.

#### If railsradar.com is later moved to its own app

Cheap, because the seams are already drawn:

- **Carries over unchanged:** every `radar.*` route, `src/server/radar/*`, `src/rpc/radar*.ts`,
  `src/components/radar/*`, the `radar` Postgres schema, and migration 0013.
- **Breaks and needs attention:** the `radar` schema lives in the platform's database, so a
  separate app needs either its own connection to that database or a data move — and the
  published-only views and the `anon` grants go with it. `src/lib/radar-host.ts` and the router
  rewrite become dead: the new app serves Radar at its own root and the prefix disappears, so
  every internal `/radar/...` path shortens by one segment. Public URLs do **not** change, which
  is the point of doing the move now. The 301s in `src/server.ts` must stay on the platform
  forever. The admin would have to be rebuilt or kept on the platform, and it shares
  `requireAuth`, `Shell` and the admin primitives — that is the largest single cost.
- **Do not** let the corridor slugs change. They are the identity of every inbound link.

## 1. Decisions taken, and by whom

| Decision | Outcome |
|---|---|
| Where it lives | `financialrails.org/radar`, inside this app — approved |
| Design language | Existing tokens, typography, `--radius: 0rem` — approved |
| Public DB access | One narrow read module with its own eslint entry — approved |
| RLS conflict (below) | Separate `radar` schema + published-only views — approved |

### The accent, corrected

An earlier read of this repo reported the accent as `#0066FF`-family. That was the `:root`
fallback `oklch(0.52 0.17 252)` = `#0069C6`, which is **overridden on every page**.
`ACTIVE_PALETTE = AI_ACCORD_ORANGE_EXPERIMENT` (`src/lib/accord-palette.ts:29`) re-points
`--accent` to `--accord-orange`. The live values are **`#7C7FFF`** on dark and
**`#3D3FA0`** (`--accord-orange-deep`) on light. Radar uses tokens only, never hex, so the
palette switch keeps working.

Two traps in `src/styles.css` worth knowing: the block is *named* `orange-experiment` and its
comment says "the #D8663A signature-orange palette", but the values under it are periwinkle.

---

## 2. The RLS conflict, and how it was resolved

Radar needs public read enforcement in the database. Two existing guards forbade exactly that:

- `src/server/test/rls-coverage.test.ts:63` asserts **`CREATE POLICY` appears in no migration**
  — "deny by omission is the whole design".
- `drizzle/0003` **raises on deploy** if `anon` holds any table privilege in `public`.

**Resolution: Radar lives in its own `radar` Postgres schema.**

- `0003` only inspects `public`, so it stays exactly as strict — untouched.
- Radar keeps the same design: RLS on, **zero policies**. `rls-coverage` — untouched.
- Public read is granted on **views that hardcode `WHERE status = 'published'`**, never on a
  base table. A policy is a predicate someone can write permissively; a view cannot return a
  row its own SELECT list does not produce.
- `v_routes` requires route, corridor, provider **and** rail all published — a published route
  on a draft provider would otherwise leak that provider's name.
- `radar_submissions` has **no view and no grant**, and the migration raises if one appears.

Honest statement of the model, in the same terms `0001` uses: the app connects as table owner
and is exempt from RLS. **RLS closes the anon/PostgREST surface; the hardcoded filter in
`src/server/radar/public.ts` governs the application path.** Both, not either.

---

## 3. A pre-existing hole found while testing the fence

Recorded in full as **SEC-1** in the security log above: the authorization boundary was
bypassable by spelling an import relatively rather than through the alias. Found 3 September
2026 while testing Radar's own fence, closed the same day, covered by
`src/server/test/import-boundary.test.ts`.

`src/server/radar/*.ts` are allowlisted **explicitly** rather than passing by accident through
that gap, so they were unaffected by the tightening.

## 4. What was built

**Data** — `src/server/db/radar.ts`, `drizzle/0013_rails_radar.sql`
15 tables in schema `radar`. No array columns (the pooler runs `fetch_types: false`; an array
column reintroduces a catalog round trip that hangs requests) — multi-value fields are child
tables. Every sourced value carries `_source_url/_source_type/_verified_at/_verified_by` and a
CHECK making a value-without-source unstorable. `register_url` is NOT NULL and CHECKed
non-empty. A limit without its currency is refused.

**Server** — `src/server/radar/`
- `public.ts` — the only unauthenticated read path. Radar tables only, published rows only via
  a module constant (never a parameter), no write path, all four join conditions on routes.
- `submissions.ts` — the moderation gate. Honeypot, minimum fill time, DB-counted rate limit,
  hashed IP. Always inserts `pending`.
- `admin.ts` — every write, all behind `requireRadarEditor()`. Refuses a finality claim on a
  messaging network unless the settlement system is named.
- `sitemap.ts`, `slug.ts`.

**Routes** — `/radar`, `/radar/corridors`, `/radar/corridors/$slug`, `/radar/providers/$slug`,
`/radar/rails/$slug`, `/radar/privacy`, `/admin/radar`.

**Sitemap** — generated from rows at `/radar/sitemap.xml`, added to `robots.txt`. Only corridors
**with at least one published route** are listed; empty corridors render on demand and carry
`noindex, follow`, so thin content never enters the index.

---

## 5. Files outside `src/server/radar` and `src/routes/radar*` that changed

| File | Change | Why |
|---|---|---|
| `eslint.config.js` | Two **added** blocks | Radar's fence. The existing rule is unmodified. |
| `drizzle.config.ts` | `schema` array, `schemaFilter` + `"radar"` | drizzle-kit manages radar too |
| `src/server.ts` | Sitemap interception | Generated sitemap; same position as the canonical redirect |
| `src/routes/__root.tsx` | `isRadar` added to `bare` | Radar carries its own chrome, like the micro-sites and the OS. Scoped to `/radar`; verified no existing route changed. |
| `public/robots.txt` | Second `Sitemap:` line | Discovery |
| `src/components/admin/Shell.tsx` | `Radar` added to `NAV`, manager-only, behind a divider | Approved 4 Sep 2026. Five destinations, with `group` separating Radar from the four CRM items so it reads as a different product sharing the admin — the CRM shape stays visually four, and a sixth CRM destination still argues against four. |
| `src/components/admin/RadarForms.tsx` | New — all Radar editing forms | GAP-1 |
| `src/routes/radar.rails.index.tsx` | New — the rails reference page | GAP-2 |
| `src/routes/radar.providers.index.tsx` | New — the provider index | GAP-2 |
| `src/server/test/rpc-reachability.test.ts` | Renamed from `admin-reachability`, widened to all of `src/rpc` | GAP-3 |
| `src/server/test/nav.test.ts` | Asserts five, and that a Team Member never sees Radar | That test exists to stop nav creep; moving it deliberately is the point. |
| `src/server/auth/*`, `eslint.config.js` | SEC-1 fix | See the security log |
| `PHASE-2-PLAN.md` | Stale production deployment ID corrected | It named a deployment that had already been superseded |

`schema.ts` was **not** modified. No existing admin route or microsite route was modified.

---

## 6. Verification run

- `npx tsc --noEmit` — clean
- `npx eslint` on all Radar files — clean (one warning matching the existing `admin/primitives.tsx` pattern)
- `npx vitest run` — **390 passed** across 15 files: 50 Radar boundary, 13 Radar logic,
  26 import-boundary, 76 rpc-reachability, plus the pre-existing suites
- `npm run build` — succeeds; `check:client-bundle` finds no secrets
- SSR verified locally: `/radar`, `/radar/corridors`, `/radar/privacy`, `/radar/sitemap.xml` all 200
- `/admin/radar` unauthenticated — **307 to `/admin/login`**, no admin data in the response
- Existing routes re-checked — site chrome intact on `/`, `/about`, `/forums`

### Verified against the live database, after applying 0013

```
radar base tables            15,  all with RLS,  policies: 0
radar views                  14,  anon may read all 14
anon on radar BASE tables    NONE
anon on radar_submissions    NONE
public tables                unchanged; anon in public: NONE   (0003 intact)
radar_ tables in public      none
```

Then, connected **as role `anon`**:

| Attempt | Result |
|---|---|
| `select from radar.radar_rails` | **denied** 42501 |
| `select from radar.radar_providers` | **denied** 42501 |
| `select from radar.radar_submissions` | **denied** 42501 |
| `insert into radar.radar_submissions` | **denied** 42501 |
| `select from radar.v_rails` | allowed |
| `select from radar.v_routes` | allowed |
| `select from public.opportunities` | **denied** 42501 |

Route status codes against the real tables:

| Path | Status |
|---|---|
| `/radar`, `/radar/corridors`, `/radar/privacy`, `/radar/sitemap.xml` | 200 |
| `/radar/corridors/us-to-brazil` (absent) | **404** |
| `/radar/providers/nobody`, `/radar/rails/nothing` | **404** |

The soft-404 risk is closed: a loader-thrown `notFound()` returns a real 404, so absent
corridors will not be indexed as thin duplicates.

Footer renders `0 rails tracked · 0 providers · 0 corridors · 0 routes` — from actual rows.
The sitemap lists only the two index pages, because no corridor has a published route yet.

---

### Preview protection — verified empirically, 4 September 2026

The Vercel API reports `ssoProtection: {"deploymentType": "all_except_custom_domains"}`, with no
password protection, no trusted IPs and **no protection-bypass token**. That was then confirmed
against real preview URLs rather than trusted:

```
preview  digital-financa-5lifdt2dt…vercel.app   302 -> vercel.com/sso-api   (logged out)
preview  digital-financa-furzcy4ky…vercel.app   302 -> vercel.com/sso-api   (logged out)
custom   financialrails.org                     200                          (public, correct)
```

The challenge is a **302 redirect to Vercel SSO, not a 401** — worth knowing, because a check
that asserts `401` would wrongly report protection as absent.

### Git state, 4 September 2026

| Ref | Commit | Note |
|---|---|---|
| `origin/main` | `e950cc7` | **untouched** — production branch, not pushed to |
| `origin/phase-2-local-backup` | `8c8d75e` | backup of the local-only Phase 2 commit; a different ref name, so it deploys as preview, never production |
| `origin/rails-radar` | this branch | pushed, tracking set |

Vercel is git-connected (`Vostad/digital-finance-alliance`, production branch `main`,
`createDeployments: enabled`), so **both pushes automatically created preview deployments**.
Neither touched `main`, so production still runs the rollback target at the top of this file.

## 7. Next steps

1. **Preview deploy — ON HOLD, correctly.** Every env var on the Vercel project is scoped to
   **Production only**, so a preview build boots with no `DATABASE_URL` and no Supabase keys and
   fails on configuration rather than on Radar. Before adding them, deployment protection is
   being confirmed: a preview build contains `/admin` and, given Production credentials, would
   point it at the **production CRM** on a URL with a different access posture. That check
   gates the env vars, and the env vars gate the deploy.
2. Promote only after that preview passes. Rollback target is at the top of this file.
3. Enter real records through `/admin/radar` — the forms are complete (§8) and GAP-1 is closed. **The database is empty by design** — no figure
   from the brief was seeded, because every one of them was a layout placeholder.

Done since first draft: Radar added to the admin nav (§5).

To reverse the migration entirely: `DROP SCHEMA radar CASCADE;` and remove the `0013` entry
from `drizzle/meta/_journal.json`. Nothing in `public` is involved.

---

## 8. Entering the first three corridors

Entry order is forced by the foreign keys: **Rail → Provider (+ licences) → Corridor → Route.**
Every entity requires a **source URL** and a **verification date** — enforced in the form, again
on the server, and again by a CHECK constraint. "Verified by" defaults to the signed-in editor.

All forms below now exist, and all support **create and edit**. Editing is what re-verification
is: open the source, confirm it still says what was recorded, save with today's date.

| Entity | Fields |
|---|---|
| **Rail** | Name●, Category, Description, Source URL●, Verified on●, Verified by, **Is a messaging network**, Status |
| **Provider** | Name●, Type, Website, API docs URL, Markets, Assets, Networks, Custody model, Onboarding requirements, then paired value+source for Settlement time / Settlement hours / Fees / Limits, then Source URL●, Verified on●, Verified by, Status |
| **Licence** | Licence name●, **Register URL●**, Jurisdiction, Reference number, Verified on●, Verified by |
| **Corridor** | Origin country●, Origin ISO●, Origin currency●, Destination country●, Destination ISO●, Destination currency●, Destination constraints + source, Verified on●, Verified by, Status |
| **Route** | Provider●, Rail●, Route type, Limit currency, Min limit + source, Max limit + source, Settlement finality + source, **Settlement system**, Operating hours + source, Cut-off + source, Assets, Networks, Requirements, Source URL●, Verified on●, Verified by, Status |

Routes are entered from the **Corridors** tab — open a corridor, then "New route". Structural
history is entered from the same place.

**Three rules the forms enforce as you type, before the server has to refuse:**

- a figure with no source URL highlights and will not publish — clearing both is fine, and puts
  the field back to "Not published"
- a limit with no currency highlights — a bare number is not a limit
- **finality on a messaging network** highlights until the settlement system is named, saying
  which rail is the messaging network and why

**Deliberately not built:** fields no V1 page renders — provider description, API type, use
cases. The schema holds them; asking for data nobody will see is how an admin surface stops
being filled in accurately.
