/**
 * THE PUBLIC READ MODULE — the only unauthenticated read path in the system.
 *
 * Rails Radar's corridor pages are crawlable and have no session. That is an
 * access class `scopedQuery(ctx)` cannot express: it exists to answer "what may
 * THIS user see", and here there is no user. So this module holds a raw handle,
 * and pays for it by being fenced far harder than the general rule fences
 * anything else — see the allowlist entry in eslint.config.js.
 *
 * THE FOUR RULES, all four load-bearing:
 *
 *   1. RADAR TABLES ONLY. This file may not import ../db/schema, so no CRM
 *      table can be named here. A table you cannot name is a table you cannot
 *      query, whatever a future edit intends.
 *
 *   2. PUBLISHED ROWS ONLY, AND THE FILTER IS A LITERAL. `PUBLISHED` below is a
 *      module-private constant. No exported function takes a status argument,
 *      because an argument is a way to widen scope and a literal is not.
 *
 *   3. NO WRITES. Not one. Submissions live in ./submissions.ts, which has no
 *      read path, and admin writes live in ./admin.ts behind requireAuth.
 *
 *   4. A ROUTE IS ONLY AS PUBLISHED AS ITS WEAKEST LINK. A published route
 *      hanging off a draft provider would leak that provider's name, so every
 *      route query joins corridor, provider and rail and requires all four.
 *      The database enforces the same rule independently in radar.v_routes.
 *
 * WHAT THIS MODULE NEVER DOES: compute, interpolate, or infer a value. A null
 * comes back as null and the renderer prints "Not published". There is no
 * fallback, no "typically", no figure derived from another figure.
 */

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../db/client";
import {
  radarCorridorEvents,
  radarCorridors,
  radarLicences,
  radarProviderAssets,
  radarProviderMarkets,
  radarProviderNetworks,
  radarProviderRequirements,
  radarProviderUseCases,
  radarProviders,
  radarRails,
  radarRouteAssets,
  radarRouteNetworks,
  radarRouteRequirements,
  radarRoutes,
} from "../db/radar";

/** The publication gate, as a literal. Never a parameter. See rule 2. */
const PUBLISHED = "published" as const;

/* ---------------------------------------------------------------- types -- */

/**
 * Provenance is part of the type, exactly as the spec requires. A value is
 * either absent, or present WITH the source that backs it — there is no third
 * shape, so a renderer cannot accidentally print a figure with no citation.
 */
export type SourcedValue<T> = {
  value: T;
  sourceUrl: string;
  sourceType: "provider_docs" | "regulator_register" | "provider_confirmed" | "contributed" | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
} | null;

type SourcedColumns = {
  value: string | null;
  sourceUrl: string | null;
  sourceType: SourcedValue<string> extends null
    ? never
    : NonNullable<SourcedValue<string>>["sourceType"];
  verifiedAt: Date | null;
  verifiedBy: string | null;
};

/**
 * The one place a sourced value is assembled. A value with no source URL
 * collapses to null and prints "Not published" — the database CHECK makes that
 * state unreachable through the admin surface, and this is the belt to its
 * braces for any row that predates the constraint.
 */
function sourced<T extends string | number>(c: {
  value: T | null;
  sourceUrl: string | null;
  sourceType: SourcedColumns["sourceType"];
  verifiedAt: Date | null;
  verifiedBy: string | null;
}): SourcedValue<T> {
  if (c.value === null || c.value === undefined) return null;
  if (!c.sourceUrl || c.sourceUrl.trim() === "") return null;
  return {
    value: c.value,
    sourceUrl: c.sourceUrl,
    sourceType: c.sourceType,
    verifiedAt: c.verifiedAt,
    verifiedBy: c.verifiedBy,
  };
}

export type Licence = {
  id: string;
  name: string;
  /** Mandatory by database constraint. A licence claim is unpublishable without it. */
  registerUrl: string;
  jurisdiction: string | null;
  referenceNumber: string | null;
  lastVerifiedAt: Date | null;
};

