/**
 * THE AUTHENTICATED RPC SURFACE for Rails Radar.
 *
 * Every handler calls straight into src/server/radar/admin.ts, and every
 * function there begins with `requireRadarEditor()`. The authorization is on
 * the server, inside the operation — not in this file and not in the route —
 * so calling one of these endpoints directly gains an attacker nothing.
 *
 * That is the same arrangement src/rpc/team.ts uses for the CRM, for the same
 * reason: a check in a wrapper is a check somebody can forget to copy into the
 * next wrapper.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AuthError } from "@/server/auth/context";
import {
  addCorridorEvent,
  deleteLicence,
  listCorridorsForAdmin,
  listProvidersForAdmin,
  listRailsForAdmin,
  listRoutesForAdmin,
  listSubmissions,
  radarOverview,
  reviewSubmission,
  upsertCorridor,
  upsertLicence,
  upsertProvider,
  upsertRail,
  upsertRoute,
} from "@/server/radar/admin";

async function sealed<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (problem) {
    if (problem instanceof AuthError) throw problem;
    if (problem != null && typeof problem === "object" && "statusCode" in problem) throw problem;
    console.error("[rpc/radar-admin]", problem);
    throw new AuthError("unauthenticated", "Something went wrong. Try again.", 500);
  }
}

const status = z.enum(["draft", "published", "archived"]);
const list = z.array(z.string().max(200)).max(100);
/** Every write carries provenance. The schema demands it and so does the DB. */
const provenance = {
  sourceUrl: z.string().min(1).max(2000),
  lastVerifiedAt: z.string().min(1).max(40),
  lastVerifiedBy: z.string().max(200),
};

/* ------------------------------------------------------------ dashboard -- */

export const radarAdminOverview = createServerFn({ method: "GET" }).handler(() =>
  sealed(() => radarOverview()),
);

export const adminCorridors = createServerFn({ method: "GET" }).handler(() =>
  sealed(() => listCorridorsForAdmin()),
);

export const adminRails = createServerFn({ method: "GET" }).handler(() =>
  sealed(() => listRailsForAdmin()),
);

export const adminProviders = createServerFn({ method: "GET" }).handler(() =>
  sealed(() => listProvidersForAdmin()),
);

export const adminRoutes = createServerFn({ method: "GET" })
  .validator(z.object({ corridorId: z.string().uuid() }))
  .handler(({ data }) => sealed(() => listRoutesForAdmin(data.corridorId)));

/* ---------------------------------------------------------------- rails -- */

export const saveRail = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid().nullable().optional(),
      name: z.string().min(1).max(200),
      category: z.enum(["traditional", "digital", "blockchain", "emerging"]),
      description: z.string().max(4000).nullable().optional(),
      icon: z.string().max(100).nullable().optional(),
      isMessagingNetwork: z.boolean(),
      status,
      ...provenance,
    }),
  )
  .handler(({ data }) =>
    sealed(() =>
      upsertRail({
        id: data.id ?? null,
        name: data.name,
        category: data.category,
        description: data.description ?? null,
        icon: data.icon ?? null,
        isMessagingNetwork: data.isMessagingNetwork,
        status: data.status,
        sourceUrl: data.sourceUrl,
        lastVerifiedAt: data.lastVerifiedAt,
        lastVerifiedBy: data.lastVerifiedBy,
      }),
    ),
  );

/* ------------------------------------------------------------ providers -- */

