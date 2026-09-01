/**
 * §14 GLOBAL SEARCH — and the three different permission rules underneath one
 * search box. §39 scenarios 25, 26.
 *
 * The directory is open. Opportunities are scoped. User records are projected
 * per role. A search that applied one rule to all three would either hide the
 * person you must find before creating a duplicate, or leak a colleague's
 * pipeline.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { createLead } from "@/server/domain/leads";
import { globalSearch } from "@/server/domain/search";
import { withFixture } from "./fixture";

const R: Record<string, unknown> = {};

beforeAll(async () => {
  await withFixture(async ({ ids, ctx, q }) => {
    const sa = q("superAdmin");
    const saCtx = ctx("superAdmin");

    await createLead(
      sa,
      {
        fullName: "Layla Haddad",
        companyName: "Temenos",
        jobTitle: "Regional Director",
        email: "layla@temenos.com",
        phone: "+971500000001",
        functions: ["sponsor"],
        editionId: ids.editionMena,
        ownerId: ids.memberSponsor,
      },
      saCtx,
    );

    await createLead(
      sa,
      {
        fullName: "Omar Said",
        companyName: "Mashreq Bank",
        email: "omar@mashreqbank.com",
        functions: ["speaker"],
        editionId: ids.editionMena,
        ownerId: ids.memberSpeaker,
      },
      saCtx,
    );

    /* ---- the directory is open to everyone ---- */
    const asMember = await globalSearch(q("memberDelegate"), ctx("memberDelegate"), "Layla");
    R["memberFindsPersonInDirectory"] = asMember.people.length;
    R["memberFindsNoOpportunity"] = asMember.opportunities.length;

    /* ---- opportunities are scoped ---- */
    const asOwner = await globalSearch(q("memberSponsor"), ctx("memberSponsor"), "Temenos");
    R["ownerFindsOwnOpportunity"] = asOwner.opportunities.length;
    const asSuper = await globalSearch(sa, saCtx, "Temenos");
    R["superFindsAll"] = asSuper.opportunities.length;

    /* ---- search by every field §14 names ---- */
    R["byEmail"] = (await globalSearch(sa, saCtx, "layla@temenos.com")).people.length;
    R["byPhone"] = (await globalSearch(sa, saCtx, "+971500000001")).people.length;
    R["byCompany"] = (await globalSearch(sa, saCtx, "Mashreq")).people.length;
    R["byCompanyName"] = (await globalSearch(sa, saCtx, "Temenos")).companies.length;
    R["byEventCity"] = (await globalSearch(sa, saCtx, "Dubai")).events.length;
    R["byEventName"] = (await globalSearch(sa, saCtx, "MENA")).events.length;

    /* ---- user records are projected per role ---- */
    const adminSearch = await globalSearch(q("adminMena"), ctx("adminMena"), "Super Admin");
    const superRow = adminSearch.users.find((u) => u.id === ids.superAdmin);
    R["adminSeesSuperAdminName"] = superRow?.fullName;
    R["adminSeesSuperAdminEmail"] = superRow?.email ?? null;
    R["adminSeesSuperAdminRole"] = superRow?.role ?? null;

    const adminSeesMember = await globalSearch(q("adminMena"), ctx("adminMena"), "Ahmed");
    const memberRow = adminSeesMember.users.find((u) => u.id === ids.memberSponsor);
    R["adminSeesMemberEmail"] = Boolean(memberRow?.email);

    const memberSearch = await globalSearch(q("memberSponsor"), ctx("memberSponsor"), "Sara");
    const otherRow = memberSearch.users.find((u) => u.id === ids.memberSpeaker);
    R["memberSeesColleagueName"] = otherRow?.fullName;
    R["memberSeesColleagueEmail"] = otherRow?.email ?? null;

    const ownSearch = await globalSearch(q("memberSponsor"), ctx("memberSponsor"), "Ahmed");
    const ownRow = ownSearch.users.find((u) => u.id === ids.memberSponsor);
    R["memberSeesOwnEmail"] = Boolean(ownRow?.email);

    /* ---- a one-character query returns nothing ---- */
    const tiny = await globalSearch(sa, saCtx, "a");
    R["tinyQueryEmpty"] =
      tiny.people.length + tiny.companies.length + tiny.opportunities.length === 0;

    return true;
  });
});

describe("the directory is open to every active user", () => {
  it("a Team Member finds a person they do not own — they must, to avoid duplicating", () =>
    expect(R["memberFindsPersonInDirectory"]).toBe(1));
  it("but finds none of the workstreams on them", () =>
    expect(R["memberFindsNoOpportunity"]).toBe(0));
});

describe("opportunities are scoped inside the same search", () => {
  it("the owner finds their own", () => expect(R["ownerFindsOwnOpportunity"]).toBe(1));
  it("Super Admin finds every one", () => expect(R["superFindsAll"]).toBe(1));
});

describe("§14 — every field it names is searchable", () => {
  it("by email", () => expect(R["byEmail"]).toBe(1));
  it("by phone", () => expect(R["byPhone"]).toBe(1));
  it("by company, returning the people at it", () => expect(R["byCompany"]).toBe(1));
  it("by company name, returning the company", () => expect(R["byCompanyName"]).toBe(1));
  it("by event city", () => expect(R["byEventCity"]).toBeGreaterThan(0));
  it("by event name", () => expect(R["byEventName"]).toBeGreaterThan(0));
});

describe("user records are projected per role, in the query not the UI", () => {
  it("an Admin resolves a Super Admin's NAME", () =>
    expect(R["adminSeesSuperAdminName"]).toBe("Super Admin"));

  it("AND NOTHING ELSE ABOUT THEM", () => {
    /* The Gate 2 ruling: enough to render "owned by", never more. */
    expect(R["adminSeesSuperAdminEmail"]).toBeNull();
    expect(R["adminSeesSuperAdminRole"]).toBeNull();
  });

  it("an Admin does see a Team Member in full", () => expect(R["adminSeesMemberEmail"]).toBe(true));

  it("a Team Member gets a colleague's name only", () => {
    expect(R["memberSeesColleagueName"]).toBe("Sara");
    expect(R["memberSeesColleagueEmail"]).toBeNull();
  });

  it("but their own record in full", () => expect(R["memberSeesOwnEmail"]).toBe(true));
});

describe("query length", () => {
  it("one character returns nothing rather than most of the database", () =>
    expect(R["tinyQueryEmpty"]).toBe(true));
});
