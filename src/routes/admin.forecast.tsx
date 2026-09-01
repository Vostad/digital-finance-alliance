import { createFileRoute, redirect } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { Shell } from "@/components/admin/Shell";
import {
  Cell,
  Empty,
  Label,
  Panel,
  Pill,
  Row,
  Stat,
  StatRow,
  TEXT,
  Table,
  money,
} from "@/components/admin/primitives";
import { forecastView, overrides } from "@/rpc/dashboard";
import { me } from "@/rpc/auth";

/**
 * FORECAST — §11.
 *
 * The word is on the screen and so is the caveat. Every number here except
 * CLOSED describes deals that have not happened, and a screen that lets a
 * weighted sum sit unlabelled next to real revenue is how a forecast gets
 * quoted as a commitment.
 */

export const Route = createFileRoute("/admin/forecast")({
  head: () => ({
    meta: [{ title: "Forecast — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const user = await me().catch(() => null);
    if (!user) throw redirect({ to: "/admin/login" });
    return { user };
  },
  loader: async ({ context }) => {
    const [view, overridden] = await Promise.all([
      forecastView({ data: {} }),
      overrides({ data: {} }),
    ]);
    return { user: context.user, view, overridden };
  },
  component: ForecastPage,
});

function ForecastPage() {
  const { user, view, overridden } = Route.useLoaderData();
  const o = view.overall;
  const judgementGap = o.weightedPipeline - o.weightedAtLadder;

  return (
    <Shell
      role={user?.role}
      title="Forecast"
      subtitle="Sponsor. Closed revenue plus weighted open pipeline."
    >
      <StatRow>
        <Stat label="Total pipeline" value={money(o.totalPipeline)} hint={`${o.openCount} open`} />
        <Stat
          label="Weighted pipeline"
          value={money(o.weightedPipeline)}
          hint="Value × probability"
        />
        <Stat label="Closed" value={money(o.closedRevenue)} hint="Excludes cancelled" />
        <Stat label="Target" value={money(o.target)} hint={`${money(o.remaining)} remaining`} />
        <Stat label="Forecast" value={money(o.forecast)} hint="Not committed revenue" />
      </StatRow>

      <p className={cn(TEXT.body, "mt-4 max-w-[80ch] text-ink/60")}>{view.caveat}</p>

      <div className="mt-8 grid gap-7 lg:grid-cols-2">
        <Panel title="By edition">
          {view.byEdition.length === 0 ? (
            <Empty>Nothing open or closed in any edition.</Empty>
          ) : (
            <Table head={["Edition", "Open", "Weighted", "Closed", "Target", "Forecast"]}>
              {view.byEdition.map((e) => (
                <Row key={e.editionId}>
                  <Cell className="font-medium">{e.editionName}</Cell>
                  <Cell numeric>{e.openCount}</Cell>
                  <Cell numeric>{money(e.weightedPipeline)}</Cell>
                  <Cell numeric>{money(e.closedRevenue)}</Cell>
                  <Cell numeric>{e.target ? money(e.target) : "—"}</Cell>
                  <Cell numeric>{money(e.forecast)}</Cell>
                </Row>
              ))}
            </Table>
          )}
        </Panel>

        <Panel title="By owner">
          {view.byOwner.length === 0 ? (
            <Empty>No owned work.</Empty>
          ) : (
            <Table head={["Owner", "Open", "Weighted", "Closed", "Forecast"]}>
              {view.byOwner.map((owner) => (
                <Row key={owner.ownerId}>
                  <Cell className="font-medium">{owner.ownerName}</Cell>
                  <Cell numeric>{owner.openCount}</Cell>
                  <Cell numeric>{money(owner.weightedPipeline)}</Cell>
                  <Cell numeric>{money(owner.closedRevenue)}</Cell>
                  <Cell numeric>{money(owner.forecast)}</Cell>
                </Row>
              ))}
            </Table>
          )}
        </Panel>
      </div>

      <Panel title="Where the forecast rests on judgement" className="mt-8">
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <Label>At the configured ladder</Label>
            <p className={cn(TEXT.figureSm, "mt-1.5")}>{money(o.weightedAtLadder)}</p>
          </div>
          <div>
            <Label>As adjusted by owners</Label>
            <p className={cn(TEXT.figureSm, "mt-1.5")}>{money(o.weightedPipeline)}</p>
          </div>
          <div>
            <Label>Difference</Label>
            <p
              className={cn(
                TEXT.figureSm,
                "mt-1.5",
                judgementGap !== 0 && "text-[var(--accord-orange-deep)]",
              )}
            >
              {judgementGap >= 0 ? "+" : ""}
              {money(judgementGap)}
            </p>
          </div>
        </div>

        <p className={cn(TEXT.micro, "mt-4 max-w-[80ch] text-ink/55")}>
          Both readings are kept. The ladder is what the configured stage probabilities say; the
          adjusted figure is what the people closest to each deal say. {o.overriddenCount} open{" "}
          {o.overriddenCount === 1 ? "deal has" : "deals have"} been moved off the ladder, covering{" "}
          {money(o.overriddenValue)} of estimated value.
        </p>

        {overridden.length > 0 ? (
          <div className="mt-4">
            <Table head={["Who", "Stage", "Ladder", "Set to", "Value", "Owner"]}>
              {overridden.map((row) => (
                <Row key={row.id}>
                  <Cell className="font-medium">{row.personName}</Cell>
                  <Cell>{row.stageKey}</Cell>
                  <Cell numeric>{row.ladderProbability}%</Cell>
                  <Cell numeric>
                    <Pill tone={row.probability > row.ladderProbability ? "attention" : "neutral"}>
                      {row.probability}%
                    </Pill>
                  </Cell>
                  <Cell numeric>{money(row.estimatedValue, row.currency)}</Cell>
                  <Cell>{row.ownerName ?? "Unassigned"}</Cell>
                </Row>
              ))}
            </Table>
          </div>
        ) : null}
      </Panel>
    </Shell>
  );
}