export type RouteRail = {
  id: string;
  slug: string;
  name: string;
  category: "traditional" | "digital" | "blockchain" | "emerging";
  /**
   * SWIFT carries instructions; it does not settle. Where this is true the
   * renderer attributes finality to `settlementSystem` and never to the rail.
   */
  isMessagingNetwork: boolean;
};

export type PublicRoute = {
  id: string;
  type: "bank" | "local" | "stablecoin" | "hybrid";
  rail: RouteRail;
  provider: { id: string; slug: string; name: string; type: string };
  limitMin: SourcedValue<string>;
  limitMax: SourcedValue<string>;
  limitCurrency: string | null;
  settlementFinality: SourcedValue<string>;
  /** Which system actually confers finality. Null where none is published. */
  settlementSystem: string | null;
  operatingHours: SourcedValue<string>;
  cutOff: SourcedValue<string>;
  assets: string[];
  networks: string[];
  requirements: string[];
  licences: Licence[];
  lastVerifiedAt: Date | null;
  lastVerifiedBy: string | null;
  sourceUrl: string | null;
};

export type PublicCorridor = {
  id: string;
  slug: string;
  origin: { country: string; countryCode: string; currency: string };
  destination: { country: string; countryCode: string; currency: string };
  destinationConstraints: SourcedValue<string>;
  lastVerifiedAt: Date | null;
  updatedAt: Date;
};

export type CorridorEvent = {
  id: string;
  occurredOn: string;
  description: string;
  sourceUrl: string;
};

/* ------------------------------------------------------------ corridors -- */

export async function listPublishedCorridors(): Promise<PublicCorridor[]> {
  const rows = await db
    .select()
    .from(radarCorridors)
    .where(eq(radarCorridors.status, PUBLISHED))
    .orderBy(asc(radarCorridors.originCountry), asc(radarCorridors.destinationCountry));
  return rows.map(toCorridor);
}

export async function getCorridorBySlug(slug: string): Promise<PublicCorridor | null> {
  const rows = await db
    .select()
    .from(radarCorridors)
    .where(and(eq(radarCorridors.slug, slug), eq(radarCorridors.status, PUBLISHED)))
    .limit(1);
  const row = rows[0];
  return row ? toCorridor(row) : null;
}

function toCorridor(row: typeof radarCorridors.$inferSelect): PublicCorridor {
  return {
    id: row.id,
    slug: row.slug,
    origin: {
      country: row.originCountry,
      countryCode: row.originCountryCode,
      currency: row.originCurrency,
    },
    destination: {
      country: row.destinationCountry,
      countryCode: row.destinationCountryCode,
      currency: row.destinationCurrency,
    },
    destinationConstraints: row.destinationConstraints
      ? sourced({
          value: row.destinationConstraints,
          sourceUrl: row.destinationConstraintsSourceUrl,
          sourceType: null,
          verifiedAt: row.lastVerifiedAt,
          verifiedBy: row.lastVerifiedBy,
        })
      : null,
    lastVerifiedAt: row.lastVerifiedAt,
    updatedAt: row.updatedAt,
  };
}

export async function listCorridorEvents(corridorId: string): Promise<CorridorEvent[]> {
  const rows = await db
    .select({
      id: radarCorridorEvents.id,
      occurredOn: radarCorridorEvents.occurredOn,
      description: radarCorridorEvents.description,
      sourceUrl: radarCorridorEvents.sourceUrl,
    })
    .from(radarCorridorEvents)
    .innerJoin(radarCorridors, eq(radarCorridors.id, radarCorridorEvents.corridorId))
    .where(
      and(eq(radarCorridorEvents.corridorId, corridorId), eq(radarCorridors.status, PUBLISHED)),
    )
    .orderBy(desc(radarCorridorEvents.occurredOn));
  return rows;
}

/* --------------------------------------------------------------- routes -- */

/**
 * Every route in a corridor, with everything a card needs, in four queries
 * rather than four per route. The child rows are fetched once by `inArray` and
 * grouped in memory — a corridor with twenty routes should not issue sixty.
 */
