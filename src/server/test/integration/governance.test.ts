/**
 * AUDIT · EXPORT · ERASURE — §14, §15, §17, and §39 scenarios 29–31 plus the
 * unauthorized-export case.
 *
 * Three properties: nothing changes silently, an export cannot be used to
 * escape the permission model, and erasure destroys the person without
 * destroying the business record.
 */

import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { commissionEntries, opportunities, people, personEmails } from "@/server/db/schema";
import { assignOwner } from "@/server/domain/assignment";
import { createRule } from "@/server/domain/commission";
import {
  auditTrail,
  erasePerson,
  erasureRegister,
  exportCsv,
  historyFor,
} from "@/server/domain/governance";
import { createLead } from "@/server/domain/leads";
import { changeStage } from "@/server/domain/opportunities";
import { setTarget, updateTarget, targetProgress } from "@/server/domain/targets";
import { withFixture } from "./fixture";

const R: Record<string, unknown> = {};

beforeAll(async () => {
  await withFixture(async ({ tx, ids, ctx, q }) => {
    const sa = q("superAdmin");
    const saCtx = ctx("superAdmin", { canManageCommissionRules: true, canViewCommission: true });

    await createRule(
      sa,
      {
        name: "House 10%",
        basis: "percentage",
        ratePct: "10.000",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
      saCtx,
    );

    const lead = await createLead(
      sa,
      {
        fullName: "Audit Subject",
        companyName: "Audit Bank",
        email: "audit.subject@auditbank.test",
        phone: "+971500000009",
        jobTitle: "Head of Treasury",
        country: "AE",
        functions: ["sponsor"],
        editionId: ids.editionMena,
        estimatedValue: "90000.00",
      },
      saCtx,
    );
    const oppId = lead.opportunityIds[0]!;

    await assignOwner(sa, oppId, ids.memberSponsor, saCtx);
    await changeStage(sa, oppId, { stageKey: "proposal" }, saCtx);
    await changeStage(sa, oppId, { stageKey: "won", finalValue: "85000.00" }, saCtx);

    await setTarget(
      sa,
      {
        userId: ids.memberSponsor,
        function: "sponsor",
        editionId: ids.editionMena,
        targetValue: "100000.00",
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
      },
      saCtx,
    );
    const target = (await targetProgress(sa, saCtx, { function: "sponsor" }))[0]!;
    await updateTarget(sa, target.id, "120000.00", saCtx);

    /* ---- §17 · the trail ---- */
    const trail = await auditTrail(sa, saCtx, { limit: 500 });
    R["everyRowNamesWhoAndWhen"] = trail.every(
      (t) => Boolean(t.occurredAt) && (t.actorName != null || t.actorUserId == null),
    );

    const targetChange = trail.find((t) => t.action === "target_changed");
    R["targetChangeKeepsOldValue"] = {
      before: targetChange?.before?.["targetValue"],
      after: targetChange?.after?.["targetValue"],
    };

    const oppHistory = await historyFor(sa, "opportunity", oppId);
    R["opportunityHistory"] = oppHistory.map((h) => h.action).sort();

    /* An Admin cannot read the whole trail. */
    try {
      await auditTrail(q("adminMena"), ctx("adminMena"), {});
      R["adminReadTrail"] = true;
    } catch {
      R["adminReadTrail"] = false;
    }
    try {
      await auditTrail(q("memberSponsor"), ctx("memberSponsor"), {});
      R["memberReadTrail"] = true;
    } catch {
      R["memberReadTrail"] = false;
    }

    /* ---- §14 · export ---- */
    const csv = await exportCsv(sa, saCtx, "opportunities");
    R["exportRows"] = csv.rows;
    R["exportFilename"] = csv.filename;
    R["exportHasHeader"] = csv.csv.split("\r\n")[0]?.includes("person");
    R["exportIsAudited"] = (await auditTrail(sa, saCtx, { action: "exported" })).length;

    for (const [label, who] of [
      ["member", "memberSponsor"],
      ["admin", "adminMena"],
    ] as const) {
      try {
        await exportCsv(q(who), ctx(who), "opportunities");
        R[`${label}CouldExport`] = true;
      } catch {
        R[`${label}CouldExport`] = false;
      }
    }

    /* CSV injection: a name starting `=` must not become a formula. */
    const nasty = await createLead(
      sa,
      {
        fullName: "=cmd|'/c calc'!A1",
        companyName: "Injection Co",
        email: "nasty@injection.test",
        functions: ["sponsor"],
        editionId: ids.editionMena,
      },
      saCtx,
    );
    void nasty;
    const csv2 = await exportCsv(sa, saCtx, "opportunities");
    const nastyLine = csv2.csv.split("\r\n").find((l) => l.includes("cmd|"));
    R["injectionNeutralised"] = nastyLine?.includes("'=cmd|") ?? false;
    R["injectionStillPresent"] = Boolean(nastyLine);

    /* ---- §15 · erasure ---- */
    const beforeErase = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(opportunities)
      .where(eq(opportunities.personId, lead.personId));
    R["opportunitiesBefore"] = beforeErase[0]?.n;

    const commissionBefore = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(commissionEntries)
      .where(eq(commissionEntries.opportunityId, oppId));
    R["commissionBefore"] = commissionBefore[0]?.n;

    for (const [label, who] of [
      ["member", "memberSponsor"],
      ["admin", "adminMena"],
    ] as const) {
      try {
        await erasePerson(q(who), lead.personId, "test", ctx(who));
        R[`${label}CouldErase`] = true;
      } catch {
        R[`${label}CouldErase`] = false;
      }
    }

    const erased = await erasePerson(sa, lead.personId, "Subject request", saCtx);
    R["erasedFields"] = erased.fieldsCleared;
    R["opportunitiesPreserved"] = erased.opportunitiesPreserved;

    const after = await tx
      .select({
        fullName: people.fullName,
        jobTitle: people.jobTitle,
        phone: people.phone,
        country: people.country,
        erasedAt: people.erasedAt,
      })
      .from(people)
      .where(eq(people.id, lead.personId));
    R["personAfter"] = {
      fullName: after[0]?.fullName,
      jobTitle: after[0]?.jobTitle,
      phone: after[0]?.phone,
      country: after[0]?.country,
      erased: Boolean(after[0]?.erasedAt),
    };

    const emailsAfter = await tx
      .select({ id: personEmails.id })
      .from(personEmails)
      .where(eq(personEmails.personId, lead.personId));
    R["emailsAfter"] = emailsAfter.length;

    const oppsAfter = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(opportunities)
      .where(eq(opportunities.personId, lead.personId));
    R["opportunitiesAfter"] = oppsAfter[0]?.n;

    const commissionAfter = await tx
      .select({ amount: commissionEntries.amount })
      .from(commissionEntries)
      .where(eq(commissionEntries.opportunityId, oppId));
    R["commissionAfter"] = commissionAfter.map((c) => Number(c.amount));

    const register = await erasureRegister(sa, saCtx);
    R["registerEntry"] = register[0] && {
      fields: register[0].fieldsCleared,
      reason: register[0].reason,
      by: register[0].performedByName,
    };
    R["registerStoresNoValues"] = !JSON.stringify(register).includes("Audit Subject");

    /* Erasing twice is refused. */
    try {
      await erasePerson(sa, lead.personId, "again", saCtx);
      R["doubleErase"] = true;
    } catch {
      R["doubleErase"] = false;
    }

    /* Sampled LAST, so it includes the export and the erasure this fixture
       performed after the earlier read. */
    const finalTrail = await auditTrail(sa, saCtx, { limit: 500 });
    R["actions"] = [...new Set(finalTrail.map((t) => t.action))].sort();

    return true;
  });
});

describe("§17 — nothing changes silently", () => {
  it("records every kind of change the spec names", () =>
    expect(R["actions"]).toEqual(
      expect.arrayContaining([
        "created",
        "assigned",
        "stage_changed",
        "won",
        "commission_created",
        "target_changed",
        "erased",
        "exported",
      ]),
    ));

  it("every row says who and when", () => expect(R["everyRowNamesWhoAndWhen"]).toBe(true));

  it("a target change KEEPS THE OLD VALUE — moving a target is how a miss becomes a hit", () =>
    expect(R["targetChangeKeepsOldValue"]).toEqual({
      before: "100000.00",
      after: "120000.00",
    }));

  it("one record's history reads as its own story", () =>
    expect(R["opportunityHistory"]).toEqual(["assigned", "created", "stage_changed", "won"]));
});

describe("the audit trail is Super Admin only", () => {
  it("an Admin cannot read it", () => expect(R["adminReadTrail"]).toBe(false));
  it("a Team Member cannot read it", () => expect(R["memberReadTrail"]).toBe(false));
});

describe("§14 — export respects authorization", () => {
  it("a Super Admin gets rows with a header", () => {
    expect(R["exportRows"]).toBeGreaterThan(0);
    expect(R["exportHasHeader"]).toBe(true);
  });
  it("the file is named for what it is", () =>
    expect(R["exportFilename"]).toMatch(/^financial-rails-opportunities-\d{4}-\d{2}-\d{2}\.csv$/));
  it("EXPORTING IS ITSELF AUDITED — a copy of the pipeline leaving is an event", () =>
    expect(R["exportIsAudited"]).toBeGreaterThan(0));
  it("a Team Member cannot export", () => expect(R["memberCouldExport"]).toBe(false));
  it("an Admin cannot export", () => expect(R["adminCouldExport"]).toBe(false));
});

describe("CSV injection", () => {
  it("a name starting with = is neutralised, not dropped", () => {
    /* A cell beginning = + - or @ executes as a formula in Excel and Sheets,
       and this data comes from a public web form. */
    expect(R["injectionStillPresent"]).toBe(true);
    expect(R["injectionNeutralised"]).toBe(true);
  });
});

describe("§15 — erasure is Super Admin only", () => {
  it("a Team Member cannot erase", () => expect(R["memberCouldErase"]).toBe(false));
  it("an Admin cannot erase", () => expect(R["adminCouldErase"]).toBe(false));
});

describe("§15 — the person goes, the business record stays", () => {
  it("clears every personal field", () =>
    expect(R["personAfter"]).toEqual({
      fullName: "Erased person",
      jobTitle: null,
      phone: null,
      country: null,
      erased: true,
    }));

  it("removes every email address", () => expect(R["emailsAfter"]).toBe(0));

  it("PRESERVES THE COMMERCIAL HISTORY", () => {
    expect(R["opportunitiesAfter"]).toBe(R["opportunitiesBefore"]);
    expect(R["opportunitiesPreserved"]).toBe(R["opportunitiesBefore"]);
  });

  it("and the commission earned on it", () => {
    expect(R["commissionBefore"]).toBe(1);
    expect(R["commissionAfter"]).toEqual([8500]);
  });

  it("records WHICH FIELDS were cleared", () =>
    expect(R["erasedFields"]).toEqual(["fullName", "jobTitle", "phone", "country", "emails"]));

  it("BUT NEVER WHAT THEY SAID — storing the values would defeat the purpose", () =>
    expect(R["registerStoresNoValues"]).toBe(true));

  it("the register names who did it and why", () =>
    expect(R["registerEntry"]).toMatchObject({ reason: "Subject request", by: "Super Admin" }));

  it("erasing twice is refused", () => expect(R["doubleErase"]).toBe(false));
});
