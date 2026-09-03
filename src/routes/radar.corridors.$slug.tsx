import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { RadarShell } from "@/components/radar/Shell";
import { SubmitSource } from "@/components/radar/SubmitSource";
import {
  Button,
  Cell,
  Licences,
  NotPublished,
  Row,
  SourcedField,
  T,
  Table,
  Values,
  VerifiedStamp,
  formatDate,
} from "@/components/radar/primitives";
import { corridorPage, radarCounts } from "@/rpc/radar";

/**
 * THE CORRIDOR PAGE — the answer, and the distribution layer.
 *
 * Server-rendered and crawlable, with metadata and JSON-LD derived from the
 * route data rather than templated over it. The traffic thesis rests on
 * thousands of long-tail queries ("US to Brazil stablecoin payments") landing
 * directly on a page that answers them, so this page must exist in HTML before
 * any JavaScript runs. The homepage search is a convenience layer on top of it,
 * never the only way in.
 *
 * WHAT IT SHOWS AND WHAT IT REFUSES TO. Every card carries the rail, the
 * provider, the licences with their registers, the hours, the finality, the
 * assets, the networks, the published limits and the requirements. It carries
 * no cost, no settlement-time estimate, no ranking and no "recommended" label,
 * because none of those are verifiable at scale today.
 *
 * SWIFT IS NOT A SETTLEMENT SYSTEM. Where a rail is a messaging network, the
 * card says so and attributes finality to the settlement system underneath.
 * That distinction is the difference between an intelligence product and a
 * directory.
 */
