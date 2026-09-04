import { createFileRoute, Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { RadarShell } from "@/components/radar/Shell";
import { Cell, Row, T, Table, formatDate } from "@/components/radar/primitives";
import { providerIndex, radarCounts } from "@/rpc/radar";

/**
 * THE PROVIDER INDEX — deliberately plain.
 *
 * It exists to give every provider profile an internal link. Profiles are in
 * the sitemap and, until a corridor publishes, nothing points at them; a page
 * nothing links to is a page that does not get indexed.
 *
 * A name, what kind of institution it is, when it was last checked. No search,
 * no filters, no second product — the corridor pages are where a provider is
 * looked up in context, and this is the route in when there is no context yet.
 */
export const Route = createFileRoute("/radar/providers/")({
  head: () => ({
    meta: [
      { title: "Providers — Rails Radar" },
      {
        name: "description",
        content:
          "Every provider Rails Radar tracks: banks, payment service providers, stablecoin infrastructure, custodians and on/off-ramps — with the licences each holds and the registers they appear on.",
      },
      { property: "og:url", content: "https://railsradar.com/providers" },
    ],
    links: [{ rel: "canonical", href: "https://railsradar.com/providers" }],
  }),
  loader: async () => {
    const [{ providers }, counts] = await Promise.all([
      providerIndex().catch(() => ({ providers: [] })),
      radarCounts().catch(() => null),
    ]);
    return { providers, counts };
  },
  component: ProviderIndex,
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

function ProviderIndex() {
  const { providers, counts } = Route.useLoaderData();

  return (
    <RadarShell
      counts={counts}
      trail={[{ label: "Rails Radar", to: "/radar" }, { label: "Providers" }]}
    >
      <h1 className={cn(T.page, "text-ink")}>Providers</h1>
      <p className={cn(T.body, "mt-4 max-w-2xl text-ink/65")}>
        Who gives access to a rail. Each profile lists the markets served, assets and networks
        supported, the licences held with the register each appears on, and any published limits.
      </p>

      {providers.length === 0 ? (
        <div className="mt-10 border border-hairline bg-bone px-6 py-8">
          <h2 className={cn(T.heading, "text-ink")}>No providers published yet</h2>
          <p className={cn(T.body, "mt-3 max-w-2xl text-ink/65")}>
            A provider is published once its licences have been checked against the registers they
            appear on. A licence claim nobody can verify is not published here at all.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <Table head={[{ label: "Provider" }, { label: "Type" }, { label: "Last verified" }]}>
            {providers.map((p) => (
              <Row key={p.slug}>
                <Cell>
                  <Link
                    to="/radar/providers/$slug"
                    params={{ slug: p.slug }}
                    className="underline decoration-ink/20 underline-offset-4 transition-colors hover:text-[var(--accord-orange-deep)]"
                  >
                    {p.name}
                  </Link>
                </Cell>
                <Cell>{TYPE_LABEL[p.type] ?? p.type}</Cell>
                <Cell>
                  <span className={cn(T.micro, "text-ink/55")}>
                    {formatDate(p.lastVerifiedAt) ?? "Not yet verified"}
                  </span>
                </Cell>
              </Row>
            ))}
          </Table>
        </div>
      )}
    </RadarShell>
  );
}
