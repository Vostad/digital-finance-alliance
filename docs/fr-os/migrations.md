# Migrations — one tool, and which one

**drizzle-kit owns the schema. The Supabase CLI never writes DDL.**

Requirement 5 asked for one migration tool and a statement of which. This is it.

## Why drizzle-kit and not the Supabase CLI

The schema is already expressed in TypeScript, in `src/server/db/schema.ts`, because
the application queries it through Drizzle. If the Supabase CLI owned migrations,
that file would become a hand-maintained mirror of the real schema — and a mirror
drifts. The first time it drifts silently, a query compiles, deploys, and fails in
production against a column that is not there.

With drizzle-kit, the TypeScript file *is* the schema. `drizzle-kit generate` diffs
it against the recorded snapshot and writes the SQL. There is one source of truth
and the migration is derived from it.

The trade is that `supabase db push`, `supabase migration new` and `supabase db diff`
are off the table, and so is the Studio SQL editor for anything that changes
structure. That is a real constraint and it is the point: two tools writing DDL to
one database is how migration history stops being a history.

## The rule this imposes

**Never run DDL through the Supabase dashboard's SQL editor.** Not a quick column,
not a quick index, not "just this once". drizzle-kit's snapshot in `drizzle/meta/`
will not know about it, the next `generate` will diff against a schema that no
longer matches reality, and the migration it writes will be wrong in a way nobody
reads carefully enough to catch.

If you need a change, change `schema.ts` and generate.

## Commands

```bash
npm run db:generate    # schema.ts changed → write the SQL
npm run db:migrate     # apply pending migrations (uses DIRECT_DATABASE_URL —
                       # the SESSION-mode pooler, port 5432, not db.<ref>...)
npm run db:studio      # browse data
```

## What is in `drizzle/`

| File | What it is | Generated? |
|---|---|---|
| `0000_initial_schema.sql` | 23 tables, 37 foreign keys, indexes, check constraints | generated, then hand-edited once — see below |
| `0001_rls_default_deny.sql` | RLS on every table, zero policies, grants revoked | hand-written |
| `0002_seed_pipeline_reference.sql` | Pipeline stages and loss reasons | hand-written |
| `0003_rls_guarantee_assertions.sql` | Asserts the privilege that actually gates anon access | hand-written |
| `meta/` | drizzle-kit's snapshots and journal | generated — never edit |

### The one hand edit in `0000`

`schema.ts` declares `auth.users` so the foreign key from `public.users.id` can be
expressed. drizzle-kit does not know Supabase already created that table, so it
emitted `CREATE TABLE "auth"."users"`. That statement was replaced with an
assertion that the table exists — so pointing these migrations at a plain Postgres
fails immediately with a readable message instead of halfway through.

The foreign key itself was left in place. `src/server/test/rls-coverage.test.ts`
checks both facts, so the edit cannot be silently undone by a regeneration.

### Why `0003` exists

`0001` asserts that RLS is enabled and no policy exists. That is necessary and
not sufficient: what actually stops the anon key is having **no table
privilege**, and the obvious way to check the schema half —
`has_schema_privilege('anon','public','USAGE')` — answers `TRUE` no matter what
you revoke, because Postgres grants USAGE on `public` to `PUBLIC` and that
function resolves inherited privileges.

`0003` asks the questions that have real answers: no table privileges for
`anon`/`authenticated`, and no *direct* schema grant to either. PUBLIC's
inherited USAGE is left alone deliberately — schema USAGE permits nothing on
its own, and revoking it from PUBLIC would affect Supabase's own managed roles
for no measurable gain.

Verified empirically as well: every PostgREST request with the anon key returns
`42501 insufficient_privilege`, on reads and writes alike.

## Order matters

`0001` must stay after `0000` and must never be squashed into it. It ends with a
`DO` block that raises if any table in `public` is missing RLS — which means the
guarantee is verified by Postgres on every deploy rather than by whoever last
remembered to look.

## Adding a table

1. Add it to `schema.ts`.
2. Add its name to `APPLICATION_TABLES` in the same file.
3. Add an `ALTER TABLE … ENABLE ROW LEVEL SECURITY` line to a **new** migration.
4. `npm run db:generate && npm test`.
5. `npm run db:migrate && npm run test:integration`.

Step 3 is not optional and step 4 is what catches you if it is skipped: the test
suite compares `APPLICATION_TABLES` against the RLS migration and fails on a
mismatch, before any database is involved.
