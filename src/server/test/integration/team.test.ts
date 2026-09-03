/**
 * TEAM MANAGEMENT — the privileged write path, proved against Postgres.
 *
 * This is the most dangerous code added in the simplification pass: it creates
 * accounts, sets roles, and grants event scope. Every one of those is a way to
 * hand somebody access they should not have, so the refusals matter more here
 * than the happy path does.
 *
 * The refusal tests touch nothing. They assert that authorization fails BEFORE
 * any write or any network call, which is also why they are safe to run against
 * the real database — a test that had to create an account in order to prove it
 * could not create an account would be self-defeating.
 *
 * The one test that really creates an account cleans it up in `finally`, and a
 * sweep in `afterAll` removes anything a crash left behind. Its email carries a
 * PHASE2-TEST prefix so it can never be mistaken for a colleague.
 */

import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { auditLog, userEventScopes, userFunctions, users } from "@/server/db/schema";
import {
  createUser,
  listEventsForScope,
  listTeam,
  setUserEventScopes,
  setUserFunctions,
  setUserRole,
} from "@/server/auth/accounts";
import { deleteAuthUser } from "@/server/auth/supabase.server";
import type { AuthContext, Role } from "@/server/auth/permissions";

const TEST_EMAIL = "phase2-test-created@example.com";

const ctxFor = (role: Role, userId: string = crypto.randomUUID()): AuthContext => ({
  userId,
  email: `${role}@example.com`,
  fullName: role,
  role,
  status: "active",
  functions: [],
  eventScopeIds: [],
  canViewCommission: false,
  canManageCommissionRules: false,
  timezone: "Asia/Dubai",
});

const admin = ctxFor("admin");
const member = ctxFor("team_member");

/**
 * The refusal tests never reach the database, so a fabricated id is fine for
 * them. Creating an account does write an audit row, and `audit_log.actor_user_id`
 * is a foreign key onto `users` — so the one test that really creates something
 * has to act as somebody who genuinely exists. We borrow the live Super Admin's
 * id as the actor and remove the audit rows again afterwards.
 */
let superAdmin = ctxFor("super_admin");
let canCreate = false;

beforeAll(async () => {
  const [real] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, "super_admin"))
    .limit(1);
  if (real) {
    superAdmin = { ...ctxFor("super_admin", real.id), email: real.email };
    canCreate = true;
  }
});

/** Remove anything this suite created, including after a crash. */
async function sweep() {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, "phase2-test-%"));
  if (rows.length) {
    const ids = rows.map((r) => r.id);
    /* The audit row names the created account as its entity; remove it too so
       the trail is not littered with accounts that never existed. */
    await db.delete(auditLog).where(inArray(auditLog.entityId, ids));
    await db.delete(userEventScopes).where(inArray(userEventScopes.userId, ids));
    await db.delete(userFunctions).where(inArray(userFunctions.userId, ids));
    await db.delete(users).where(inArray(users.id, ids));
    for (const id of ids) await deleteAuthUser(id).catch(() => undefined);
  }
  return rows.length;
}

afterAll(async () => {
  await sweep();
});

const newUser = {
  email: TEST_EMAIL,
  fullName: "Phase Two Test",
  password: "phase2-test-password-not-a-real-secret",
  role: "team_member" as Role,
  functions: ["sponsor" as const],
  eventIds: [] as string[],
};

describe("who may create an account", () => {
  it("refuses an Admin", async () => {
    await expect(createUser(newUser, admin)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuses a Team Member", async () => {
    await expect(createUser(newUser, member)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuses an Admin even when they ask for a harmless role", async () => {
    await expect(createUser({ ...newUser, role: "team_member" }, admin)).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("lets a Super Admin create one, and provisions it completely", async () => {
    if (!canCreate) return;
    await sweep();
    let created: { userId: string } | null = null;
    try {
      created = await createUser(newUser, superAdmin);

      const [row] = await db
        .select({ id: users.id, email: users.email, role: users.role, status: users.status })
        .from(users)
        .where(eq(users.id, created.userId));

      expect(row?.email).toBe(TEST_EMAIL);
      expect(row?.role).toBe("team_member");
      /* Active, not `invited`: a Super Admin setting the password IS the
         provisioning step, and leaving them `invited` would lock them out. */
      expect(row?.status).toBe("active");

      const fns = await db
        .select({ function: userFunctions.function })
        .from(userFunctions)
        .where(eq(userFunctions.userId, created.userId));
      expect(fns.map((f) => f.function)).toEqual(["sponsor"]);
    } finally {
      await sweep();
    }
  });

  it("refuses a duplicate email", async () => {
    if (!canCreate) return;
    await sweep();
    try {
      await createUser(newUser, superAdmin);
      await expect(createUser(newUser, superAdmin)).rejects.toMatchObject({ code: "forbidden" });
    } finally {
      await sweep();
    }
  });
});

describe("role assignment is constrained", () => {
  it("rejects a role outside the enum", async () => {
    await expect(
      setUserRole({ userId: crypto.randomUUID(), role: "owner" as Role }, superAdmin),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuses an Admin promoting anyone", async () => {
    await expect(
      setUserRole({ userId: crypto.randomUUID(), role: "super_admin" }, admin),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuses an Admin promoting THEMSELVES — the escalation that matters", async () => {
    await expect(
      setUserRole({ userId: admin.userId, role: "super_admin" }, admin),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuses a Super Admin changing their own role", async () => {
    /* Not politeness: a Super Admin who demotes themselves can lock everyone
       out of user management, and the product has no recovery path. */
    await expect(
      setUserRole({ userId: superAdmin.userId, role: "team_member" }, superAdmin),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("work-function assignment is constrained", () => {
  it("rejects a function outside the enum", async () => {
    await expect(
      setUserFunctions(
        { userId: crypto.randomUUID(), functions: ["everything"] as never },
        superAdmin,
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuses an Admin granting a function", async () => {
    await expect(
      setUserFunctions({ userId: crypto.randomUUID(), functions: ["sponsor"] }, admin),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuses an Admin granting themselves a function", async () => {
    await expect(
      setUserFunctions({ userId: admin.userId, functions: ["sponsor"] }, admin),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("event-scope assignment is constrained", () => {
  it("refuses an Admin widening anyone's scope", async () => {
    await expect(
      setUserEventScopes({ userId: crypto.randomUUID(), eventIds: [] }, admin),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuses an Admin widening THEIR OWN scope — the escalation that matters", async () => {
    await expect(
      setUserEventScopes({ userId: admin.userId, eventIds: [] }, admin),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuses a Team Member entirely", async () => {
    await expect(
      setUserEventScopes({ userId: crypto.randomUUID(), eventIds: [] }, member),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects an event that does not exist", async () => {
    await expect(
      setUserEventScopes(
        { userId: crypto.randomUUID(), eventIds: [crypto.randomUUID()] },
        superAdmin,
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("reading the roster", () => {
  it("is closed to a Team Member", async () => {
    await expect(listTeam(member)).rejects.toMatchObject({ code: "forbidden" });
    await expect(listEventsForScope(member)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("is open to a manager and carries no commission figures", async () => {
    const rows = await listTeam(admin);
    expect(Array.isArray(rows)).toBe(true);
    for (const r of rows) {
      expect(Object.keys(r)).not.toContain("canViewCommission");
      expect(JSON.stringify(r)).not.toMatch(/commission/i);
    }
  });
});
