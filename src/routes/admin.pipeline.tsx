import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Shell } from "@/components/admin/Shell";
import { Empty, Label, Pill, TEXT, money } from "@/components/admin/primitives";
import { board } from "@/rpc/leads";
import { me } from "@/rpc/auth";

/**
 * THE PIPELINE BOARD — §4.
 *
 * Columns are the stages, in their configured order, read from the database.
 * Counts and money come from one aggregate query so they cannot disagree with
 * the cards beneath them.
 *
 * Horizontal scroll on the board, never on the page: nine sponsor columns do
 * not fit any laptop, and a body that scrolls sideways makes the navigation
 * unreachable.
 */

export const Route = createFileRoute("/admin/pipeline")({
  head: () => ({
    meta: [{ title: "Pipeline — Financial Rails OS" }, { name: "robots", content: "noindex" }],
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
    return { user: context.user, fn, data: await board({ data: { function: fn } }) };
  },
  component: PipelinePage,
});

function PipelinePage() {
  const { user, fn, data } = Route.useLoaderData();
  const router = useRouter();
  const [active, setActive] = useState<string>(fn);

  const functions =
    user.role === "team_member" ? user.functions : (["sponsor", "delegate", "speaker"] as const);

  return (
    <Shell
      role={user?.role}
      title="Pipeline"
      subtitle={`${data.cards.length} workstream${data.cards.length === 1 ? "" : "s"} you can see`}
      actions={
        functions.length > 1 ? (
          <div className="flex items-center border border-hairline">
            {functions.map((f) => (
              <button
                key={f}
                type="button"
                onClick={async () => {
                  setActive(f);
                  await router.navigate({
                    to: "/admin/pipeline",
                    search: { function: f } as never,
                  });
                  router.invalidate();
                }}
                className={cn(
                  "px-3 py-1.5 font-mono text-[13px] uppercase tracking-[0.1em] transition-colors",
                  active === f ? "bg-ink text-paper" : "text-ink/55 hover:text-ink",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        ) : null
      }
    >
      {data.cards.length === 0 ? (
        <Empty>Nothing in this pipeline yet. Add a lead to start one.</Empty>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          <div className="flex min-w-max gap-3">
            {data.columns.map((col) => {
              const cards = data.cards.filter((c) => c.stageKey === col.key);
              return (
                <section
                  key={col.key}
                  className="flex w-[15.5rem] shrink-0 flex-col border border-hairline bg-paper"
                >
                  <header className="border-b border-hairline px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <Label>{col.label}</Label>
                      <span className={cn(TEXT.micro, "tabular-nums text-ink/55")}>
                        {col.count}
                      </span>
                    </div>
                    {col.totalValue !== null ? (
                      <p className={cn(TEXT.micro, "mt-1 tabular-nums text-ink/60")}>
                        {money(col.totalValue)}
                        {col.isOpen && col.weightedValue ? (
                          <span className="text-ink/40">
                            {" "}
                            · {money(col.weightedValue)} weighted
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </header>

                  <div className="flex-1 space-y-px bg-hairline/40">
                    {cards.length === 0 ? (
                      <p className={cn(TEXT.micro, "bg-paper px-3 py-4 text-ink/35")}>—</p>
                    ) : (
                      cards.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() =>
                            router.navigate({ to: `/admin/leads/${card.id}` as never })
                          }
                          className="block w-full bg-paper px-3 py-2.5 text-left transition-colors hover:bg-ink/[0.035]"
                        >
                          <span className={cn(TEXT.strong, "block truncate")}>
                            {card.personName}
                          </span>
                          <span className={cn(TEXT.micro, "block truncate text-ink/55")}>
                            {card.companyName ?? "—"}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {card.priority === "high" ? <Pill tone="attention">High</Pill> : null}
                            {card.estimatedValue ? (
                              <span className={cn(TEXT.micro, "tabular-nums text-ink/70")}>
                                {money(card.finalValue ?? card.estimatedValue, card.currency)}
                              </span>
                            ) : null}
                            {card.ownerName ? null : <Pill tone="attention">Unassigned</Pill>}
                          </span>
                          {card.nextActionDueAt ? (
                            <span className={cn(TEXT.micro, "mt-1 block text-ink/50")}>
                              {card.nextAction} ·{" "}
                              {new Date(card.nextActionDueAt).toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </Shell>
  );
}