export async function listRoutesForCorridor(corridorId: string): Promise<PublicRoute[]> {
  const rows = await db
    .select({ route: radarRoutes, provider: radarProviders, rail: radarRails })
    .from(radarRoutes)
    .innerJoin(radarCorridors, eq(radarCorridors.id, radarRoutes.corridorId))
    .innerJoin(radarProviders, eq(radarProviders.id, radarRoutes.providerId))
    .innerJoin(radarRails, eq(radarRails.id, radarRoutes.railId))
    .where(
      and(
        eq(radarRoutes.corridorId, corridorId),
        /* Rule 4 — all four must be published, or nothing about this route is. */
        eq(radarRoutes.status, PUBLISHED),
        eq(radarCorridors.status, PUBLISHED),
        eq(radarProviders.status, PUBLISHED),
        eq(radarRails.status, PUBLISHED),
      ),
    )
    .orderBy(asc(radarRails.name), asc(radarProviders.name));

  if (rows.length === 0) return [];

  const routeIds = rows.map((r) => r.route.id);
  const providerIds = [...new Set(rows.map((r) => r.provider.id))];

  const [assets, networks, requirements, licences] = await Promise.all([
    db
      .select({ routeId: radarRouteAssets.routeId, v: radarRouteAssets.asset })
      .from(radarRouteAssets)
      .where(inArray(radarRouteAssets.routeId, routeIds))
      .orderBy(asc(radarRouteAssets.asset)),
    db
      .select({ routeId: radarRouteNetworks.routeId, v: radarRouteNetworks.network })
      .from(radarRouteNetworks)
      .where(inArray(radarRouteNetworks.routeId, routeIds))
      .orderBy(asc(radarRouteNetworks.network)),
    db
      .select({ routeId: radarRouteRequirements.routeId, v: radarRouteRequirements.requirement })
      .from(radarRouteRequirements)
      .where(inArray(radarRouteRequirements.routeId, routeIds))
      .orderBy(asc(radarRouteRequirements.requirement)),
    db
      .select()
      .from(radarLicences)
      .where(inArray(radarLicences.providerId, providerIds))
      .orderBy(asc(radarLicences.name)),
  ]);

  const by = <T extends { routeId: string; v: string }>(list: T[]) => {
    const m = new Map<string, string[]>();
    for (const r of list) m.set(r.routeId, [...(m.get(r.routeId) ?? []), r.v]);
    return m;
  };
  const assetsBy = by(assets);
  const networksBy = by(networks);
  const requirementsBy = by(requirements);

  const licencesBy = new Map<string, Licence[]>();
  for (const l of licences) {
    licencesBy.set(l.providerId, [
      ...(licencesBy.get(l.providerId) ?? []),
      {
        id: l.id,
        name: l.name,
        registerUrl: l.registerUrl,
        jurisdiction: l.jurisdiction,
        referenceNumber: l.referenceNumber,
        lastVerifiedAt: l.lastVerifiedAt,
      },
    ]);
  }

  return rows.map(({ route: r, provider: p, rail: l }) => ({
    id: r.id,
    type: r.type,
    rail: {
      id: l.id,
      slug: l.slug,
      name: l.name,
      category: l.category,
      isMessagingNetwork: l.isMessagingNetwork,
    },
    provider: { id: p.id, slug: p.slug, name: p.name, type: p.type },
    limitMin: sourced({
      value: r.limitMin,
      sourceUrl: r.limitMinSourceUrl,
      sourceType: r.limitMinSourceType,
      verifiedAt: r.limitMinVerifiedAt,
      verifiedBy: r.limitMinVerifiedBy,
    }),
    limitMax: sourced({
      value: r.limitMax,
      sourceUrl: r.limitMaxSourceUrl,
      sourceType: r.limitMaxSourceType,
      verifiedAt: r.limitMaxVerifiedAt,
      verifiedBy: r.limitMaxVerifiedBy,
    }),
    limitCurrency: r.limitCurrency,
    settlementFinality: sourced({
      value: r.settlementFinality,
      sourceUrl: r.settlementFinalitySourceUrl,
      sourceType: r.settlementFinalitySourceType,
      verifiedAt: r.settlementFinalityVerifiedAt,
      verifiedBy: r.settlementFinalityVerifiedBy,
    }),
    settlementSystem: r.settlementSystem,
    operatingHours: sourced({
      value: r.operatingHours,
      sourceUrl: r.operatingHoursSourceUrl,
      sourceType: r.operatingHoursSourceType,
      verifiedAt: r.operatingHoursVerifiedAt,
      verifiedBy: r.operatingHoursVerifiedBy,
    }),
    cutOff: sourced({
      value: r.cutOff,
      sourceUrl: r.cutOffSourceUrl,
      sourceType: r.cutOffSourceType,
      verifiedAt: r.cutOffVerifiedAt,
      verifiedBy: r.cutOffVerifiedBy,
    }),
    assets: assetsBy.get(r.id) ?? [],
    networks: networksBy.get(r.id) ?? [],
    requirements: requirementsBy.get(r.id) ?? [],
    licences: licencesBy.get(p.id) ?? [],
    lastVerifiedAt: r.lastVerifiedAt,
    lastVerifiedBy: r.lastVerifiedBy,
    sourceUrl: r.sourceUrl,
  }));
}