export const saveProvider = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid().nullable().optional(),
      name: z.string().min(1).max(200),
      type: z.enum([
        "bank",
        "psp",
        "orchestration",
        "stablecoin",
        "fx",
        "custodian",
        "exchange",
        "onramp",
      ]),
      website: z.string().max(2000).nullable().optional(),
      description: z.string().max(4000).nullable().optional(),
      custodyModel: z.string().max(500).nullable().optional(),
      apiType: z.string().max(200).nullable().optional(),
      apiDocumentation: z.string().max(2000).nullable().optional(),
      settlementTime: z.string().max(500).nullable().optional(),
      settlementTimeSourceUrl: z.string().max(2000).nullable().optional(),
      settlementHours: z.string().max(500).nullable().optional(),
      settlementHoursSourceUrl: z.string().max(2000).nullable().optional(),
      settlementFee: z.string().max(500).nullable().optional(),
      settlementFeeSourceUrl: z.string().max(2000).nullable().optional(),
      limits: z.string().max(500).nullable().optional(),
      limitsSourceUrl: z.string().max(2000).nullable().optional(),
      markets: list,
      assets: list,
      networks: list,
      useCases: list,
      requirements: list,
      status,
      ...provenance,
    }),
  )
  .handler(({ data }) =>
    sealed(() =>
      upsertProvider({
        id: data.id ?? null,
        name: data.name,
        type: data.type,
        website: data.website ?? null,
        description: data.description ?? null,
        custodyModel: data.custodyModel ?? null,
        apiType: data.apiType ?? null,
        apiDocumentation: data.apiDocumentation ?? null,
        settlementTime: data.settlementTime ?? null,
        settlementTimeSourceUrl: data.settlementTimeSourceUrl ?? null,
        settlementHours: data.settlementHours ?? null,
        settlementHoursSourceUrl: data.settlementHoursSourceUrl ?? null,
        settlementFee: data.settlementFee ?? null,
        settlementFeeSourceUrl: data.settlementFeeSourceUrl ?? null,
        limits: data.limits ?? null,
        limitsSourceUrl: data.limitsSourceUrl ?? null,
        markets: data.markets,
        assets: data.assets,
        networks: data.networks,
        useCases: data.useCases,
        requirements: data.requirements,
        status: data.status,
        sourceUrl: data.sourceUrl,
        lastVerifiedAt: data.lastVerifiedAt,
        lastVerifiedBy: data.lastVerifiedBy,
      }),
    ),
  );

/* ------------------------------------------------------------- licences -- */

export const saveLicence = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid().nullable().optional(),
      providerId: z.string().uuid(),
      name: z.string().min(1).max(300),
      /** Mandatory. A licence claim without its register is unpublishable. */
      registerUrl: z.string().min(1).max(2000),
      jurisdiction: z.string().max(200).nullable().optional(),
      referenceNumber: z.string().max(200).nullable().optional(),
      lastVerifiedAt: z.string().min(1).max(40),
      lastVerifiedBy: z.string().max(200),
    }),
  )
  .handler(({ data }) =>
    sealed(() =>
      upsertLicence({
        id: data.id ?? null,
        providerId: data.providerId,
        name: data.name,
        registerUrl: data.registerUrl,
        jurisdiction: data.jurisdiction ?? null,
        referenceNumber: data.referenceNumber ?? null,
        lastVerifiedAt: data.lastVerifiedAt,
        lastVerifiedBy: data.lastVerifiedBy,
      }),
    ),
  );

export const removeLicence = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(({ data }) => sealed(() => deleteLicence(data.id)));

/* ------------------------------------------------------------ corridors -- */

export const saveCorridor = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid().nullable().optional(),
      originCountry: z.string().min(1).max(120),
      originCountryCode: z.string().min(2).max(3),
      originCurrency: z.string().min(3).max(3),
      destinationCountry: z.string().min(1).max(120),
      destinationCountryCode: z.string().min(2).max(3),
      destinationCurrency: z.string().min(3).max(3),
      destinationConstraints: z.string().max(4000).nullable().optional(),
      destinationConstraintsSourceUrl: z.string().max(2000).nullable().optional(),
      status,
      sourceUrl: z.string().max(2000).nullable().optional(),
      lastVerifiedAt: z.string().min(1).max(40),
      lastVerifiedBy: z.string().max(200),
    }),
  )
  .handler(({ data }) =>
    sealed(() =>
      upsertCorridor({
        id: data.id ?? null,
        originCountry: data.originCountry,
        originCountryCode: data.originCountryCode,
        originCurrency: data.originCurrency,
        destinationCountry: data.destinationCountry,
        destinationCountryCode: data.destinationCountryCode,
        destinationCurrency: data.destinationCurrency,
        destinationConstraints: data.destinationConstraints ?? null,
        destinationConstraintsSourceUrl: data.destinationConstraintsSourceUrl ?? null,
        status: data.status,
        sourceUrl: data.sourceUrl ?? null,
        lastVerifiedAt: data.lastVerifiedAt,
        lastVerifiedBy: data.lastVerifiedBy,
      }),
    ),
  );