export const Route = createFileRoute("/radar/corridors/$slug")({
  validateSearch: (search: Record<string, unknown>): { amount?: number } => {
    const raw = search["amount"];
    const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
    return Number.isFinite(n) && n > 0 ? { amount: n } : {};
  },
  loaderDeps: ({ search }) => ({ amount: search.amount ?? null }),
  loader: async ({ params, deps }) => {
    const [page, counts] = await Promise.all([
      corridorPage({ data: { slug: params.slug, amount: deps.amount } }),
      radarCounts().catch(() => null),
    ]);
    if (!page.corridor) throw notFound();
    return { ...page, counts };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.corridor;
    if (!c) return {};
    const title = `${c.origin.country} to ${c.destination.country} — rails, providers and licences | Rails Radar`;
    const n = loaderData.routes.length;
    const description =
      n > 0
        ? `${n} verified route${n === 1 ? "" : "s"} from ${c.origin.country} (${c.origin.currency}) to ${c.destination.country} (${c.destination.currency}) — the rails available, who provides access, licences held with register links, operating hours, settlement finality and published limits.`
        : `Rails, providers and licences for moving money from ${c.origin.country} (${c.origin.currency}) to ${c.destination.country} (${c.destination.currency}). Verification in progress — every figure published carries its source.`;
    const url = `https://financialrails.org/radar/corridors/${c.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        /* A corridor with no published routes is thin content. It still renders
           and still converts a visitor into a contributor — it just does not ask
           to be indexed until it has something to say. `follow` so the links out
           of it still carry. */
        ...(n === 0 ? [{ name: "robots", content: "noindex, follow" }] : []),
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: CorridorPage,
  notFoundComponent: () => (
    <RadarShell
      trail={[
        { label: "Rails Radar", to: "/radar" },
        { label: "Corridors", to: "/radar/corridors" },
      ]}
    >
      <h1 className={cn(T.page, "text-ink")}>No such corridor</h1>
      <p className={cn(T.body, "mt-4 max-w-xl text-ink/60")}>
        That corridor is not published. It may not have been verified yet.
      </p>
      <p className={cn(T.body, "mt-4")}>
        <a href="/radar/corridors" className="underline underline-offset-4">
          Browse published corridors
        </a>
      </p>
    </RadarShell>
  ),
});

function CorridorPage() {
  const { corridor, routes, events, excludedByAmount, counts } = Route.useLoaderData();
  const { amount } = Route.useSearch();
  const [compare, setCompare] = useState(false);

  const c = corridor!;
  const title = `${c.origin.country} → ${c.destination.country}`;

  /* Structured data, built from the rows rather than templated over them. Only
     published routes appear, so the markup can never describe more than the
     page does. */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Payment rails: ${c.origin.country} to ${c.destination.country}`,
    description: `Rails, providers, licences, operating hours, settlement finality and published limits for moving money from ${c.origin.country} to ${c.destination.country}.`,
    url: `https://financialrails.org/radar/corridors/${c.slug}`,
    isAccessibleForFree: true,
    creator: {
      "@type": "Organization",
      name: "Financial Rails",
      url: "https://financialrails.org",
    },
    ...(c.lastVerifiedAt ? { dateModified: new Date(c.lastVerifiedAt).toISOString() } : {}),
    hasPart: routes.map((r) => ({
      "@type": "Service",
      name: `${r.rail.name} via ${r.provider.name}`,
      serviceType: r.rail.name,
      provider: {
        "@type": "Organization",
        name: r.provider.name,
        url: `https://financialrails.org/radar/providers/${r.provider.slug}`,
        ...(r.licences.length
          ? {
              hasCredential: r.licences.map((l) => ({
                "@type": "EducationalOccupationalCredential",
                credentialCategory: "license",
                name: l.name,
                url: l.registerUrl,
              })),
            }
          : {}),
      },
      areaServed: [c.origin.country, c.destination.country],
    })),
  };

  return (
    <RadarShell
      counts={counts}
      trail={[
        { label: "Rails Radar", to: "/radar" },
        { label: "Corridors", to: "/radar/corridors" },
        { label: title },
      ]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="border-b border-hairline pb-6">
        <h1 className={cn(T.page, "text-ink")}>{title}</h1>
        <p className={cn(T.body, "mt-3 text-ink/60")}>
          <span className="font-mono">{c.origin.currency}</span> →{" "}
          <span className="font-mono">{c.destination.currency}</span>
          {amount ? (
            <>
              <span className="text-ink/25"> · </span>
              Filtered to routes whose published limits admit{" "}
              <span className="font-mono tabular-nums">
                {amount.toLocaleString("en-GB")} {c.origin.currency}
              </span>
            </>
          ) : null}
        </p>
        {amount && excludedByAmount > 0 ? (
          <p className={cn(T.micro, "mt-2 text-ink/50")}>
            {excludedByAmount} route{excludedByAmount === 1 ? "" : "s"} hidden by that amount.
            Routes with no published limit, or limits in another currency, are never hidden — an
            unpublished limit is not evidence of a limit.
          </p>
        ) : null}
      </header>

      {c.destinationConstraints ? (
        <div className="mt-8 border-l-2 border-[var(--accord-orange-deep)] bg-bone px-5 py-4">
          <p className={cn(T.label, "accord-signal text-ink/55")}>
            Regulatory constraints — {c.destination.country}
          </p>
          <p className={cn(T.body, "mt-2 text-ink")}>{c.destinationConstraints.value}</p>
          <p className={cn(T.micro, "mt-2 text-ink/45")}>
            <a
              href={c.destinationConstraints.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline underline-offset-2"
            >
              Source
            </a>
          </p>
        </div>
      ) : null}

      {routes.length === 0 ? (
        <EmptyCorridor
          slug={c.slug}
          origin={c.origin.country}
          destination={c.destination.country}
        />
      ) : (
        <>
          <div className="mt-10 flex items-baseline justify-between gap-4 border-b border-hairline pb-2">
            <h2 className={cn(T.heading, "text-ink")}>
              Available rails{" "}
              <span className="font-mono text-[13px] font-normal text-ink/45">
                ({routes.length})
              </span>
            </h2>
            {routes.length > 1 ? (
              <button
                onClick={() => setCompare((v) => !v)}
                className={cn(
                  T.label,
                  "text-ink/55 underline underline-offset-4 transition-colors hover:text-[var(--accord-orange-deep)]",
                )}
              >
                {compare ? "View as cards" : "Compare rails"}
              </button>
            ) : null}
          </div>

          {compare ? <CompareTable routes={routes} /> : <RouteCards routes={routes} />}
        </>
      )}

      {events.length > 0 ? (
        <section className="mt-14">
          <h2 className={cn(T.heading, "border-b border-hairline pb-2 text-ink")}>
            Structural history
          </h2>
          <div className="pt-4">
            <Table head={[{ label: "Date" }, { label: "Change" }, { label: "Source" }]}>
              {events.map((e) => (
                <Row key={e.id}>
                  <Cell className="whitespace-nowrap font-mono text-[13px]">
                    {formatDate(e.occurredOn)}
                  </Cell>
                  <Cell>{e.description}</Cell>
                  <Cell>
                    <a
                      href={e.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="underline underline-offset-2 hover:text-[var(--accord-orange-deep)]"
                    >
                      Source
                    </a>
                  </Cell>
                </Row>
              ))}
            </Table>
          </div>
        </section>
      ) : null}

      <section className="mt-14">
        <SubmitSource
          kind="inaccuracy"
          corridorSlug={c.slug}
          title="Report an inaccuracy"
          blurb="If something here is wrong or out of date, tell us where. Reports create a review record — they never overwrite a field directly."
        />
      </section>
    </RadarShell>
  );
}

/* ------------------------------------------------------------------ cards -- */

type CorridorRoutes = Awaited<ReturnType<typeof corridorPage>>["routes"];

function RouteCards({ routes }: { routes: CorridorRoutes }) {
  return (
    <div className="mt-6 space-y-5">
      {routes.map((r) => (
        <article key={r.id} className="border border-hairline">
          <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-hairline bg-bone px-5 py-4">
            <div className="min-w-0">
              <p className={cn(T.label, "accord-signal text-ink/55")}>Rail</p>
              <h3 className={cn(T.heading, "mt-1 text-ink")}>
                <a
                  href={`/radar/rails/${r.rail.slug}`}
                  className="underline decoration-ink/20 underline-offset-4 hover:text-[var(--accord-orange-deep)]"
                >
                  {r.rail.name}
                </a>
              </h3>
              {/* The ontological correction, stated on the card itself. */}
              {r.rail.isMessagingNetwork ? (
                <p className={cn(T.micro, "mt-1 text-ink/50")}>
                  Messaging network — carries instructions, does not settle
                </p>
              ) : null}
            </div>
            <div className="min-w-0 text-right">
              <p className={cn(T.label, "accord-signal text-ink/55")}>Provider</p>
              <p className={cn(T.strong, "mt-1")}>
                <a
                  href={`/radar/providers/${r.provider.slug}`}
                  className="underline decoration-ink/20 underline-offset-4 hover:text-[var(--accord-orange-deep)]"
                >
                  {r.provider.name}
                </a>
              </p>
            </div>
          </header>

          <div className="grid gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <SourcedField label="Settlement finality" field={r.settlementFinality} />
              {r.settlementFinality && r.settlementSystem ? (
                <p className={cn(T.micro, "mt-1 text-ink/50")}>
                  Conferred by {r.settlementSystem}
                  {r.rail.isMessagingNetwork ? `, not by ${r.rail.name}` : ""}
                </p>
              ) : null}
            </div>
            <SourcedField label="Operating hours" field={r.operatingHours} />
            <SourcedField label="Cut-off" field={r.cutOff} />

            <div>
              <p className={cn(T.label, "accord-signal text-ink/55")}>Limits</p>
              <p className={cn(T.figure, "mt-1 text-ink")}>
                {r.limitMin || r.limitMax ? (
                  <>
                    {r.limitMin ? (
                      <span className="tabular-nums">
                        min {Number(r.limitMin.value).toLocaleString("en-GB")}
                      </span>
                    ) : (
                      <span className="text-ink/40 italic">min not published</span>
                    )}
                    <span className="text-ink/25"> · </span>
                    {r.limitMax ? (
                      <span className="tabular-nums">
                        max {Number(r.limitMax.value).toLocaleString("en-GB")}
                      </span>
                    ) : (
                      <span className="text-ink/40 italic">max not published</span>
                    )}
                    {r.limitCurrency ? (
                      <span className="ml-1 text-ink/55">{r.limitCurrency}</span>
                    ) : null}
                  </>
                ) : (
                  <NotPublished />
                )}
              </p>
              {r.limitMin || r.limitMax ? (
                <p className={cn(T.micro, "mt-1 text-ink/45")}>
                  <a
                    href={(r.limitMin ?? r.limitMax)!.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="underline underline-offset-2"
                  >
                    Source
                  </a>
                </p>
              ) : null}
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <p className={cn(T.label, "accord-signal text-ink/55")}>Licences</p>
              <p className="mt-1">
                <Licences licences={r.licences} />
              </p>
            </div>

            <div>
              <p className={cn(T.label, "accord-signal text-ink/55")}>Assets</p>
              <p className="mt-1">
                <Values items={r.assets} />
              </p>
            </div>
            <div>
              <p className={cn(T.label, "accord-signal text-ink/55")}>Networks</p>
              <p className="mt-1">
                <Values items={r.networks} />
              </p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <p className={cn(T.label, "accord-signal text-ink/55")}>Requirements</p>
              <p className="mt-1">
                <Values items={r.requirements} />
              </p>
            </div>
          </div>

          <footer className="border-t border-hairline px-5 py-3">
            <VerifiedStamp at={r.lastVerifiedAt} by={r.lastVerifiedBy} sourceUrl={r.sourceUrl} />
          </footer>
        </article>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- compare -- */

/** The same structural attributes, side by side. A view toggle, not a page —
    and deliberately not a ranking: no column is scored and no row wins. */
function CompareTable({ routes }: { routes: CorridorRoutes }) {
  const cell = (f: { value: string; sourceUrl: string } | null) =>
    f ? (
      <>
        {f.value}
        <br />
        <a
          href={f.sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={cn(T.micro, "underline underline-offset-2 text-ink/45")}
        >
          Source
        </a>
      </>
    ) : (
      <NotPublished />
    );

  return (
    <div className="mt-6">
      <Table
        head={[
          { label: "Rail" },
          { label: "Provider" },
          { label: "Finality" },
          { label: "Hours" },
          { label: "Limits", numeric: true },
          { label: "Assets" },
          { label: "Licences" },
          { label: "Verified" },
        ]}
      >
        {routes.map((r) => (
          <Row key={r.id}>
            <Cell>
              {r.rail.name}
              {r.rail.isMessagingNetwork ? (
                <span className={cn(T.micro, "block text-ink/45")}>messaging network</span>
              ) : null}
            </Cell>
            <Cell>{r.provider.name}</Cell>
            <Cell>{cell(r.settlementFinality)}</Cell>
            <Cell>{cell(r.operatingHours)}</Cell>
            <Cell numeric>
              {r.limitMin || r.limitMax ? (
                <>
                  {r.limitMin ? Number(r.limitMin.value).toLocaleString("en-GB") : "—"}
                  {" / "}
                  {r.limitMax ? Number(r.limitMax.value).toLocaleString("en-GB") : "—"}
                  {r.limitCurrency ? (
                    <span className="ml-1 text-ink/55">{r.limitCurrency}</span>
                  ) : null}
                </>
              ) : (
                <NotPublished />
              )}
            </Cell>
            <Cell>
              <Values items={r.assets} />
            </Cell>
            <Cell>
              <Licences licences={r.licences} />
            </Cell>
            <Cell>
              <span className={cn(T.micro, "text-ink/55")}>
                {formatDate(r.lastVerifiedAt) ?? "Not yet verified"}
              </span>
            </Cell>
          </Row>
        ))}
      </Table>
    </div>
  );
}

/* ----------------------------------------------------------------- empty -- */

/**
 * THE EMPTY CORRIDOR — a first-class state, not an edge case.
 *
 * At launch most corridors look like this, so it is designed rather than
 * apologised for. It never says "Coming soon" and it is never a blank shrug: it
 * names what is not yet verified, explains why that is a deliberate position
 * rather than a shortfall, and offers the one action that helps.
 */
function EmptyCorridor({
  slug,
  origin,
  destination,
}: {
  slug: string;
  origin: string;
  destination: string;
}) {
  return (
    <section className="mt-10">
      <div className="border border-hairline bg-bone px-6 py-8">
        <h2 className={cn(T.heading, "text-ink")}>No routes verified on this corridor yet</h2>
        <p className={cn(T.body, "mt-3 max-w-2xl text-ink/65")}>
          Rails almost certainly exist between {origin} and {destination}. None have been verified
          against a primary source yet, so none are published here.
        </p>
        <p className={cn(T.body, "mt-4 max-w-2xl text-ink/65")}>
          That is the position, not a placeholder. Rails Radar publishes a route only once its
          provider, licences and published limits have been checked against provider documentation
          or a regulator register. Listing a rail we have not checked would make every other figure
          on this site worth less.
        </p>

        <dl className="mt-6 grid gap-x-8 gap-y-3 border-t border-hairline pt-5 sm:grid-cols-2">
          {[
            "Which providers give access to each rail",
            "Licences held, and the register each appears on",
            "Operating hours and cut-off times",
            "Settlement finality, attributed to the settlement system",
            "Supported assets and networks",
            "Published minimum and maximum limits",
          ].map((item) => (
            <div key={item} className="flex gap-3">
              <span
                aria-hidden
                className="mt-[7px] h-px w-3 shrink-0 bg-[var(--accord-orange-deep)]"
              />
              <dt className={cn(T.body, "text-ink/70")}>{item}</dt>
              <dd className="sr-only">Not yet verified</dd>
            </div>
          ))}
        </dl>
        <p className={cn(T.micro, "mt-5 text-ink/50")}>
          None of the above is verified for this corridor.
        </p>
      </div>

      <div className="mt-6">
        <SubmitSource
          kind="source"
          corridorSlug={slug}
          title="Help complete the picture"
          blurb={`If you have documentation for a rail between ${origin} and ${destination} — provider terms, a scheme rulebook, a regulator register entry — it goes into the verification queue.`}
        />
      </div>
    </section>
  );
}