/**
 * AMOUNT IS A FILTER, NOT A PRICE. It removes routes whose PUBLISHED limits
 * exclude it, and does nothing else — there is no cost model behind it.
 *
 * Two rules keep it honest:
 *   · an unpublished bound never excludes anything. Absence of a limit is not
 *     evidence of a limit, so a route with no published max stays in.
 *   · a limit in a different currency never excludes anything either. Comparing
 *     across currencies needs an FX rate, this product does not have one, and
 *     inventing one to filter a list is the same sin as inventing a fee.
 */
export function filterRoutesByAmount(
  routes: PublicRoute[],
  amount: number | null,
  amountCurrency: string,
): { routes: PublicRoute[]; excluded: number } {
  if (amount === null || !Number.isFinite(amount)) return { routes, excluded: 0 };

  const kept = routes.filter((r) => {
    if (!r.limitCurrency || r.limitCurrency !== amountCurrency) return true;
    const min = r.limitMin ? Number(r.limitMin.value) : null;
    const max = r.limitMax ? Number(r.limitMax.value) : null;
    if (min !== null && Number.isFinite(min) && amount < min) return false;
    if (max !== null && Number.isFinite(max) && amount > max) return false;
    return true;
  });

  return { routes: kept, excluded: routes.length - kept.length };
}

/* ------------------------------------------------------------ providers -- */

export type PublicProvider = {
  id: string;
  slug: string;
  name: string;
  type: string;
  website: string | null;
  description: string | null;
  custodyModel: string | null;
  apiType: string | null;
  apiDocumentation: string | null;
  settlementTime: SourcedValue<string>;
  settlementHours: SourcedValue<string>;
  settlementFee: SourcedValue<string>;
  limits: SourcedValue<string>;
  markets: string[];
  assets: string[];
  networks: string[];
  useCases: string[];
  requirements: string[];
  licences: Licence[];
  lastVerifiedAt: Date | null;
  lastVerifiedBy: string | null;
  sourceUrl: string | null;
};

