/**
 * THE ADMIN SURFACE — every write in Rails Radar, all of them authenticated.
 *
 * There is no public write path to any of this. `requireRadarEditor()` is the
 * first line of every exported function, and it resolves identity from the
 * database on this request — not from a JWT claim, which is minted at login and
 * would keep working after a grant was revoked. That is the same rule the CRM
 * follows, for the same reason, and it is enforced here rather than in the
 * route so calling the endpoint directly gains nothing.
 *
 * TWO RULES THE SPEC MAKES NON-NEGOTIABLE, enforced here AND by CHECK
 * constraints in the database:
 *
 *   · a value is unpublishable without the source URL that backs it
 *   · a licence is unpublishable without the register it appears on
 *
 * AND THE ONE ABOUT SUBMISSIONS: reviewing a submission NEVER writes to a live
 * field. `reviewSubmission` sets a status and a note, and that is all it can
 * do — there is no argument it takes that could promote a claim into data. An
 * editor who accepts a submission then types the record themselves, having
 * opened the source. The verification is the product; automating it away would
 * be removing the product.
 */

import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { db } from "../db/client";
import { AuthError, forbidden, requireAuth } from "../auth/context";
import type { AuthContext } from "../auth/permissions";
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
  radarSubmissions,
} from "../db/radar";
import { corridorSlug, slugify } from "./slug";

/**
 * Who may edit Radar. Editorial work, so Super Admin and Admin — a Team Member
 * is scoped to their own pipeline and has no business publishing a claim about
 * a named institution's licences.
 */
export function canEditRadar(ctx: AuthContext): boolean {
  return ctx.role === "super_admin" || ctx.role === "admin";
}

export async function requireRadarEditor(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!canEditRadar(ctx)) throw forbidden("Editing Rails Radar requires an admin account.");
  return ctx;
}

export class RadarValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "RadarValidationError";
  }
}

/** Mandatory provenance, checked before the database gets a chance to. The
    error a person reads should name the field, not the constraint. */
function requireSource(url: string | null | undefined, field: string): string {
  const v = url?.trim() ?? "";
  if (!v)
    throw new RadarValidationError(`${field} needs a source URL. Nothing publishes without one.`);
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
  } catch {
    throw new RadarValidationError(
      `The source for ${field} must be a link starting http:// or https://`,
    );
  }
  return v;
}

/** A sourced value arrives whole or not at all. Passing a value with no source
    is rejected here; passing neither clears the field, which is legitimate —
    a figure a provider withdrew should go back to "Not published". */
function sourcedPair(
  value: string | null | undefined,
  sourceUrl: string | null | undefined,
  field: string,
): { value: string | null; sourceUrl: string | null } {
  const v = value?.trim() ?? "";
  if (!v) return { value: null, sourceUrl: null };
  return { value: v, sourceUrl: requireSource(sourceUrl, field) };
}

/* ============================================================ rails ====== */

export type RailInput = {
  id?: string | null;
  name: string;
  category: "traditional" | "digital" | "blockchain" | "emerging";
  description?: string | null;
  icon?: string | null;
  isMessagingNetwork: boolean;
  status: "draft" | "published" | "archived";
  sourceUrl: string;
  lastVerifiedAt: string;
  lastVerifiedBy: string;
};

export async function upsertRail(input: RailInput) {
  const ctx = await requireRadarEditor();
  const sourceUrl = requireSource(input.sourceUrl, "This rail");
  const name = input.name.trim();
  if (!name) throw new RadarValidationError("A rail needs a name.");

  const values = {
    name,
    category: input.category,
    description: input.description?.trim() || null,
    icon: input.icon?.trim() || null,
    isMessagingNetwork: input.isMessagingNetwork,
    status: input.status,
    sourceUrl,
    lastVerifiedAt: new Date(input.lastVerifiedAt),
    lastVerifiedBy: input.lastVerifiedBy.trim() || ctx.fullName,
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };

  if (input.id) {
    const rows = await db
      .update(radarRails)
      .set(values)
      .where(eq(radarRails.id, input.id))
      .returning({ id: radarRails.id });
    return { id: rows[0]?.id ?? input.id };
  }

  const rows = await db
    .insert(radarRails)
    .values({ ...values, slug: slugify(name), createdBy: ctx.userId })
    .returning({ id: radarRails.id });
  return { id: rows[0]!.id };
}