export const saveCorridorEvent = createServerFn({ method: "POST" })
  .validator(
    z.object({
      corridorId: z.string().uuid(),
      occurredOn: z.string().min(1).max(40),
      description: z.string().min(1).max(1000),
      sourceUrl: z.string().min(1).max(2000),
    }),
  )
  .handler(({ data }) => sealed(() => addCorridorEvent(data)));

/* --------------------------------------------------------------- routes -- */

export const saveRoute = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid().nullable().optional(),
      corridorId: z.string().uuid(),
      providerId: z.string().uuid(),
      railId: z.string().uuid(),
      type: z.enum(["bank", "local", "stablecoin", "hybrid"]),
      limitMin: z.string().max(40).nullable().optional(),
      limitMinSourceUrl: z.string().max(2000).nullable().optional(),
      limitMax: z.string().max(40).nullable().optional(),
      limitMaxSourceUrl: z.string().max(2000).nullable().optional(),
      limitCurrency: z.string().max(3).nullable().optional(),
      settlementFinality: z.string().max(200).nullable().optional(),
      settlementSystem: z.string().max(200).nullable().optional(),
      settlementFinalitySourceUrl: z.string().max(2000).nullable().optional(),
      operatingHours: z.string().max(500).nullable().optional(),
      operatingHoursSourceUrl: z.string().max(2000).nullable().optional(),
      cutOff: z.string().max(500).nullable().optional(),
      cutOffSourceUrl: z.string().max(2000).nullable().optional(),
      assets: list,
      networks: list,
      requirements: list,
      status,
      ...provenance,
    }),
  )
  .handler(({ data }) =>
    sealed(() =>
      upsertRoute({
        id: data.id ?? null,
        corridorId: data.corridorId,
        providerId: data.providerId,
        railId: data.railId,
        type: data.type,
        limitMin: data.limitMin ?? null,
        limitMinSourceUrl: data.limitMinSourceUrl ?? null,
        limitMax: data.limitMax ?? null,
        limitMaxSourceUrl: data.limitMaxSourceUrl ?? null,
        limitCurrency: data.limitCurrency ?? null,
        settlementFinality: data.settlementFinality ?? null,
        settlementSystem: data.settlementSystem ?? null,
        settlementFinalitySourceUrl: data.settlementFinalitySourceUrl ?? null,
        operatingHours: data.operatingHours ?? null,
        operatingHoursSourceUrl: data.operatingHoursSourceUrl ?? null,
        cutOff: data.cutOff ?? null,
        cutOffSourceUrl: data.cutOffSourceUrl ?? null,
        assets: data.assets,
        networks: data.networks,
        requirements: data.requirements,
        status: data.status,
        sourceUrl: data.sourceUrl,
        lastVerifiedAt: data.lastVerifiedAt,
        lastVerifiedBy: data.lastVerifiedBy,
      }),
    ),
  );

/* ---------------------------------------------------------- submissions -- */

export const submissionQueue = createServerFn({ method: "GET" })
  .validator(z.object({ status: z.enum(["pending", "accepted", "rejected"]).optional() }))
  .handler(({ data }) => sealed(() => listSubmissions(data.status ?? "pending")));

/**
 * Mark a submission reviewed. Takes no field and no value — there is no shape
 * of call here that could write a submitter's claim into a live record.
 */
export const decideSubmission = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["accepted", "rejected"]),
      note: z.string().max(2000).nullable().optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(() => reviewSubmission({ id: data.id, status: data.status, note: data.note ?? null })),
  );
