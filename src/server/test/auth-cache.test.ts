/**
 * THE REQUEST-SCOPED AUTH CACHE — proving it cannot do the dangerous thing.
 *
 * getAuthContext() memoises on the Request object so that a page which calls
 * several server functions resolves identity once instead of once per call.
 * That is a performance change sitting on top of the authorization path, which
 * makes it the most dangerous edit in this codebase: a cache that outlived its
 * request, or that keyed on anything a second user could collide with, would
 * hand one person another person's permissions, or keep a deactivated account
 * working.
 *
 * These tests exist to make that failure impossible to introduce silently. They
 * count real resolutions by counting token verifications — exactly one happens
 * per resolution — so "was it cached?" is answered by evidence rather than by
 * reading the implementation.
 *
 * No database and no network: the unit suite must stay runnable anywhere.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ mocks */

let currentRequest: Request | null = null;
let claimsCalls = 0;
/** Rows the fake database will answer with, keyed by the id in the token. */
const usersById = new Map<string, { status: string; role: string }>();
let tokenSubject = "user-a";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => {
    if (!currentRequest) throw new Error("no request scope");
    return currentRequest;
  },
  getRequestHeader: () => "Bearer fake-token",
  getCookie: () => undefined,
  setCookie: () => undefined,
  deleteCookie: () => undefined,
}));

vi.mock("../auth/supabase.server", () => ({
  authClient: () => ({
    auth: {
      getClaims: async () => {
        claimsCalls++;
        return { data: { claims: { sub: tokenSubject } }, error: null };
      },
      refreshSession: async () => ({ data: { session: null }, error: new Error("no refresh") }),
    },
  }),
  adminClient: () => ({}),
  revokeUserSessions: async () => undefined,
  restoreUserSessions: async () => undefined,
}));

/** A drizzle-shaped stub. Each chain is thenable; awaiting it returns rows. */
vi.mock("../db/client", () => {
  const rowsFor = (table: string) => {
    if (table === "users") {
      const u = usersById.get(tokenSubject);
      return u
        ? [
            {
              id: tokenSubject,
              email: `${tokenSubject}@example.com`,
              fullName: "Test",
              role: u.role,
              status: u.status,
              timezone: "Asia/Dubai",
              canViewCommission: false,
              canManageCommissionRules: false,
            },
          ]
        : [];
    }
    return [];
  };
  const chain = (table: string) => {
    const node: Record<string, unknown> = {};
    node["where"] = () => node;
    node["limit"] = () => node;
    node["then"] = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(rowsFor(table)).then(resolve, reject);
    return node;
  };
  return {
    db: {
      select: () => ({
        from: (t: { [k: string]: unknown }) => {
          const name = String((t as unknown as { _: { name: string } })?._?.name ?? "users");
          return chain(name);
        },
      }),
    },
  };
});

const { getAuthContext } = await import("../auth/context");

/* ------------------------------------------------------------------ tests */

const newRequest = (url = "https://financialrails.org/admin") => new Request(url);

beforeEach(() => {
  claimsCalls = 0;
  usersById.clear();
  usersById.set("user-a", { status: "active", role: "admin" });
  usersById.set("user-b", { status: "active", role: "team_member" });
  tokenSubject = "user-a";
  currentRequest = null;
});

describe("request-scoped auth memoisation", () => {
  it("resolves once for repeated calls inside ONE request", async () => {
    currentRequest = newRequest();
    const first = await getAuthContext();
    const second = await getAuthContext();

    expect(first?.userId).toBe("user-a");
    expect(second?.userId).toBe("user-a");
    /* The whole point: two calls, one verification. */
    expect(claimsCalls).toBe(1);
  });

  it("does NOT reuse anything across two different requests", async () => {
    currentRequest = newRequest();
    await getAuthContext();
    currentRequest = newRequest();
    await getAuthContext();

    expect(claimsCalls).toBe(2);
  });

  it("cannot leak one user's context into another user's request", async () => {
    currentRequest = newRequest();
    tokenSubject = "user-a";
    const a = await getAuthContext();

    /* A different request, a different person, arriving while the first is
       still in memory. Object identity is what keeps them apart. */
    currentRequest = newRequest();
    tokenSubject = "user-b";
    const b = await getAuthContext();

    expect(a?.userId).toBe("user-a");
    expect(a?.role).toBe("admin");
    expect(b?.userId).toBe("user-b");
    expect(b?.role).toBe("team_member");
  });

  it("lets deactivation take effect on the very next request", async () => {
    currentRequest = newRequest();
    expect((await getAuthContext())?.userId).toBe("user-a");

    /* Deactivated between requests, exactly as setUserActive does. */
    usersById.set("user-a", { status: "deactivated", role: "admin" });

    currentRequest = newRequest();
    await expect(getAuthContext()).rejects.toMatchObject({ code: "deactivated" });
  });

  it("lets a role change take effect on the very next request", async () => {
    currentRequest = newRequest();
    expect((await getAuthContext())?.role).toBe("admin");

    usersById.set("user-a", { status: "active", role: "team_member" });

    currentRequest = newRequest();
    expect((await getAuthContext())?.role).toBe("team_member");
  });

  it("caches nothing when there is no request scope", async () => {
    currentRequest = null; // scripts, tests, background work
    await getAuthContext();
    await getAuthContext();

    /* Correctness must never depend on the cache existing. */
    expect(claimsCalls).toBe(2);
  });

  it("shares one in-flight resolution between concurrent callers", async () => {
    currentRequest = newRequest();
    const [a, b] = await Promise.all([getAuthContext(), getAuthContext()]);

    expect(a?.userId).toBe("user-a");
    expect(b?.userId).toBe("user-a");
    expect(claimsCalls).toBe(1);
  });
});