export async function listRailsForAdmin() {
  await requireRadarEditor();
  return db.select().from(radarRails).orderBy(asc(radarRails.name));
}

/* ======================================================== providers ====== */

export type ProviderInput = {
  id?: string | null;
  name: string;
  type:
    "bank" | "psp" | "orchestration" | "stablecoin" | "fx" | "custodian" | "exchange" | "onramp";
  website?: string | null;
  description?: string | null;
  custodyModel?: string | null;
  apiType?: string | null;
  apiDocumentation?: string | null;
  settlementTime?: string | null;
  settlementTimeSourceUrl?: string | null;
  settlementHours?: string | null;
  settlementHoursSourceUrl?: string | null;
  settlementFee?: string | null;
  settlementFeeSourceUrl?: string | null;
  limits?: string | null;
  limitsSourceUrl?: string | null;
  markets: string[];
  assets: string[];
  networks: string[];
  useCases: string[];
  requirements: string[];
  status: "draft" | "published" | "archived";
  sourceUrl: string;
  lastVerifiedAt: string;
  lastVerifiedBy: string;
};

export async function upsertProvider(input: ProviderInput) {
  const ctx = await requireRadarEditor();
  const sourceUrl = requireSource(input.sourceUrl, "This provider");
  const name = input.name.trim();
  if (!name) throw new RadarValidationError("A provider needs a name.");

  const time = sourcedPair(input.settlementTime, input.settlementTimeSourceUrl, "Settlement time");
  const hours = sourcedPair(
    input.settlementHours,
    input.settlementHoursSourceUrl,
    "Settlement hours",
  );
  const fee = sourcedPair(input.settlementFee, input.settlementFeeSourceUrl, "Settlement fee");
  const limits = sourcedPair(input.limits, input.limitsSourceUrl, "Limits");
  const verifiedAt = new Date(input.lastVerifiedAt);
  const verifiedBy = input.lastVerifiedBy.trim() || ctx.fullName;

  const values = {
    name,
    type: input.type,
    website: input.website?.trim() || null,
    description: input.description?.trim() || null,
    custodyModel: input.custodyModel?.trim() || null,
    apiType: input.apiType?.trim() || null,
    apiDocumentation: input.apiDocumentation?.trim() || null,
    settlementTime: time.value,
    settlementTimeSourceUrl: time.sourceUrl,
    settlementTimeSourceType: time.value ? ("provider_docs" as const) : null,
    settlementTimeVerifiedAt: time.value ? verifiedAt : null,
    settlementTimeVerifiedBy: time.value ? verifiedBy : null,
    settlementHours: hours.value,
    settlementHoursSourceUrl: hours.sourceUrl,
    settlementHoursSourceType: hours.value ? ("provider_docs" as const) : null,
    settlementHoursVerifiedAt: hours.value ? verifiedAt : null,
    settlementHoursVerifiedBy: hours.value ? verifiedBy : null,
    settlementFee: fee.value,
    settlementFeeSourceUrl: fee.sourceUrl,
    settlementFeeSourceType: fee.value ? ("provider_docs" as const) : null,
    settlementFeeVerifiedAt: fee.value ? verifiedAt : null,
    settlementFeeVerifiedBy: fee.value ? verifiedBy : null,
    limits: limits.value,
    limitsSourceUrl: limits.sourceUrl,
    limitsSourceType: limits.value ? ("provider_docs" as const) : null,
    limitsVerifiedAt: limits.value ? verifiedAt : null,
    limitsVerifiedBy: limits.value ? verifiedBy : null,
    status: input.status,
    sourceUrl,
    lastVerifiedAt: verifiedAt,
    lastVerifiedBy: verifiedBy,
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };

  const id = input.id
    ? ((
        await db
          .update(radarProviders)
          .set(values)
          .where(eq(radarProviders.id, input.id))
          .returning({ id: radarProviders.id })
      )[0]?.id ?? input.id)
    : (
        await db
          .insert(radarProviders)
          .values({ ...values, slug: slugify(name), createdBy: ctx.userId })
          .returning({ id: radarProviders.id })
      )[0]!.id;

  await replaceChildren(id, input);
  return { id };
}

