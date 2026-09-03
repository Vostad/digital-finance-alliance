import { createFileRoute } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { RadarShell } from "@/components/radar/Shell";
import { SubmitSource } from "@/components/radar/SubmitSource";
import { Cell, Row, T, Table, formatDate } from "@/components/radar/primitives";
import { corridorIndex } from "@/rpc/radar";

/**
 * THE CORRIDOR INDEX — browsable, crawlable, and the entry point for anything
 * that does not arrive through search. No corridor exists only behind the
 * homepage's client-side selects; this page links every published one.
 */
export const Route = createFileRoute("/radar/corridors/")({
  head: () => ({
    meta: [
      { title: "Corridors — Rails Radar" },
      {
        name: "description",
        content:
          "Every published corridor on Rails Radar: the rails available between two markets, who provides access, and the licences they hold.",
      },
      { property: "og:url", content: "https://financialrails.org/radar/corridors" },
    ],
    links: [{ rel: "canonical", href: "https://financialrails.org/radar/corridors" }],
  }),
  loader: () => corridorIndex().catch(() => ({ corridors: [], counts: null })),
  component: CorridorIndex,
});

function CorridorIndex() {
  const { corridors, counts } = Route.useLoaderData();

  return (
    <RadarShell
      counts={counts}
      trail={[{ label: "Rails Radar", to: "/radar" }, { label: "Corridors" }]}
    >
      <h1 className={cn(T.page, "text-ink")}>Corridors</h1>
      <p className={cn(T.body, "mt-3 max-w-2xl text-ink/60")}>
        Each corridor lists the rails that exist between two markets and the providers that give
        access to them. A corridor is published once its routes have been checked against primary
        sources.
      </p>

      {corridors.length === 0 ? (
        <div className="mt-10 border border-hairline bg-bone px-6 py-8">
          <h2 className={cn(T.heading, "text-ink")}>No corridors published yet</h2>
          <p className={cn(T.body, "mt-3 max-w-2xl text-ink/65")}>
            Verification is in progress. Corridors appear here as their rails, providers and
            licences are confirmed against provider documentation and regulator registers — not
            before.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <Table
            head={[
              { label: "Origin" },
              { label: "Destination" },
              { label: "Currencies" },
              { label: "Last verified" },
            ]}
          >
            {corridors.map((c) => (
              <Row key={c.slug}>
                <Cell>
                  <a
                    href={`/radar/corridors/${c.slug}`}
                    className="underline decoration-ink/20 underline-offset-4 transition-colors hover:text-[var(--accord-orange-deep)]"
                  >
                    {c.origin.country}
                  </a>
                </Cell>
                <Cell>{c.destination.country}</Cell>
                <Cell className="font-mono text-[13px]">
                  {c.origin.currency} → {c.destination.currency}
                </Cell>
                <Cell>
                  <span className={cn(T.micro, "text-ink/55")}>
                    {formatDate(c.lastVerifiedAt) ?? "Not yet verified"}
                  </span>
                </Cell>
              </Row>
            ))}
          </Table>
        </div>
      )}

      <section className="mt-14">
        <SubmitSource
          kind="source"
          title="Submit a source"
          blurb="Have documentation for a corridor that is missing or incomplete? Provider terms, a scheme rulebook, a regulator register entry — it goes into the verification queue."
        />
      </section>
    </RadarShell>
  );
}
