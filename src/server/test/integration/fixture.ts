/**
 * THE SHARED LIVE FIXTURE.
 *
 * Every integration test runs inside one transaction that is rolled back, so
 * nothing it writes is ever committed and the database ends each run exactly
 * as it started. That is what lets these tests use realistic commercial
 * fixtures without ever seeding data that could later be mistaken for real.
 *
 * `scopedQuery(ctx).directory` is the module-level `db` handle. Inside a
 * transaction the fixture rows are only visible on that transaction's
 * connection, so the handle is swapped for `tx` — done here, once, rather than
 * re-derived in every test file.
 *
 * The ephemeral `auth.users` rows exist solely to satisfy the foreign key from
 * `public.users.id`. They hold nothing but an id and vanish with the rollback.
 */

import { TransactionRollbackError } from "drizzle-orm";

import { db } from "@/server/db/client";
import {
  authUsers,
  editions,
  events,
  userEventScopes,
  userFunctions,
  users,
} from "@/server/db/schema";
import { scopedQuery, type ScopedQuery, type Tx } from "@/server/auth/scoped";
import { clearPipelineCache } from "@/server/domain/pipeline";
import type { AuthContext, Role, WorkFunction } from "@/server/auth/permissions";

export const uuid = () => crypto.randomUUID();

export type Fixture = {
  tx: Tx;
  ids: {
    superAdmin: string;
    adminMena: string;
    memberSponsor: string;
    memberSpeaker: string;
    memberDelegate: string;
    eventMena: string;
    eventAsia: string;
    editionMena: string;
    editionMena2027: string;
    editionAsia: string;
  };
  ctx: (who: keyof Fixture["ids"]) => AuthContext;
  q: (who: keyof Fixture["ids"], overrides?: Partial<AuthContext>) => ScopedQuery;
};

function makeCtx(
  userId: string,
  role: Role,
  functions: WorkFunction[],
  eventScopeIds: string[],
  overrides: Partial<AuthContext> = {},
): AuthContext {
  return {
    userId,
    email: `${userId.slice(0, 8)}@fixture.test`,
    fullName: `Fixture ${role}`,
    role,
    status: "active",
    functions,
    eventScopeIds,
    canViewCommission: false,
    canManageCommissionRules: false,
    timezone: "Asia/Dubai",
    ...overrides,
  };
}

/**
 * Run `work` against a fully-populated fixture, then roll everything back.
 * Returns whatever `work` returns, so a test file can collect its measurements
 * in `beforeAll` and assert on them in granular `it` blocks.
 */
export async function withFixture<T>(work: (f: Fixture) => Promise<T>): Promise<T> {
  clearPipelineCache();
  let out: T | undefined;
  let failure: unknown = null;

  try {
    await db.transaction(async (tx) => {
      const ids = {
        superAdmin: uuid(),
        adminMena: uuid(),
        memberSponsor: uuid(),
        memberSpeaker: uuid(),
        memberDelegate: uuid(),
        eventMena: uuid(),
        eventAsia: uuid(),
        editionMena: uuid(),
        editionMena2027: uuid(),
        editionAsia: uuid(),
      };

      const people = [
        [ids.superAdmin, "super_admin", "Super Admin"],
        [ids.adminMena, "admin", "Admin MENA"],
        [ids.memberSponsor, "team_member", "Ahmed"],
        [ids.memberSpeaker, "team_member", "Sara"],
        [ids.memberDelegate, "team_member", "Imran"],
      ] as const;

      await tx.insert(authUsers).values(people.map(([id]) => ({ id })));
      await tx.insert(users).values(
        people.map(([id, role, name]) => ({
          id,
          email: `${name.toLowerCase().replace(/\s+/g, ".")}@fixture.test`,
          fullName: name,
          role,
          status: "active" as const,
        })),
      );

      await tx.insert(events).values([
        {
          id: ids.eventMena,
          name: "Financial Rails MENA",
          slug: `mena-${ids.eventMena.slice(0, 8)}`,
        },
        {
          id: ids.eventAsia,
          name: "Financial Rails Asia",
          slug: `asia-${ids.eventAsia.slice(0, 8)}`,
        },
      ]);
      await tx.insert(editions).values([
        {
          id: ids.editionMena,
          eventId: ids.eventMena,
          name: "MENA 2026",
          slug: "2026",
          city: "Dubai",
          country: "AE",
        },
        {
          id: ids.editionMena2027,
          eventId: ids.eventMena,
          name: "MENA 2027",
          slug: "2027",
          city: "Dubai",
          country: "AE",
        },
        {
          id: ids.editionAsia,
          eventId: ids.eventAsia,
          name: "Asia 2027",
          slug: "2027",
          city: "Singapore",
          country: "SG",
        },
      ]);

      /* The Admin is scoped to MENA only, explicitly. Never inferred. */
      await tx.insert(userEventScopes).values([{ userId: ids.adminMena, eventId: ids.eventMena }]);

      /* Team Members hold explicit functions, and the ROWS must match the
         contexts handed out below — assignment refuses an owner who does not
         hold the function, so a fixture that declares one and stores the other
         fails in a way that looks like a code defect. */
      await tx.insert(userFunctions).values([
        { userId: ids.memberSponsor, function: "sponsor" },
        { userId: ids.memberSpeaker, function: "speaker" },
        { userId: ids.memberDelegate, function: "delegate" },
      ]);

      const roleOf: Record<string, [Role, WorkFunction[], string[]]> = {
        superAdmin: ["super_admin", ["sponsor", "delegate", "speaker"], []],
        adminMena: ["admin", ["sponsor", "delegate", "speaker"], [ids.eventMena]],
        memberSponsor: ["team_member", ["sponsor"], []],
        memberSpeaker: ["team_member", ["speaker"], []],
        memberDelegate: ["team_member", ["delegate"], []],
      };

      const ctx = (who: keyof typeof ids, overrides: Partial<AuthContext> = {}) => {
        const spec = roleOf[who as string];
        if (!spec) throw new Error(`${String(who)} is not a user in the fixture.`);
        return makeCtx(ids[who], spec[0], spec[1], spec[2], overrides);
      };

      const q = (who: keyof typeof ids, overrides: Partial<AuthContext> = {}): ScopedQuery => ({
        ...scopedQuery(ctx(who, overrides)),
        directory: tx,
      });

      try {
        out = await work({ tx, ids, ctx: (who) => ctx(who), q });
      } catch (error) {
        /* Capture and rethrow AFTER the rollback, so a genuine failure is
           reported rather than being swallowed as a rollback. */
        failure = error;
      }

      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error;
  }

  if (failure) throw failure;
  return out as T;
}