/** Child rows are replaced wholesale. Diffing five small sets buys nothing and
    is the kind of code that silently drops one. */
async function replaceChildren(providerId: string, input: ProviderInput) {
  const clean = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
  await Promise.all([
    db.delete(radarProviderMarkets).where(eq(radarProviderMarkets.providerId, providerId)),
    db.delete(radarProviderAssets).where(eq(radarProviderAssets.providerId, providerId)),
    db.delete(radarProviderNetworks).where(eq(radarProviderNetworks.providerId, providerId)),
    db.delete(radarProviderUseCases).where(eq(radarProviderUseCases.providerId, providerId)),
    db
      .delete(radarProviderRequirements)
      .where(eq(radarProviderRequirements.providerId, providerId)),
  ]);

  const markets = clean(input.markets);
  const assets = clean(input.assets);
  const networks = clean(input.networks);
  const useCases = clean(input.useCases);
  const requirements = clean(input.requirements);

  await Promise.all([
    markets.length
      ? db.insert(radarProviderMarkets).values(markets.map((market) => ({ providerId, market })))
      : Promise.resolve(),
    assets.length
      ? db.insert(radarProviderAssets).values(assets.map((asset) => ({ providerId, asset })))
      : Promise.resolve(),
    networks.length
      ? db
          .insert(radarProviderNetworks)
          .values(networks.map((network) => ({ providerId, network })))
      : Promise.resolve(),
    useCases.length
      ? db
          .insert(radarProviderUseCases)
          .values(useCases.map((useCase) => ({ providerId, useCase })))
      : Promise.resolve(),
    requirements.length
      ? db
          .insert(radarProviderRequirements)
          .values(requirements.map((requirement) => ({ providerId, requirement })))
      : Promise.resolve(),
  ]);
}

/**
 * Providers WITH their child rows and licences.
 *
 * An edit form has to repopulate what is already there; returning bare provider
 * rows means every edit silently blanks the markets, assets, networks and
 * requirements, because `replaceChildren` writes whatever the form submits.
 * That is why this fans out rather than selecting the parent alone.
 */
export async function listProvidersForAdmin() {
  await requireRadarEditor();
  const rows = await db.select().from(radarProviders).orderBy(asc(radarProviders.name));
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [markets, assets, networks, requirements, licences] = await Promise.all([
    db.select().from(radarProviderMarkets).where(inArray(radarProviderMarkets.providerId, ids)),
    db.select().from(radarProviderAssets).where(inArray(radarProviderAssets.providerId, ids)),
    db.select().from(radarProviderNetworks).where(inArray(radarProviderNetworks.providerId, ids)),
    db
      .select()
      .from(radarProviderRequirements)
      .where(inArray(radarProviderRequirements.providerId, ids)),
    db
      .select()
      .from(radarLicences)
      .where(inArray(radarLicences.providerId, ids))
      .orderBy(asc(radarLicences.name)),
  ]);

  const group = <T extends { providerId: string }>(list: T[], pick: (t: T) => string) => {
    const m = new Map<string, string[]>();
    for (const r of list) m.set(r.providerId, [...(m.get(r.providerId) ?? []), pick(r)]);
    return m;
  };
  const m1 = group(markets, (r) => r.market);
  const m2 = group(assets, (r) => r.asset);
  const m3 = group(networks, (r) => r.network);
  const m4 = group(requirements, (r) => r.requirement);
  const lic = new Map<string, typeof licences>();
  for (const l of licences) lic.set(l.providerId, [...(lic.get(l.providerId) ?? []), l]);

  return rows.map((p) => ({
    ...p,
    markets: (m1.get(p.id) ?? []).sort(),
    assets: (m2.get(p.id) ?? []).sort(),
    networks: (m3.get(p.id) ?? []).sort(),
    requirements: (m4.get(p.id) ?? []).sort(),
    licences: lic.get(p.id) ?? [],
  }));
}

/* ========================================================= licences ====== */

