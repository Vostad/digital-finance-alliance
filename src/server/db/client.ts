/**
 * The database handle. ONE per process, lazily created.
 *
 * Import rule, enforced by eslint: application code NEVER imports `db` from
 * here. It goes through `scopedQuery(ctx)` in src/server/auth/scoped.ts, which
 * is the single place authorization is applied. The only legitimate importers
 * are the scoped layer itself, migrations, and tests.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnv } from "../env.server";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | undefined;
let instance: ReturnType<typeof drizzle<typeof schema>> | undefined;

function connect() {
  if (instance) return instance;

  client = postgres(serverEnv.databaseUrl, {
    /**
     * MANDATORY on the transaction pooler. In transaction mode a connection is
     * handed to a different client after every statement, so a named prepared
     * statement created on one is not there on the next — the symptom is an
     * intermittent `prepared statement "s1" does not exist` under load only,
     * which is the worst possible thing to debug in production.
     */
    prepare: false,
    /**
     * ALSO MANDATORY on the transaction pooler, and less obvious than
     * `prepare: false`.
     *
     * postgres.js introspects array types with a catalog query the first time
     * a connection is used. In transaction mode that query races the real work
     * across a connection the pooler is handing round, and it comes back as
     * `57014 query_canceled` — which surfaces as a request that simply hangs,
     * not as an error anyone can read. Found exactly that way: the workstream
     * detail page loaded forever while the tests, which run inside an explicit
     * transaction, passed.
     *
     * Skipping the introspection costs nothing here: no column in this schema
     * is an array type.
     */
    fetch_types: false,
    /**
     * NOT 1. That was the original setting, and it was wrong.
     *
     * A single screen legitimately fans out — the workstream detail issues
     * eight queries in one `Promise.all`. With `max: 1` those serialise behind
     * one lazily-opened connection, and over the transaction pooler they wedge
     * outright: the request never completes and never errors. Found by a page
     * that loaded forever while every one of those eight queries returned in
     * ~100ms when run on its own.
     *
     * Five is small enough that concurrent function instances do not exhaust
     * the pooler — which is built for exactly this, many short-lived clients —
     * and large enough that one request's fan-out does not queue against
     * itself.
     */
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  instance = drizzle(client, { schema, casing: "snake_case" });
  return instance;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    return Reflect.get(connect(), prop, receiver);
  },
});

export { schema };
