import { createFileRoute, Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { RadarShell } from "@/components/radar/Shell";
import { T, formatDate } from "@/components/radar/primitives";
import { radarCounts, railIndex } from "@/rpc/radar";

/**
 * THE RAILS INDEX — a reference page, not a list of links.
 *
 * Two jobs, and the second is the reason it is written this way.
 *
 *   1. INTERNAL LINKING. Rail detail pages sit in the sitemap. Until a corridor
 *      publishes, nothing on the site points at them, and a page nothing links
 *      to is a page that does not get indexed. This gives every rail a link.
 *
 *   2. IT ANSWERS THE QUESTION. "What are payment rails" is an informational
 *      query, and the honest answer to it is a correct taxonomy — which is
 *      exactly what this product already has to get right internally. A rail, an
 *      asset, a network and a messaging system are four different things, and
 *      almost everything written about this subject conflates at least two of
 *      them. Setting that out plainly, with every rail correctly categorised and
 *      messaging networks visibly separated from settlement systems, is a better
 *      reference than any explainer we could write around it.
 *
 * The taxonomy below is definitional — it describes how this product classifies
 * things. It makes no factual claim about any named system; those come from the
 * rows, and each row carries its own source.
 */
export const Route = createFileRoute("/radar/rails/")({
  head: () => ({
    meta: [
      { title: "Payment rails — what they are, and how they differ | Rails Radar" },
      {
        name: "description",
        content:
          "A payment rail moves value. An asset is what moves. A network is what it moves over. A messaging system only carries instructions and settles nothing. Every rail Rails Radar tracks, correctly categorised, with settlement systems distinguished from messaging networks.",
      },
      {
        property: "og:title",
        content: "Payment rails — what they are, and how they differ",
      },
      {
        property: "og:description",
        content:
          "Rails, assets, networks and messaging systems are four different things. The distinction, and every rail we track.",
      },
      { property: "og:url", content: "https://railsradar.com/rails" },
    ],
    links: [{ rel: "canonical", href: "https://railsradar.com/rails" }],
  }),
  loader: async () => {
    const [{ rails }, counts] = await Promise.all([
      railIndex().catch(() => ({ rails: [] })),
      radarCounts().catch(() => null),
    ]);
    return { rails, counts };
  },
  component: RailsIndex,
});

/**
 * THE DISTINCTION, stated once and properly.
 *
 * This is the ontology the whole product is built on: conflating a messaging
 * network with a settlement system is the single most common error in how
 * payment infrastructure is described, and it is the error that makes
 * "settlement finality" meaningless when it appears next to the wrong name.
 */
const TAXONOMY = [
  {
    term: "A rail",
    is: "moves value.",
    body: "A payment system, a scheme, or a settlement network. It is the thing that actually gets money from one party to another.",
  },
  {
    term: "An asset",
    is: "is what moves.",
    body: "A currency, a stablecoin, a tokenised deposit. An asset is not a rail — it is carried by one. The same asset can move over several rails.",
  },
  {
    term: "A network",
    is: "is what it moves over.",
    body: "A blockchain is a network, not an asset and not a payment system. Several assets can settle on the same network.",
  },
  {
    term: "A messaging system",
    is: "is not a settlement system.",
    body: "It carries instructions between institutions and settles nothing. Finality on a route that uses one is conferred by the settlement system underneath, and belongs attributed there.",
  },
] as const;

const CATEGORIES = [
  {
    id: "traditional",
    label: "Traditional payment systems",
    blurb: "Account-to-account schemes, instant payment systems and correspondent arrangements.",
  },
  {
    id: "digital",
    label: "Digital assets",
    blurb: "Stablecoins and other tokenised money. What moves, rather than what moves it.",
  },
  {
    id: "blockchain",
    label: "Networks and settlement layers",
    blurb: "The networks digital assets settle on.",
  },
  {
    id: "emerging",
    label: "Emerging",
    blurb: "Tokenised deposits, central bank digital currency and systems still being built.",
  },
] as const;

function RailsIndex() {
  const { rails, counts } = Route.useLoaderData();
  const byCategory = (id: string) => rails.filter((r) => r.category === id);
  const messaging = rails.filter((r) => r.isMessagingNetwork);

  return (
    <RadarShell
      counts={counts}
      trail={[{ label: "Rails Radar", to: "/radar" }, { label: "Rails" }]}
    >
      <h1 className={cn(T.page, "text-ink")}>Payment rails</h1>
      <p className={cn(T.body, "mt-4 max-w-2xl text-ink/65")}>
        A rail is a way value moves. That sounds simple and is routinely muddled: an asset, a
        network and a messaging system are three different things, and none of them is a rail. Rails
        Radar keeps them apart because the distinction decides what a claim about settlement
        actually means.
      </p>

      <section className="mt-10 border-y border-hairline">
        <dl className="divide-y divide-hairline">
          {TAXONOMY.map((t) => (
            <div key={t.term} className="grid gap-2 py-5 sm:grid-cols-[13rem_1fr] sm:gap-8">
              <dt className={cn(T.strong, "text-ink")}>
                {t.term} <span className="font-normal text-ink/55">{t.is}</span>
              </dt>
              <dd className={cn(T.body, "text-ink/70")}>{t.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {messaging.length > 0 ? (
        <section className="mt-10 border-l-2 border-[var(--accord-orange-deep)] bg-bone px-5 py-4">
          <p className={cn(T.label, "accord-signal text-ink/55")}>
            Messaging networks tracked here
          </p>
          <p className={cn(T.body, "mt-2 max-w-2xl text-ink")}>
            {messaging.map((r) => r.name).join(", ")} carr
            {messaging.length === 1 ? "ies" : "y"} instructions and settle
            {messaging.length === 1 ? "s" : ""} nothing. Where a route uses one, finality is
            attributed to the settlement system underneath — never to the messaging network.
          </p>
        </section>
      ) : null}

      {rails.length === 0 ? (
        <section className="mt-12 border border-hairline bg-bone px-6 py-8">
          <h2 className={cn(T.heading, "text-ink")}>No rails published yet</h2>
          <p className={cn(T.body, "mt-3 max-w-2xl text-ink/65")}>
            A rail is published once it has been checked against a primary source — a scheme
            rulebook, an operator's own documentation, or a regulator. The taxonomy above holds
            regardless; the list fills in as verification completes.
          </p>
        </section>
      ) : (
        <div className="mt-12 space-y-10">
          {CATEGORIES.map((c) => {
            const items = byCategory(c.id);
            if (items.length === 0) return null;
            return (
              <section key={c.id}>
                <h2 className={cn(T.heading, "border-b border-hairline pb-2 text-ink")}>
                  {c.label}{" "}
                  <span className="font-mono text-[13px] font-normal text-ink/45">
                    ({items.length})
                  </span>
                </h2>
                <p className={cn(T.micro, "mt-2 text-ink/55")}>{c.blurb}</p>
                <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
                  {items.map((r) => (
                    <li key={r.slug} className="py-3">
                      <Link
                        to="/radar/rails/$slug"
                        params={{ slug: r.slug }}
                        className={cn(
                          T.strong,
                          "text-ink underline decoration-ink/20 underline-offset-4 transition-colors hover:text-[var(--accord-orange-deep)] hover:decoration-[var(--accord-orange-deep)]",
                        )}
                      >
                        {r.name}
                      </Link>
                      {r.isMessagingNetwork ? (
                        <span className={cn(T.micro, "ml-3 text-[var(--accord-orange-deep)]")}>
                          messaging network — does not settle
                        </span>
                      ) : null}
                      {r.description ? (
                        <p className={cn(T.body, "mt-1 max-w-2xl text-ink/65")}>{r.description}</p>
                      ) : null}
                      <p className={cn(T.micro, "mt-1 text-ink/45")}>
                        {formatDate(r.lastVerifiedAt)
                          ? `Last verified ${formatDate(r.lastVerifiedAt)}`
                          : "Not yet verified"}
                        {r.sourceUrl ? (
                          <>
                            {" · "}
                            <a
                              href={r.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="underline underline-offset-2"
                            >
                              Source
                            </a>
                          </>
                        ) : null}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </RadarShell>
  );
}