export async function upsertLicence(input: {
  id?: string | null;
  providerId: string;
  name: string;
  registerUrl: string;
  jurisdiction?: string | null;
  referenceNumber?: string | null;
  lastVerifiedAt: string;
  lastVerifiedBy: string;
}) {
  const ctx = await requireRadarEditor();
  const name = input.name.trim();
  if (!name) throw new RadarValidationError("A licence needs a name.");
  /* The legal tightening, at the only place a licence can be created. */
  const registerUrl = requireSource(input.registerUrl, `The "${name}" licence`);

  const values = {
    providerId: input.providerId,
    name,
    registerUrl,
    jurisdiction: input.jurisdiction?.trim() || null,
    referenceNumber: input.referenceNumber?.trim() || null,
    sourceUrl: registerUrl,
    lastVerifiedAt: new Date(input.lastVerifiedAt),
    lastVerifiedBy: input.lastVerifiedBy.trim() || ctx.fullName,
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };

  if (input.id) {
    await db.update(radarLicences).set(values).where(eq(radarLicences.id, input.id));
    return { id: input.id };
  }
  const rows = await db
    .insert(radarLicences)
    .values({ ...values, createdBy: ctx.userId })
    .returning({ id: radarLicences.id });
  return { id: rows[0]!.id };
}

export async function deleteLicence(id: string) {
  await requireRadarEditor();
  await db.delete(radarLicences).where(eq(radarLicences.id, id));
  return { ok: true as const };
}

/* ======================================================== corridors ====== */

export async function upsertCorridor(input: {
  id?: string | null;
  originCountry: string;
  originCountryCode: string;
  originCurrency: string;
  destinationCountry: string;
  destinationCountryCode: string;
  destinationCurrency: string;
  destinationConstraints?: string | null;
  destinationConstraintsSourceUrl?: string | null;
  status: "draft" | "published" | "archived";
  sourceUrl?: string | null;
  lastVerifiedAt: string;
  lastVerifiedBy: string;
}) {
  const ctx = await requireRadarEditor();
  const constraints = sourcedPair(
    input.destinationConstraints,
    input.destinationConstraintsSourceUrl,
    "Destination constraints",
  );

  const values = {
    originCountry: input.originCountry.trim(),
    originCountryCode: input.originCountryCode.trim().toUpperCase(),
    originCurrency: input.originCurrency.trim().toUpperCase(),
    destinationCountry: input.destinationCountry.trim(),
    destinationCountryCode: input.destinationCountryCode.trim().toUpperCase(),
    destinationCurrency: input.destinationCurrency.trim().toUpperCase(),
    destinationConstraints: constraints.value,
    destinationConstraintsSourceUrl: constraints.sourceUrl,
    status: input.status,
    sourceUrl: input.sourceUrl?.trim() || null,
    lastVerifiedAt: new Date(input.lastVerifiedAt),
    lastVerifiedBy: input.lastVerifiedBy.trim() || ctx.fullName,
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };

  if (input.id) {
    /* The slug is NOT recomputed. It is the identity of every inbound link. */
    await db.update(radarCorridors).set(values).where(eq(radarCorridors.id, input.id));
    return { id: input.id };
  }

  const rows = await db
    .insert(radarCorridors)
    .values({
      ...values,
      slug: corridorSlug(values.originCountry, values.destinationCountry),
      createdBy: ctx.userId,
    })
    .returning({ id: radarCorridors.id });
  return { id: rows[0]!.id };
}

export async function listCorridorsForAdmin() {
  await requireRadarEditor();
  return db
    .select({
      id: radarCorridors.id,
      slug: radarCorridors.slug,
      originCountry: radarCorridors.originCountry,
      originCurrency: radarCorridors.originCurrency,
      destinationCountry: radarCorridors.destinationCountry,
      destinationCurrency: radarCorridors.destinationCurrency,
      originCountryCode: radarCorridors.originCountryCode,
      destinationCountryCode: radarCorridors.destinationCountryCode,
      destinationConstraints: radarCorridors.destinationConstraints,
      destinationConstraintsSourceUrl: radarCorridors.destinationConstraintsSourceUrl,
      status: radarCorridors.status,
      lastVerifiedAt: radarCorridors.lastVerifiedAt,
      lastVerifiedBy: radarCorridors.lastVerifiedBy,
      /* A correlated subquery here re-ran per row — an N+1 written in SQL. A
         left join and a group by is one pass, and returns 0 rather than null
         for a corridor with no routes. */
      routeCount: sql<number>`count(${radarRoutes.id})::int`,
    })
    .from(radarCorridors)
    .leftJoin(radarRoutes, eq(radarRoutes.corridorId, radarCorridors.id))
    .groupBy(radarCorridors.id)
    .orderBy(asc(radarCorridors.originCountry), asc(radarCorridors.destinationCountry));
}