export async function getProviderBySlug(slug: string): Promise<PublicProvider | null> {
  const rows = await db
    .select()
    .from(radarProviders)
    .where(and(eq(radarProviders.slug, slug), eq(radarProviders.status, PUBLISHED)))
    .limit(1);
  const p = rows[0];
  if (!p) return null;

  const [markets, assets, networks, useCases, requirements, licences] = await Promise.all([
    db
      .select({ v: radarProviderMarkets.market })
      .from(radarProviderMarkets)
      .where(eq(radarProviderMarkets.providerId, p.id))
      .orderBy(asc(radarProviderMarkets.market)),
    db
      .select({ v: radarProviderAssets.asset })
      .from(radarProviderAssets)
      .where(eq(radarProviderAssets.providerId, p.id))
      .orderBy(asc(radarProviderAssets.asset)),
    db
      .select({ v: radarProviderNetworks.network })
      .from(radarProviderNetworks)
      .where(eq(radarProviderNetworks.providerId, p.id))
      .orderBy(asc(radarProviderNetworks.network)),
    db
      .select({ v: radarProviderUseCases.useCase })
      .from(radarProviderUseCases)
      .where(eq(radarProviderUseCases.providerId, p.id))
      .orderBy(asc(radarProviderUseCases.useCase)),
    db
      .select({ v: radarProviderRequirements.requirement })
      .from(radarProviderRequirements)
      .where(eq(radarProviderRequirements.providerId, p.id))
      .orderBy(asc(radarProviderRequirements.requirement)),
    db
      .select()
      .from(radarLicences)
      .where(eq(radarLicences.providerId, p.id))
      .orderBy(asc(radarLicences.name)),
  ]);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    type: p.type,
    website: p.website,
    description: p.description,
    custodyModel: p.custodyModel,
    apiType: p.apiType,
    apiDocumentation: p.apiDocumentation,
    settlementTime: sourced({
      value: p.settlementTime,
      sourceUrl: p.settlementTimeSourceUrl,
      sourceType: p.settlementTimeSourceType,
      verifiedAt: p.settlementTimeVerifiedAt,
      verifiedBy: p.settlementTimeVerifiedBy,
    }),
    settlementHours: sourced({
      value: p.settlementHours,
      sourceUrl: p.settlementHoursSourceUrl,
      sourceType: p.settlementHoursSourceType,
      verifiedAt: p.settlementHoursVerifiedAt,
      verifiedBy: p.settlementHoursVerifiedBy,
    }),
    settlementFee: sourced({
      value: p.settlementFee,
      sourceUrl: p.settlementFeeSourceUrl,
      sourceType: p.settlementFeeSourceType,
      verifiedAt: p.settlementFeeVerifiedAt,
      verifiedBy: p.settlementFeeVerifiedBy,
    }),
    limits: sourced({
      value: p.limits,
      sourceUrl: p.limitsSourceUrl,
      sourceType: p.limitsSourceType,
      verifiedAt: p.limitsVerifiedAt,
      verifiedBy: p.limitsVerifiedBy,
    }),
    markets: markets.map((r) => r.v),
    assets: assets.map((r) => r.v),
    networks: networks.map((r) => r.v),
    useCases: useCases.map((r) => r.v),
    requirements: requirements.map((r) => r.v),
    licences: licences.map((l) => ({
      id: l.id,
      name: l.name,
      registerUrl: l.registerUrl,
      jurisdiction: l.jurisdiction,
      referenceNumber: l.referenceNumber,
      lastVerifiedAt: l.lastVerifiedAt,
    })),
    lastVerifiedAt: p.lastVerifiedAt,
    lastVerifiedBy: p.lastVerifiedBy,
    sourceUrl: p.sourceUrl,
  };
}

