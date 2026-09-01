import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Shell } from "@/components/admin/Shell";
import { Empty, Label, Panel, Pill, TEXT, money } from "@/components/admin/primitives";
import { productivityInsights, productivityMetrics } from "@/rpc/dashboard";
import { me } from "@/rpc/auth";

/**
 * INSIGHTS — §12.
 *
 * Two halves, and the distinction matters: what to do next, and how it is
 * going. The first is a list of real rows. The second is arithmetic that
 * refuses to run below its sample size and says NOT ENOUGH DATA instead of
 * showing a percentage nobody should act on.
 */

export const Route = createFileRoute("/admin/insights")({
  head: () => ({
    meta: [{ title: "Insights — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const user = await me().catch(() => null);
    if (!user) throw redirect({ to: "/admin/login" });
    return { user };
  },
  loader: async ({ context }) => {
    const fn =
      context.user.role === "team_member"
        ? ((context.user.functions[0] ?? "sponsor") as "sponsor")
        : ("sponsor" as const);
    const [list, stats] = await Promise.all([
      productivityInsights({ data: {} }),
      productivityMetrics({ data: { function: fn } }),
    ]);
    return { user: context.user, fn, list, stats };
  },
  component: InsightsPage,
});

function formatMetric(m: {
  value: number | null;
  format: string;
  numerator: number;
  denominator: number;
}) {
  if (m.value == null) {
    return (
      <span className="text-ink/50">
        NOT ENOUGH DATA{" "}
        <span className="tabular-nums">
          ({m.numerator}/{m.denominator})
        </span>
      </span>
    );
  }
  if (m.format === "percent") return `${Math.round(m.value * 100)}%`;
  if (m.format === "money") return money(m.value);
  if (m.format === "days") return `${Math.round(m.value)} days`;
  return String(Math.round(m.value));
}

function InsightsPage() {
  const { user, fn, list, stats } = Route.useLoaderData();
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  const functions =
    user.role === "team_member" ? user.functions : (["sponsor", "delegate", "speaker"] as const);

  return (
    <Shell
      role={user?.role}
      title="Insights"
      subtitle={`${fn} · computed from ${stats.total} workstream${stats.total === 1 ? "" : "s"} you can see`}
      actions={
        functions.length > 1 ? (
          <div className="flex items-center border border-hairline">
            {functions.map((f) => (
              <button
                key={f}
                type="button"
                onClick={async () => {
                  await router.navigate({
                    to: "/admin/insights",
                    search: { function: f } as never,
                  });
                  await router.invalidate();
                }}
                className={cn(
                  "px-3 py-1.5 font-mono text-[13px] uppercase tracking-[0.1em] transition-colors",
                  fn === f ? "bg-ink text-paper" : "text-ink/55 hover:text-ink",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        ) : null
      }
    >
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel title="What to do next">
          {list.length === 0 ? (
            <Empty>
              Nothing needs attention. Everything open has been contacted and has a next step.
            </Empty>
          ) : (
            <ul className="divide-y divide-hairline">
              {list.map((insight) => (
                <li key={insight.id} className="py-3">
                  <div className="flex items-baseline gap-3">
                    <Pill
                      tone={
                        insight.severity === "urgent"
                          ? "attention"
                          : insight.severity === "attention"
                            ? "open"
                            : "neutral"
                      }
                    >
                      {insight.severity === "urgent"
                        ? "Now"
                        : insight.severity === "attention"
                          ? "Soon"
                          : "Note"}
                    </Pill>
                    <span className={cn(TEXT.body, "min-w-0 flex-1")}>{insight.text}</span>
                    <button
                      type="button"
                      onClick={() => setOpenId(openId === insight.id ? null : insight.id)}
                      className={cn(
                        TEXT.micro,
                        "shrink-0 text-ink/55 underline underline-offset-4",
                      )}
                    >
                      {openId === insight.id ? "Hide" : "Show"}
                    </button>
                  </div>

                  {/* Every suggestion names the exact rows it counted. A
                      suggestion you cannot check is one you have to believe. */}
                  {openId === insight.id ? (
                    <ul className="mt-2 space-y-1 border-l border-hairline pl-3">
                      {insight.opportunityIds.map((id) => (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => router.navigate({ to: `/admin/leads/${id}` as never })}
                            className={cn(TEXT.micro, "text-ink/70 underline underline-offset-4")}
                          >
                            Open workstream
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="How it is going">
          <dl className="divide-y divide-hairline">
            {stats.metrics.map((m) => (
              <div key={m.key} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="min-w-0">
                  <span className={cn(TEXT.body, "block")}>{m.label}</span>
                  <span className={cn(TEXT.micro, "text-ink/50")}>{m.basis}</span>
                </dt>
                <dd className={cn(TEXT.micro, "shrink-0 text-right tabular-nums")}>
                  {formatMetric(m)}
                </dd>
              </div>
            ))}
          </dl>

          <p className={cn(TEXT.micro, "mt-4 text-ink/50")}>
            <Label>Note</Label> Rates need {stats.minSample} records before they are shown. Below
            that the counts appear instead — a percentage over four records is noise, and a
            percentage is a persuasive way to present a number nobody should act on.
          </p>
        </Panel>
      </div>
    </Shell>
  );
}
