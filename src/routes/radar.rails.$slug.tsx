import { createFileRoute, notFound } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { RadarShell } from "@/components/radar/Shell";
import { T, VerifiedStamp } from "@/components/radar/primitives";
import { radarCounts, railPage } from "@/rpc/radar";

/**
 * RAIL DETAIL — what the rail is, and crucially what it is NOT.
 *
 * The messaging/settlement distinction is stated here in full rather than
 * implied. A rail that carries instructions does not confer finality, and this
 * page says so plainly, because conflating the two is the single most common
 * error in how payment infrastructure is described.
 */
export const Route = createFileRoute("/radar/rails/$slug")({
  loader: async ({ params }) => {
    const [page, counts] = await Promise.all([
      railPage({ data: { slug: params.slug } }),
      radarCounts().catch(() => null),
    ]);
    if (!page.rail) throw notFound();
    return { ...page, counts };
  },
  head: ({ loaderData }) => {
    const r = loaderData?.rail;
    if (!r) return {};
    const title = `${r.name} — what it is and what it settles | Rails Radar`;
    const url = `https://financialrails.org/radar/rails/${r.slug}`;
    return {
      meta: [
        { title },
        {
          name: "description",
          content:
            r.description ??
            `${r.name}: category, settlement role and the corridors it appears in. Verified per record with sources.`,
        },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: RailPage,
  notFoundComponent: () => (
    <RadarShell trail={[{ label: "Rails Radar", to: "/radar" }, { label: "Rails" }]}>
      <h1 className={cn(T.page, "text-ink")}>No such rail</h1>
    </RadarShell>
  ),
});

const CATEGORY_LABEL: Record<string, string> = {
  traditional: "Traditional payment system",
  digital: "Digital asset",
  blockchain: "Blockchain / settlement network",
  emerging: "Emerging",
};

function RailPage() {
  const { rail, counts } = Route.useLoaderData();
  const r = rail!;

  return (
    <RadarShell
      counts={counts}
      trail={[{ label: "Rails Radar", to: "/radar" }, { label: "Rails" }, { label: r.name }]}
    >
      <header className="border-b border-hairline pb-6">
        <h1 className={cn(T.page, "text-ink")}>{r.name}</h1>
        <p className={cn(T.body, "mt-2 text-ink/60")}>{CATEGORY_LABEL[r.category] ?? r.category}</p>
        <div className="mt-3">
          <VerifiedStamp at={r.lastVerifiedAt} by={r.lastVerifiedBy} sourceUrl={r.sourceUrl} />
        </div>
      </header>

      {r.description ? (
        <p className={cn(T.body, "mt-8 max-w-2xl text-ink")}>{r.description}</p>
      ) : null}

      <div className="mt-8 border-l-2 border-[var(--accord-orange-deep)] bg-bone px-5 py-4">
        <p className={cn(T.label, "accord-signal text-ink/55")}>Settlement role</p>
        {r.isMessagingNetwork ? (
          <p className={cn(T.body, "mt-2 max-w-2xl text-ink")}>
            {r.name} is a <strong>messaging network</strong>. It carries payment instructions
            between institutions; it does not settle them. Settlement finality on any route using{" "}
            {r.name} is conferred by the underlying settlement system, and Rails Radar attributes it
            there — never to {r.name} itself.
          </p>
        ) : (
          <p className={cn(T.body, "mt-2 max-w-2xl text-ink")}>
            {r.name} settles value. Finality for a route using it is a property of this system and
            is recorded per route, with the source that documents it.
          </p>
        )}
      </div>
    </RadarShell>
  );
}