/** The corridors a provider is reachable in. Published on both sides. */
export async function listCorridorsForProvider(providerId: string) {
  const rows = await db
    .select({
      corridorSlug: radarCorridors.slug,
      originCountry: radarCorridors.originCountry,
      originCurrency: radarCorridors.originCurrency,
      destinationCountry: radarCorridors.destinationCountry,
      destinationCurrency: radarCorridors.destinationCurrency,
      railName: radarRails.name,
      routeId: radarRoutes.id,
      limitMin: radarRoutes.limitMin,
      limitMinSourceUrl: radarRoutes.limitMinSourceUrl,
      limitMax: radarRoutes.limitMax,
      limitMaxSourceUrl: radarRoutes.limitMaxSourceUrl,
      limitCurrency: radarRoutes.limitCurrency,
    })
    .from(radarRoutes)
    .innerJoin(radarCorridors, eq(radarCorridors.id, radarRoutes.corridorId))
    .innerJoin(radarRails, eq(radarRails.id, radarRoutes.railId))
    .innerJoin(radarProviders, eq(radarProviders.id, radarRoutes.providerId))
    .where(
      and(
        eq(radarRoutes.providerId, providerId),
        eq(radarRoutes.status, PUBLISHED),
        eq(radarCorridors.status, PUBLISHED),
        eq(radarRails.status, PUBLISHED),
        eq(radarProviders.status, PUBLISHED),
      ),
    )
    .orderBy(asc(radarCorridors.originCountry), asc(radarCorridors.destinationCountry));

  const routeIds = rows.map((r) => r.routeId);
  const assets = routeIds.length
    ? await db
        .select({ routeId: radarRouteAssets.routeId, v: radarRouteAssets.asset })
        .from(radarRouteAssets)
        .where(inArray(radarRouteAssets.routeId, routeIds))
        .orderBy(asc(radarRouteAssets.asset))
    : [];

  const assetsBy = new Map<string, string[]>();
  for (const a of assets) assetsBy.set(a.routeId, [...(assetsBy.get(a.routeId) ?? []), a.v]);

  return rows.map((r) => ({
    corridorSlug: r.corridorSlug,
    origin: `${r.originCountry} (${r.originCurrency})`,
    destination: `${r.destinationCountry} (${r.destinationCurrency})`,
    railName: r.railName,
    assets: assetsBy.get(r.routeId) ?? [],
    limitMin: sourced({
      value: r.limitMin,
      sourceUrl: r.limitMinSourceUrl,
      sourceType: null,
      verifiedAt: null,
      verifiedBy: null,
    }),
    limitMax: sourced({
      value: r.limitMax,
      sourceUrl: r.limitMaxSourceUrl,
      sourceType: null,
      verifiedAt: null,
      verifiedBy: null,
    }),
    limitCurrency: r.limitCurrency,
  }));
}

export async function listPublishedProviders() {
  return db
    .select({
      slug: radarProviders.slug,
      name: radarProviders.name,
      type: radarProviders.type,
      lastVerifiedAt: radarProviders.lastVerifiedAt,
    })
    .from(radarProviders)
    .where(eq(radarProviders.status, PUBLISHED))
    .orderBy(asc(radarProviders.name));
}

/* ---------------------------------------------------------------- rails -- */

export async function listPublishedRails() {
  return db
    .select({
      id: radarRails.id,
      slug: radarRails.slug,
      name: radarRails.name,
      category: radarRails.category,
      description: radarRails.description,
      isMessagingNetwork: radarRails.isMessagingNetwork,
      lastVerifiedAt: radarRails.lastVerifiedAt,
      sourceUrl: radarRails.sourceUrl,
    })
    .from(radarRails)
    .where(eq(radarRails.status, PUBLISHED))
    .orderBy(asc(radarRails.name));
}

export async function getRailBySlug(slug: string) {
  const rows = await db
    .select()
    .from(radarRails)
    .where(and(eq(radarRails.slug, slug), eq(radarRails.status, PUBLISHED)))
    .limit(1);
  return rows[0] ?? null;
}

/* --------------------------------------------------------------- counts -- */

/**
 * The footer counts, from actual rows. Never a hardcoded "127 rails tracked".
 * If the database is empty these are zero and the footer says zero, which is
 * the truthful thing for it to say.
 */
export async function publishedCounts(): Promise<{
  rails: number;
  providers: number;
  corridors: number;
  routes: number;
}> {
  const [rails, providers, corridors, routes] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(radarRails)
      .where(eq(radarRails.status, PUBLISHED)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(radarProviders)
      .where(eq(radarProviders.status, PUBLISHED)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(radarCorridors)
      .where(eq(radarCorridors.status, PUBLISHED)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(radarRoutes)
      .where(eq(radarRoutes.status, PUBLISHED)),
  ]);

  return {
    rails: rails[0]?.n ?? 0,
    providers: providers[0]?.n ?? 0,
    corridors: corridors[0]?.n ?? 0,
    routes: routes[0]?.n ?? 0,
  };
}
