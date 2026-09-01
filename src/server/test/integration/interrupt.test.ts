/**
 * AN INTERRUPTED TEST RUN MUST NOT WEDGE THE DATABASE.
 *
 * The failure this prevents, which cost this build ten minutes: kill vitest
 * mid-run and the backend is left *idle in transaction*, holding the unique
 * index on `lower(person_emails.email)`. Every later run inserting the same
 * fixture address then blocks — indefinitely, and looking exactly like a code
 * defect rather than an abandoned lock.
 *
 * The guard is `SET LOCAL idle_in_transaction_session_timeout` inside every
 * fixture transaction. This proves Postgres actually enforces it, rather than
 * trusting that the statement was accepted.
 */

import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/server/db/client";

describe("the interrupt guard", () => {
  it("is set inside a fixture transaction", async () => {
    const value = await db.transaction(async (tx) => {
      await tx.execute(sql`set local idle_in_transaction_session_timeout = '60s'`);
      const rows = await tx.execute(sql`show idle_in_transaction_session_timeout`);
      return (rows as unknown as { idle_in_transaction_session_timeout: string }[])[0];
    });
    expect(value?.idle_in_transaction_session_timeout).toBe("1min");
  });

  it("POSTGRES ACTUALLY TERMINATES an abandoned transaction", async () => {
    /* A very short timeout, then sit idle past it. If the setting were merely
       accepted and not enforced, this would resolve normally and the test
       would pass for the wrong reason — so the assertion is that the next
       statement FAILS.
       
       Two codes are acceptable and both mean the same thing: `25P03` is
       Postgres reporting the timeout, and `CONNECTION_CLOSED` is postgres.js
       noticing the backend was terminated underneath it. The second is what
       actually happens here, and it is the stronger evidence — the session was
       not merely errored, it was reclaimed. */
    let code: string | null = null;
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`set local idle_in_transaction_session_timeout = '1s'`);
        await tx.execute(sql`select 1`);
        await new Promise((resolve) => setTimeout(resolve, 2500));
        await tx.execute(sql`select 1`);
      });
    } catch (error) {
      code = (error as { code?: string })?.code ?? null;
      /* postgres.js wraps the driver error; the cause carries the SQLSTATE. */
      if (!code) {
        const cause = (error as { cause?: { code?: string } })?.cause;
        code = cause?.code ?? null;
      }
    }
    expect(["25P03", "CONNECTION_CLOSED"]).toContain(code);
  }, 30_000);

  it("leaves no session idle in transaction behind it", async () => {
    const rows = await db.execute(sql`
      select count(*)::int as n
      from pg_stat_activity
      where datname = current_database()
        and state = 'idle in transaction'
        and now() - state_change > interval '90 seconds'`);
    const n = (rows as unknown as { n: number }[])[0]?.n ?? 0;
    /* Anything older than the 60s guard is an abandoned session the guard
       should have reclaimed. */
    expect(n).toBe(0);
  });
});