export async function addCorridorEvent(input: {
  corridorId: string;
  occurredOn: string;
  description: string;
  sourceUrl: string;
}) {
  const ctx = await requireRadarEditor();
  const description = input.description.trim();
  if (!description) throw new RadarValidationError("A structural event needs a description.");
  const sourceUrl = requireSource(input.sourceUrl, "This event");
  await db.insert(radarCorridorEvents).values({
    corridorId: input.corridorId,
    occurredOn: input.occurredOn,
    description,
    sourceUrl,
    createdBy: ctx.userId,
  });
  return { ok: true as const };
}

/* =========================================================== routes ====== */

export type RouteInput = {
  id?: string | null;
  corridorId: string;
  providerId: string;
  railId: string;
  type: "bank" | "local" | "stablecoin" | "hybrid";
  limitMin?: string | null;
  limitMinSourceUrl?: string | null;
  limitMax?: string | null;
  limitMaxSourceUrl?: string | null;
  limitCurrency?: string | null;
  settlementFinality?: string | null;
  settlementSystem?: string | null;
  settlementFinalitySourceUrl?: string | null;
  operatingHours?: string | null;
  operatingHoursSourceUrl?: string | null;
  cutOff?: string | null;
  cutOffSourceUrl?: string | null;
  assets: string[];
  networks: string[];
  requirements: string[];
  status: "draft" | "published" | "archived";
  sourceUrl: string;
  lastVerifiedAt: string;
  lastVerifiedBy: string;
};

