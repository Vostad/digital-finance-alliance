/**
 * THE PUBLIC RPC SURFACE for Rails Radar.
 *
 * Thin wrappers, exactly as src/rpc/auth.ts is: validate, call the module in
 * src/server/radar, return a plain object. No logic here, and none may start.
 *
 * The split exists because TanStack Start denies any client-reachable import of
 * src/server/** — that tree pulls in the Postgres driver. Route components
 * import this file; the compiler strips the handler bodies from the client
 * build and leaves an RPC call behind.
 *
 * Everything here is unauthenticated by design. Radar's structural data is
 * public and crawlable — that is the distribution strategy, not an oversight.
 * The two writes below reach a pending queue that never renders.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { createHash } from "node:crypto";
import { z } from "zod";

import {
  filterRoutesByAmount,
  getCorridorBySlug,
  getProviderBySlug,
  getRailBySlug,
  listCorridorEvents,
  listCorridorsForProvider,
  listPublishedCorridors,
  listPublishedProviders,
  listPublishedRails,
  listRoutesForCorridor,
  publishedCounts,
} from "@/server/radar/public";
import { receiveSubmission } from "@/server/radar/submissions";

/**
 * Hashed, never stored raw. A rate limit needs to recognise a repeat visitor;
 * it does not need to know who they are, and an IP in a table is personal data
 * we would then owe an answer about. Mirrors src/rpc/intake.ts exactly.
 */
function hashedIp(): string | null {
  const ip = getRequestIP({ xForwardedFor: true });
  if (!ip) return null;
  return createHash("sha256").update(`radar:${ip}`).digest("hex").slice(0, 32);
}

/** Internal failures never cross the wire verbatim — the message is written for
    us, not for a visitor. Deliberate errors carry a statusCode and pass through. */
async function sealed<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (problem) {
    if (problem != null && typeof problem === "object" && "statusCode" in problem) throw problem;
    console.error("[rpc/radar]", problem);
    throw new Error("Something went wrong. Try again.");
  }
}

/* ----------------------------------------------------------------- reads -- */

export const corridorIndex = createServerFn({ method: "GET" }).handler(() =>
  sealed(async () => ({
    corridors: await listPublishedCorridors(),
    counts: await publishedCounts(),
  })),
);

/**
 * Everything a corridor page renders, in one round trip.
 *
 * `amount` filters by PUBLISHED limits only and is reported back with how many
 * routes it removed, so the page can say so rather than silently showing less.
 */
export const corridorPage = createServerFn({ method: "GET" })
  .validator(
    z.object({
      slug: z.string().min(1).max(120),
      amount: z.number().positive().finite().nullable().optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const corridor = await getCorridorBySlug(data.slug);
      if (!corridor) return { corridor: null, routes: [], events: [], excludedByAmount: 0 };

      const [all, events] = await Promise.all([
        listRoutesForCorridor(corridor.id),
        listCorridorEvents(corridor.id),
      ]);

      const { routes, excluded } = filterRoutesByAmount(
        all,
        data.amount ?? null,
        corridor.origin.currency,
      );

      return { corridor, routes, events, excludedByAmount: excluded };
    }),
  );

export const providerPage = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1).max(120) }))
  .handler(({ data }) =>
    sealed(async () => {
      const provider = await getProviderBySlug(data.slug);
      if (!provider) return { provider: null, corridors: [] };
      return { provider, corridors: await listCorridorsForProvider(provider.id) };
    }),
  );

export const railPage = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1).max(120) }))
  .handler(({ data }) => sealed(async () => ({ rail: await getRailBySlug(data.slug) })));

export const railIndex = createServerFn({ method: "GET" }).handler(() =>
  sealed(async () => ({ rails: await listPublishedRails() })),
);

export const providerIndex = createServerFn({ method: "GET" }).handler(() =>
  sealed(async () => ({ providers: await listPublishedProviders() })),
);

/** Footer counts, from actual rows. Never a hardcoded figure. */
export const radarCounts = createServerFn({ method: "GET" }).handler(() =>
  sealed(() => publishedCounts()),
);

/* ---------------------------------------------------------------- writes -- */

/**
 * The moderation gate. Creates a PENDING record and nothing else.
 *
 * The response says "submitted for verification" — never "added" — because
 * nothing has been added. An editor verifies the source before any of it
 * becomes data.
 */
export const submitSource = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kind: z.enum(["source", "inaccuracy"]),
      corridorSlug: z.string().max(120).nullable().optional(),
      providerSlug: z.string().max(120).nullable().optional(),
      routeId: z.string().uuid().nullable().optional(),
      subjectNote: z.string().max(2000).nullable().optional(),
      claimedSourceUrl: z.string().max(2000).nullable().optional(),
      submitterEmail: z.string().max(320),
      message: z.string().max(4000).nullable().optional(),
      /** Anti-bot. A real person never fills a hidden field. */
      honeypot: z.string().max(500).nullable().optional(),
      /** Milliseconds the form was on screen. Bots submit instantly. */
      elapsedMs: z.number().nullable().optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(() =>
      /* Normalised explicitly rather than spread: `exactOptionalPropertyTypes`
         distinguishes an absent key from an explicit `undefined`, and a
         validator that yields the latter does not satisfy the former. */
      receiveSubmission({
        kind: data.kind,
        corridorSlug: data.corridorSlug ?? null,
        providerSlug: data.providerSlug ?? null,
        routeId: data.routeId ?? null,
        subjectNote: data.subjectNote ?? null,
        claimedSourceUrl: data.claimedSourceUrl ?? null,
        submitterEmail: data.submitterEmail,
        message: data.message ?? null,
        honeypot: data.honeypot ?? null,
        elapsedMs: data.elapsedMs ?? null,
        ipHash: hashedIp(),
        userAgent: getRequestHeader("user-agent") ?? null,
      }),
    ),
  );
