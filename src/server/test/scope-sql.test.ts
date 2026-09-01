/**
 * THE SCOPE FILTER, INSPECTED AS SQL.
 *
 * permissions.test.ts proves the rules. This proves the QUERIES carry them:
 * that `scopedQuery(ctx).where.opportunities()` compiles to a WHERE clause that
 * actually narrows, and — the failure that would matter most — that it never
 * compiles to something permissive when a scope list is empty.
 *
 * No database is touched. postgres.js connects lazily and `.toSQL()` only
 * builds; nothing here opens a socket.
 */

import { eq, type SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "../db/client";
import { opportunities } from "../db/schema";
import { scopedQuery } from "../auth/scoped";
import { ctx, EVENT_MENA, MEMBER } from "./factories";

/** Compile a condition and hand back ONLY the WHERE fragment. The select list
    mentions every column, so asserting against the whole statement would pass
    or fail for reasons that have nothing to do with the scope. */
function whereOf(condition: SQL) {
  const { sql, params } = db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(condition)
    .toSQL();
  const at = sql.indexOf(" where ");
  return { where: at === -1 ? "" : sql.slice(at + 7), params };
}

describe("opportunity scope compiles to real SQL", () => {
  it("Super Admin is unfiltered", () => {
    const { where } = whereOf(scopedQuery(ctx("super_admin")).where.opportunities());
    expect(where).toContain("true");
    expect(where).not.toContain("owner_id");
  });

  it("a Team Member's filter names them, on both owner columns", () => {
    const { where, params } = whereOf(scopedQuery(ctx("team_member")).where.opportunities());
    expect(where).toContain('"owner_id"');
    expect(where).toContain('"secondary_owner_id"');
    expect(params).toContain(MEMBER);
  });

  it("an Admin's filter is a subquery over their scoped events", () => {
    const { where, params } = whereOf(scopedQuery(ctx("admin")).where.opportunities());
    expect(where).toContain('"edition_id" in (select');
    expect(where).toContain('"editions"');
    expect(params).toContain(EVENT_MENA);
  });

  it("AN ADMIN WITH NO SCOPE COMPILES TO FALSE, NOT TO AN ABSENT FILTER", () => {
    /* The single most dangerous failure available here: an empty IN-list or a
       dropped condition returns the whole table instead of nothing. */
    const { where } = whereOf(
      scopedQuery(ctx("admin", { eventScopeIds: [] })).where.opportunities(),
    );
    expect(where).toContain("false");
    expect(where).not.toContain("select");
  });

  it("an extra condition is ANDed with the scope, never replacing it", () => {
    const scoped = scopedQuery(ctx("team_member"));
    const { where } = whereOf(scoped.where.opportunities(eq(opportunities.stageKey, "won")));
    expect(where).toContain('"owner_id"');
    expect(where).toContain('"stage_key"');
    expect(where.toLowerCase()).toContain(" and ");
  });

  it("passing no extra condition still yields a scoped WHERE", () => {
    const { where } = whereOf(scopedQuery(ctx("team_member")).where.opportunities(undefined));
    expect(where).not.toBe("");
    expect(where).toContain('"owner_id"');
  });
});

describe("derived scopes", () => {
  it("activities inherit opportunity visibility", () => {
    const c = ctx("team_member");
    const { where, params } = whereOf(scopedQuery(c).where.activities());
    expect(where).toContain('"opportunity_id" in (select');
    expect(params).toContain(MEMBER);
  });

  it("a Team Member's commission filter is their own rows only", () => {
    const { where, params } = whereOf(scopedQuery(ctx("team_member")).where.commissionEntries());
    expect(where).toContain('"user_id"');
    expect(where).not.toContain("select");
    expect(params).toEqual([MEMBER]);
  });

  it("an Admin without the grant gets the same own-rows-only filter", () => {
    const { where } = whereOf(scopedQuery(ctx("admin")).where.commissionEntries());
    expect(where).not.toContain("select");
  });

  it("the grant widens it to their scoped events, not to everything", () => {
    const { where, params } = whereOf(
      scopedQuery(ctx("admin", { canViewCommission: true })).where.commissionEntries(),
    );
    expect(where).toContain("select");
    expect(params).toContain(EVENT_MENA);
  });
});

describe("the escape hatch", () => {
  it("unscoped() refuses to hand over the raw handle without a written reason", () => {
    expect(() => scopedQuery(ctx("super_admin")).unscoped("")).toThrow(/written reason/);
  });
});