export async function upsertRoute(input: RouteInput) {
  const ctx = await requireRadarEditor();
  const sourceUrl = requireSource(input.sourceUrl, "This route");
  const verifiedAt = new Date(input.lastVerifiedAt);
  const verifiedBy = input.lastVerifiedBy.trim() || ctx.fullName;

  const min = sourcedPair(input.limitMin, input.limitMinSourceUrl, "Minimum limit");
  const max = sourcedPair(input.limitMax, input.limitMaxSourceUrl, "Maximum limit");
  const finality = sourcedPair(
    input.settlementFinality,
    input.settlementFinalitySourceUrl,
    "Settlement finality",
  );
  const hours = sourcedPair(input.operatingHours, input.operatingHoursSourceUrl, "Operating hours");
  const cutOff = sourcedPair(input.cutOff, input.cutOffSourceUrl, "Cut-off");

  if ((min.value || max.value) && !input.limitCurrency?.trim()) {
    throw new RadarValidationError(
      "A limit needs the currency it is denominated in — a bare number is not a limit.",
    );
  }

  /**
   * THE ONTOLOGY, enforced rather than documented. A messaging network carries
   * instructions; it does not settle. Attributing finality to one is the exact
   * category error this product exists not to make, so the write is refused.
   */
  if (finality.value) {
    const rail = (
      await db
        .select({ isMessaging: radarRails.isMessagingNetwork, name: radarRails.name })
        .from(radarRails)
        .where(eq(radarRails.id, input.railId))
        .limit(1)
    )[0];
    if (rail?.isMessaging && !input.settlementSystem?.trim()) {
      throw new RadarValidationError(
        `${rail.name} is a messaging network, not a settlement system. Name the settlement system that confers finality before recording it.`,
      );
    }
  }

  const values = {
    corridorId: input.corridorId,
    providerId: input.providerId,
    railId: input.railId,
    type: input.type,
    limitMin: min.value,
    limitMinSourceUrl: min.sourceUrl,
    limitMinSourceType: min.value ? ("provider_docs" as const) : null,
    limitMinVerifiedAt: min.value ? verifiedAt : null,
    limitMinVerifiedBy: min.value ? verifiedBy : null,
    limitMax: max.value,
    limitMaxSourceUrl: max.sourceUrl,
    limitMaxSourceType: max.value ? ("provider_docs" as const) : null,
    limitMaxVerifiedAt: max.value ? verifiedAt : null,
    limitMaxVerifiedBy: max.value ? verifiedBy : null,
    limitCurrency: min.value || max.value ? input.limitCurrency!.trim().toUpperCase() : null,
    settlementFinality: finality.value,
    settlementSystem: input.settlementSystem?.trim() || null,
    settlementFinalitySourceUrl: finality.sourceUrl,
    settlementFinalitySourceType: finality.value ? ("provider_docs" as const) : null,
    settlementFinalityVerifiedAt: finality.value ? verifiedAt : null,
    settlementFinalityVerifiedBy: finality.value ? verifiedBy : null,
    operatingHours: hours.value,
    operatingHoursSourceUrl: hours.sourceUrl,
    operatingHoursSourceType: hours.value ? ("provider_docs" as const) : null,
    operatingHoursVerifiedAt: hours.value ? verifiedAt : null,
    operatingHoursVerifiedBy: hours.value ? verifiedBy : null,
    cutOff: cutOff.value,
    cutOffSourceUrl: cutOff.sourceUrl,
    cutOffSourceType: cutOff.value ? ("provider_docs" as const) : null,
    cutOffVerifiedAt: cutOff.value ? verifiedAt : null,
    cutOffVerifiedBy: cutOff.value ? verifiedBy : null,
    status: input.status,
    sourceUrl,
    lastVerifiedAt: verifiedAt,
    lastVerifiedBy: verifiedBy,
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };

  const id = input.id
    ? ((
        await db
          .update(radarRoutes)
          .set(values)
          .where(eq(radarRoutes.id, input.id))
          .returning({ id: radarRoutes.id })
      )[0]?.id ?? input.id)
    : (
        await db
          .insert(radarRoutes)
          .values({ ...values, createdBy: ctx.userId })
          .returning({ id: radarRoutes.id })
      )[0]!.id;

  const clean = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
  await Promise.all([
    db.delete(radarRouteAssets).where(eq(radarRouteAssets.routeId, id)),
    db.delete(radarRouteNetworks).where(eq(radarRouteNetworks.routeId, id)),
    db.delete(radarRouteRequirements).where(eq(radarRouteRequirements.routeId, id)),
  ]);
  const assets = clean(input.assets);
  const networks = clean(input.networks);
  const requirements = clean(input.requirements);
  await Promise.all([
    assets.length
      ? db.insert(radarRouteAssets).values(assets.map((asset) => ({ routeId: id, asset })))
      : Promise.resolve(),
    networks.length
      ? db.insert(radarRouteNetworks).values(networks.map((network) => ({ routeId: id, network })))
      : Promise.resolve(),
    requirements.length
      ? db
          .insert(radarRouteRequirements)
          .values(requirements.map((requirement) => ({ routeId: id, requirement })))
      : Promise.resolve(),
  ]);

  return { id };
}

/** Full route rows plus their child arrays — an edit form must be able to
    repopulate assets, networks and requirements, which are replaced wholesale
    on save. Draft rows are included: this is the editing surface, not the
    public one. */
async function routeRows(corridorId: string) {
  const rows = await db
    .select({
      route: radarRoutes,
      providerName: radarProviders.name,
      railName: radarRails.name,
      railIsMessaging: radarRails.isMessagingNetwork,
    })
    .from(radarRoutes)
    .innerJoin(radarProviders, eq(radarProviders.id, radarRoutes.providerId))
    .innerJoin(radarRails, eq(radarRails.id, radarRoutes.railId))
    .where(eq(radarRoutes.corridorId, corridorId))
    .orderBy(asc(radarRails.name));

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.route.id);
  const [assets, networks, requirements] = await Promise.all([
    db.select().from(radarRouteAssets).where(inArray(radarRouteAssets.routeId, ids)),
    db.select().from(radarRouteNetworks).where(inArray(radarRouteNetworks.routeId, ids)),
    db.select().from(radarRouteRequirements).where(inArray(radarRouteRequirements.routeId, ids)),
  ]);
  const group = <T extends { routeId: string }>(list: T[], pick: (t: T) => string) => {
    const m = new Map<string, string[]>();
    for (const r of list) m.set(r.routeId, [...(m.get(r.routeId) ?? []), pick(r)]);
    return m;
  };
  const a = group(assets, (r) => r.asset);
  const n = group(networks, (r) => r.network);
  const q = group(requirements, (r) => r.requirement);

  return rows.map(({ route, providerName, railName, railIsMessaging }) => ({
    ...route,
    providerName,
    railName,
    railIsMessaging,
    assets: (a.get(route.id) ?? []).sort(),
    networks: (n.get(route.id) ?? []).sort(),
    requirements: (q.get(route.id) ?? []).sort(),
  }));
}

