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

## 0. SECURITY LOG

Two findings about the **existing platform**, surfaced while building Radar. Recorded here
because neither belongs to Radar and both would otherwise be lost with this branch.

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
| `src/components/admin/Shell.tsx` | `Radar` added to `NAV`, manager-only | Approved 4 Sep 2026. Takes the admin nav from four destinations to five. |
| `src/server/test/nav.test.ts` | Asserts five, and that a Team Member never sees Radar | That test exists to stop nav creep; moving it deliberately is the point. |
| `src/server/auth/*`, `eslint.config.js` | SEC-1 fix | See the security log |
| `PHASE-2-PLAN.md` | Stale production deployment ID corrected | It named a deployment that had already been superseded |

`schema.ts` was **not** modified. No existing admin route or microsite route was modified.

---

## 6. Verification run

- `npx tsc --noEmit` — clean
- `npx eslint` on all Radar files — clean (one warning matching the existing `admin/primitives.tsx` pattern)
- `npx vitest run` — **257 passed** across 12 files, including 50 Radar boundary tests, 13 Radar
  logic tests and 26 import-boundary tests
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

## 7. Next steps

1. **Preview deploy — ON HOLD, correctly.** Every env var on the Vercel project is scoped to
   **Production only**, so a preview build boots with no `DATABASE_URL` and no Supabase keys and
   fails on configuration rather than on Radar. Before adding them, deployment protection is
   being confirmed: a preview build contains `/admin` and, given Production credentials, would
   point it at the **production CRM** on a URL with a different access posture. That check
   gates the env vars, and the env vars gate the deploy.
2. Promote only after that preview passes. Rollback target is at the top of this file.
3. **Admin forms are narrower than the data model — see §8.** A route cannot be created through
   the UI at all yet, so the three-corridor data entry cannot proceed until that is built.
4. Enter real records through `/admin/radar`. **The database is empty by design** — no figure
   from the brief was seeded, because every one of them was a layout placeholder.

Done since first draft: Radar added to the admin nav (§5).

To reverse the migration entirely: `DROP SCHEMA radar CASCADE;` and remove the `0013` entry
from `drizzle/meta/_journal.json`. Nothing in `public` is involved.

---

## 8. Entering the first three corridors — what the forms ask, and what is missing

Entry order is forced by the foreign keys: **Rail → Provider (+ licences) → Corridor → Route.**
A route references all three, so it is entered last.

Every entity requires a **source URL** and a **verification date**. These are not optional
anywhere: the form marks them required, the server re-checks them, and a CHECK constraint sits
behind that. "Verified by" defaults to the signed-in editor's name if left blank.

### 8.1 Rail — form is complete

| # | Field | Required | Notes |
|---|---|---|---|
| 1 | Name | ● | |
| 2 | Category | | `traditional` · `digital` · `blockchain` · `emerging` |
| 3 | Description | | One or two sentences |
| 4 | Source URL | ● | Scheme rulebook, operator page, or regulator page |
| 5 | Verified on | ● | Defaults to today |
| 6 | Verified by | | Defaults to the signed-in editor |
| 7 | **Is a messaging network** | | Checkbox. **Set this correctly — it changes what routes on this rail may claim.** |
| 8 | Status | | `draft` until checked, then `published` |

Field 7 is the ontological switch. If ticked, the server **refuses** any finality claim on a
route using this rail unless the settlement system conferring finality is named.

### 8.2 Provider — form is a SUBSET of the data model

Asks, in order: **Name ●**, Type, Website, Markets, Assets, Networks, **Source URL ●**,
**Verified on ●**, Status. Then per licence, inline: **Licence name**, **Register URL ●**,
Jurisdiction.

Type is one of `bank · psp · orchestration · stablecoin · fx · custodian · exchange · onramp`.
Markets, Assets and Networks are comma-separated.

**Not yet on the form, though the database holds them:** description, custody model, API type,
API documentation URL, settlement time, settlement hours, settlement fee and provider-level
limits (each with its own source URL), use cases, onboarding requirements, licence reference
number, and "Verified by".

### 8.3 Corridor — form is a SUBSET

Asks, in order: **Origin country ●**, **Origin ISO ●**, **Origin currency ●**,
**Destination country ●**, **Destination ISO ●**, **Destination currency ●**,
**Verified on ●**, Verified by, Status.

The slug is generated once on creation (`united-states-to-brazil`) and never regenerated — it
is the identity of every inbound link.

**Not yet on the form:** destination regulatory constraints and their source URL, and the
corridor-level source URL.

### 8.4 Route — **NO FORM EXISTS**

`saveRoute` is implemented, validated and enforced on the server, and `radar_routes` is
migrated. **The admin screen has no route tab.** A route cannot be created through the UI.

This blocks the three-corridor exercise: without routes, corridors publish with nothing on
them, and the corridor page renders its empty state. The server would accept, in this order:

| Field | Required | Notes |
|---|---|---|
| Corridor, Provider, Rail | ● | Selected from what already exists |
| Type | ● | `bank` · `local` · `stablecoin` · `hybrid` |
| Limit min / max | | Each needs its own source URL |
| Limit currency | ● *if* either limit is set | A bare number is not a limit |
| Settlement finality | | e.g. Irrevocable · Net · Gross. Needs a source URL |
| Settlement system | ● *if* the rail is a messaging network | Names what actually confers finality |
| Operating hours, Cut-off | | Each needs its own source URL |
| Assets, Networks, Requirements | | Comma-separated |
| Source URL, Verified on, Verified by | ● | |
| Status | | |

**Work required before data entry:** build the route tab, and add the missing provider and
corridor fields above. Not started — the branch is held pending preview env vars.
