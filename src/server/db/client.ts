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
     * Vercel functions are frozen between invocations. A large pool per
     * function instance multiplies across concurrent instances and exhausts
     * the pooler; one connection per instance is the right shape here.
     */
    max: 1,
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