/**
 * Everything the corridor drill-down needs, in one authorized call: its routes,
 * plus the provider and rail lists the route form selects from. Those two lists
 * used to be loaded for every visit to the screen, to populate a form most
 * visits never open.
 */
export async function routeContext(corridorId: string) {
  await requireRadarEditor();
  const [routes, providers, rails] = await Promise.all([
    routeRows(corridorId),
    db
      .select({ id: radarProviders.id, name: radarProviders.name, status: radarProviders.status })
      .from(radarProviders)
      .orderBy(asc(radarProviders.name)),
    db
      .select({
        id: radarRails.id,
        name: radarRails.name,
        status: radarRails.status,
        isMessagingNetwork: radarRails.isMessagingNetwork,
      })
      .from(radarRails)
      .orderBy(asc(radarRails.name)),
  ]);
  return { routes, providers, rails };
}

/* ====================================================== submissions ====== */

/** The query, without the authorization check — so `radarScreen` can include it
    in its own single authorized wave instead of paying for a second one. Not
    exported: every caller reaches it through a function that authorizes. */
function submissionRows(status: "pending" | "accepted" | "rejected") {
  return db
    .select({
      id: radarSubmissions.id,
      kind: radarSubmissions.kind,
      subjectNote: radarSubmissions.subjectNote,
      claimedSourceUrl: radarSubmissions.claimedSourceUrl,
      submitterEmail: radarSubmissions.submitterEmail,
      message: radarSubmissions.message,
      status: radarSubmissions.status,
      createdAt: radarSubmissions.createdAt,
      corridorSlug: radarCorridors.slug,
      providerName: radarProviders.name,
    })
    .from(radarSubmissions)
    .leftJoin(radarCorridors, eq(radarCorridors.id, radarSubmissions.corridorId))
    .leftJoin(radarProviders, eq(radarProviders.id, radarSubmissions.providerId))
    .where(eq(radarSubmissions.status, status))
    .orderBy(desc(radarSubmissions.createdAt));
}

/**
 * Mark a submission reviewed. THIS IS THE WHOLE OPERATION.
 *
 * It takes no field name and no value, so there is no shape of call that could
 * write a submitter's claim into a live record. Accepting one means an editor
 * opened the source, believed it, and will now type the record themselves.
 */
export async function reviewSubmission(input: {
  id: string;
  status: "accepted" | "rejected";
  note?: string | null;
}) {
  const ctx = await requireRadarEditor();
  await db
    .update(radarSubmissions)
    .set({
      status: input.status,
      reviewedAt: new Date(),
      reviewedBy: ctx.userId,
      reviewNote: input.note?.trim() || null,
    })
    .where(eq(radarSubmissions.id, input.id));
  return { ok: true as const };
}

/* =============================================== re-verification ========= */

/** How long a record may go unchecked before it surfaces for re-verification. */
export const REVERIFY_AFTER_DAYS = 90;

/**
 * What has gone stale. A record that has never been verified is MORE urgent
 * than one verified long ago, so nulls sort first rather than being excluded by
 * a naive `lastVerifiedAt < cutoff`.
 */
