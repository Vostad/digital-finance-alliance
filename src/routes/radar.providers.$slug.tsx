import { createFileRoute, notFound } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { RadarShell } from "@/components/radar/Shell";
import { SubmitSource } from "@/components/radar/SubmitSource";
import {
  Cell,
  LicenceTable,
  NotPublished,
  Row,
  SourcedField,
  T,
  Table,
  Values,
  VerifiedStamp,
} from "@/components/radar/primitives";
import { providerPage, radarCounts } from "@/rpc/radar";

/**
 * THE PROVIDER PROFILE — structural facts, in a grid, with their sources.
 *
 * Settlement figures appear only where the provider publishes them. Where they
 * do not, the field says "Not published" and links to the provider, which is a
 * more useful answer than a number nobody can stand behind.
 */
export const Route = createFileRoute("/radar/providers/$slug")({
  loader: async ({ params }) => {
    const [page, counts] = await Promise.all([
      providerPage({ data: { slug: params.slug } }),
      radarCounts().catch(() => null),
    ]);
    if (!page.provider) throw notFound();
    return { ...page, counts };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.provider;
    if (!p) return {};
    const title = `${p.name} — licences, markets, assets and limits | Rails Radar`;
    const description = `${p.name}: markets served, assets and networks supported, licences held with register links, and published limits. Verified per record with sources.`;
    const url = `https://financialrails.org/radar/providers/${p.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ProviderPage,
  notFoundComponent: () => (
    <RadarShell trail={[{ label: "Rails Radar", to: "/radar" }, { label: "Providers" }]}>
      <h1 className={cn(T.page, "text-ink")}>No such provider</h1>
      <p className={cn(T.body, "mt-4 text-ink/60")}>That provider is not published.</p>
    </RadarShell>
  ),
});

const TYPE_LABEL: Record<string, string> = {
  bank: "Bank",
  psp: "Payment service provider",
  orchestration: "Payment orchestration platform",
  stablecoin: "Stablecoin infrastructure",
  fx: "FX provider",
  custodian: "Custodian",
  exchange: "Exchange",
  onramp: "On/off-ramp provider",
};

function ProviderPage() {
  const { provider, corridors, counts } = Route.useLoaderData();
  const p = provider!;

  return (
    <RadarShell
      counts={counts}
      trail={[{ label: "Rails Radar", to: "/radar" }, { label: "Providers" }, { label: p.name }]}
    >
      <header className="border-b border-hairline pb-6">
        <h1 className={cn(T.page, "text-ink")}>{p.name}</h1>
        <p className={cn(T.body, "mt-2 text-ink/60")}>{TYPE_LABEL[p.type] ?? p.type}</p>
        <div className="mt-3">
          <VerifiedStamp at={p.lastVerifiedAt} by={p.lastVerifiedBy} sourceUrl={p.sourceUrl} />
        </div>
      </header>

      <div className="mt-8 grid gap-x-8 gap-y-6 border-b border-hairline pb-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className={cn(T.label, "accord-signal text-ink/55")}>Markets</p>
          <p className="mt-1">
            <Values items={p.markets} />
          </p>
        </div>
        <div>
          <p className={cn(T.label, "accord-signal text-ink/55")}>Assets</p>
          <p className="mt-1">
            <Values items={p.assets} />
          </p>
        </div>
        <div>
          <p className={cn(T.label, "accord-signal text-ink/55")}>Networks</p>
          <p className="mt-1">
            <Values items={p.networks} />
          </p>
        </div>
        <SourcedField label="Settlement" field={p.settlementTime} />
      </div>

      <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        <SourcedField label="Settlement hours" field={p.settlementHours} />
        <SourcedField label="Fees" field={p.settlementFee} />
        <SourcedField label="Limits" field={p.limits} />
        <div>
          <p className={cn(T.label, "accord-signal text-ink/55")}>Custody model</p>
          <p className={cn(T.body, "mt-1 text-ink")}>{p.custodyModel ?? <NotPublished />}</p>
        </div>
      </div>

      <section className="mt-12">
        <h2 className={cn(T.heading, "border-b border-hairline pb-2 text-ink")}>
          Compliance &amp; licensing
        </h2>
        <div className="pt-4">
          <LicenceTable licences={p.licences} />
        </div>
        {p.requirements.length > 0 ? (
          <>
            <p className={cn(T.label, "accord-signal mt-6 text-ink/55")}>Onboarding requirements</p>
            <p className="mt-1">
              <Values items={p.requirements} />
            </p>
          </>
        ) : null}
      </section>

      <section className="mt-12">
        <h2 className={cn(T.heading, "border-b border-hairline pb-2 text-ink")}>
          Corridors using {p.name}
        </h2>
        <div className="pt-4">
          {corridors.length === 0 ? (
            <p className={cn(T.body, "text-ink/55")}>
              No published corridors reference this provider yet.
            </p>
          ) : (
            <Table
              head={[
                { label: "Corridor" },
                { label: "Rail" },
                { label: "Assets" },
                { label: "Limits", numeric: true },
              ]}
            >
              {corridors.map((c, i) => (
                <Row key={`${c.corridorSlug}-${i}`}>
                  <Cell>
                    <a
                      href={`/radar/corridors/${c.corridorSlug}`}
                      className="underline decoration-ink/20 underline-offset-4 hover:text-[var(--accord-orange-deep)]"
                    >
                      {c.origin} → {c.destination}
                    </a>
                  </Cell>
                  <Cell>{c.railName}</Cell>
                  <Cell>
                    <Values items={c.assets} />
                  </Cell>
                  <Cell numeric>
                    {c.limitMin || c.limitMax ? (
                      <>
                        {c.limitMin ? Number(c.limitMin.value).toLocaleString("en-GB") : "—"}
                        {" / "}
                        {c.limitMax ? Number(c.limitMax.value).toLocaleString("en-GB") : "—"}
                        {c.limitCurrency ? (
                          <span className="ml-1 text-ink/55">{c.limitCurrency}</span>
                        ) : null}
                      </>
                    ) : (
                      <NotPublished />
                    )}
                  </Cell>
                </Row>
              ))}
            </Table>
          )}
        </div>
      </section>

      <section className="mt-12 flex flex-wrap gap-6 border-t border-hairline pt-6">
        {p.apiDocumentation ? (
          <a
            href={p.apiDocumentation}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={cn(
              T.label,
              "text-ink underline underline-offset-4 hover:text-[var(--accord-orange-deep)]",
            )}
          >
            View API documentation
          </a>
        ) : null}
        {p.website ? (
          <a
            href={p.website}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={cn(
              T.label,
              "text-ink underline underline-offset-4 hover:text-[var(--accord-orange-deep)]",
            )}
          >
            Contact provider
          </a>
        ) : null}
      </section>

      <section className="mt-12">
        <SubmitSource
          kind="inaccuracy"
          providerSlug={p.slug}
          title="Report an inaccuracy"
          blurb={`If something on ${p.name}'s profile is wrong or out of date, tell us where. Reports create a review record — they never overwrite a field directly.`}
        />
      </section>
    </RadarShell>
  );
}