export async function reverificationQueue() {
  await requireRadarEditor();
  const cutoff = new Date(Date.now() - REVERIFY_AFTER_DAYS * 24 * 60 * 60 * 1000);
  /* Typed to any column rather than one table's — the same staleness rule
     applies to rails, providers and routes alike. */
  const stale = (col: AnyPgColumn) => or(isNull(col), lt(col, cutoff));

  const [rails, providers, routes] = await Promise.all([
    db
      .select({
        id: radarRails.id,
        name: radarRails.name,
        lastVerifiedAt: radarRails.lastVerifiedAt,
      })
      .from(radarRails)
      .where(and(eq(radarRails.status, "published"), stale(radarRails.lastVerifiedAt)))
      .orderBy(asc(radarRails.lastVerifiedAt)),
    db
      .select({
        id: radarProviders.id,
        name: radarProviders.name,
        lastVerifiedAt: radarProviders.lastVerifiedAt,
      })
      .from(radarProviders)
      .where(and(eq(radarProviders.status, "published"), stale(radarProviders.lastVerifiedAt)))
      .orderBy(asc(radarProviders.lastVerifiedAt)),
    db
      .select({
        id: radarRoutes.id,
        corridorSlug: radarCorridors.slug,
        providerName: radarProviders.name,
        railName: radarRails.name,
        lastVerifiedAt: radarRoutes.lastVerifiedAt,
      })
      .from(radarRoutes)
      .innerJoin(radarCorridors, eq(radarCorridors.id, radarRoutes.corridorId))
      .innerJoin(radarProviders, eq(radarProviders.id, radarRoutes.providerId))
      .innerJoin(radarRails, eq(radarRails.id, radarRoutes.railId))
      .where(and(eq(radarRoutes.status, "published"), stale(radarRoutes.lastVerifiedAt)))
      .orderBy(asc(radarRoutes.lastVerifiedAt)),
  ]);

  return { rails, providers, routes, afterDays: REVERIFY_AFTER_DAYS };
}

/**
 * THE FIRST-PAINT PAYLOAD — one call, one authorization, one parallel wave.
 *
 * This replaced five separate server functions. Each of those independently ran
 * `requireRadarEditor()`, and because they arrive as five separate HTTP
 * requests the request-scoped memoisation in context.ts cannot help across
 * them: five auth resolutions, measured at ~56ms each, before any data moved.
 * They also ran in two waves — the overview awaited alone, then the rest — so
 * the waterfall was structural rather than incidental.
 *
 * WHAT IS AND IS NOT FETCHED HERE is decided by what the screen actually shows
 * on arrival. The default tab is the submission queue, and the tab strip needs
 * two numbers. So this returns the queue rows, the headline counts, and the
 * stale COUNTS — not the stale rows, and not corridors, rails or providers,
 * which are nine queries and three authorizations that render nothing until
 * their tab is opened.
 *
 * Everything below is one `Promise.all`, so the whole payload costs roughly one
 * round trip rather than accumulating them.
 */
export async function radarScreen() {
  const ctx = await requireRadarEditor();
  const cutoff = new Date(Date.now() - REVERIFY_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const stale = (col: AnyPgColumn) => or(isNull(col), lt(col, cutoff));
  const n = sql<number>`count(*)::int`;

  const [
    railCount,
    providerCount,
    corridorCount,
    routeCount,
    pendingCount,
    staleRails,
    staleProviders,
    staleRoutes,
    queue,
  ] = await Promise.all([
    db.select({ n }).from(radarRails),
    db.select({ n }).from(radarProviders),
    db.select({ n }).from(radarCorridors),
    db.select({ n }).from(radarRoutes),
    db.select({ n }).from(radarSubmissions).where(eq(radarSubmissions.status, "pending")),
    db
      .select({ n })
      .from(radarRails)
      .where(and(eq(radarRails.status, "published"), stale(radarRails.lastVerifiedAt))),
    db
      .select({ n })
      .from(radarProviders)
      .where(and(eq(radarProviders.status, "published"), stale(radarProviders.lastVerifiedAt))),
    db
      .select({ n })
      .from(radarRoutes)
      .where(and(eq(radarRoutes.status, "published"), stale(radarRoutes.lastVerifiedAt))),
    submissionRows("pending"),
  ]);

  const v = (r: Array<{ n: number }>) => r[0]?.n ?? 0;
  return {
    viewer: { role: ctx.role, fullName: ctx.fullName },
    counts: {
      rails: v(railCount),
      providers: v(providerCount),
      corridors: v(corridorCount),
      routes: v(routeCount),
      pending: v(pendingCount),
    },
    staleCounts: {
      rails: v(staleRails),
      providers: v(staleProviders),
      routes: v(staleRoutes),
      total: v(staleRails) + v(staleProviders) + v(staleRoutes),
      afterDays: REVERIFY_AFTER_DAYS,
    },
    queue,
  };
}

export { AuthError };
