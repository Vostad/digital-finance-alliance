import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";

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
  Button,
  money,
  rate,
} from "@/components/admin/primitives";
import { dashboardView } from "@/rpc/dashboard";
import { me } from "@/rpc/auth";

/**
 * TODAY — the first screen every role sees.
 *
 * §12's four questions, in the order a working day asks them:
 * what needs doing, how am I doing, what is still open, what can I earn.
 *
 * The same component serves all three roles. It does not branch on role to
 * decide what to SHOW — the server already decided what this person can see —
 * only on which extra sections exist at all. A Team Member has no team to
 * stand against and no unassigned inbox to triage.
 */

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Today — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const user = await me().catch(() => null);
    if (!user) throw redirect({ to: "/admin/login" });
    return { user };
  },
  loader: async ({ context }) => {
    const fn = context.user.role === "team_member" ? (context.user.functions[0] ?? null) : null;
    const view = await dashboardView({ data: { function: fn } });
    return { user: context.user, view };
  },
  component: TodayPage,
});

const ROLE_LABEL = {
  super_admin: "Super Admin",
  admin: "Admin",
  team_member: "Team Member",
} as const;

function TodayPage() {
  const { user, view } = Route.useLoaderData();
  const router = useRouter();
  const [fn, setFn] = useState<string | null>(
    user.role === "team_member" ? (user.functions[0] ?? null) : null,
  );

  const money_ = view.headline.totalPipeline !== null;
  const queue = view.followUps;
  const dueCount = queue.overdue.length + queue.today.length;

  async function switchFunction(next: string) {
    setFn(next);
    await router.navigate({ to: "/admin", search: { function: next } as never });
    router.invalidate();
  }

  return (
    <Shell
      title={`Today · ${user.fullName}`}
      subtitle={`${ROLE_LABEL[user.role]}${
        user.role === "super_admin"
          ? " · all events"
          : user.eventScopeIds.length
            ? ` · ${user.eventScopeIds.length} event${user.eventScopeIds.length === 1 ? "" : "s"}`
            : ""
      }`}
      actions={
        <>
          {/* §24 — a switcher only when there is something to switch between. */}
          {view.functions.length > 1 ? (
            <div className="flex items-center border border-hairline">
              {view.functions.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => switchFunction(f)}
                  className={cn(
                    "px-3 py-1.5 font-mono text-[13px] uppercase tracking-[0.1em] transition-colors",
                    fn === f ? "bg-ink text-paper" : "text-ink/55 hover:text-ink",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          ) : null}
          <Button onClick={() => router.navigate({ to: "/admin/leads/new" })}>+ Add lead</Button>
        </>
      }
    >
      <StatRow>
        <Stat label="Active" value={view.headline.active} hint="Open workstreams" />
        <Stat
          label="Unassigned"
          value={view.headline.unassigned}
          tone={view.headline.unassigned > 0 ? "urgent" : "muted"}
          hint="Owned by nobody"
        />
        <Stat
          label="Due"
          value={dueCount}
          tone={queue.overdue.length ? "urgent" : "default"}
          hint={`${queue.overdue.length} overdue`}
        />
        {money_ ? (
          <>
            <Stat
              label="Weighted pipeline"
              value={money(view.headline.weightedPipeline)}
              hint="Forecast, not committed"
            />
            <Stat
              label="Closed"
              value={money(view.headline.closedRevenue)}
              hint="Excludes cancelled"
            />
          </>
        ) : (
          <>
            <Stat label="Achieved" value={view.headline.achieved} hint="Confirmed" />
            <Stat label="New" value={view.headline.newLeads} hint="Not yet worked" />
          </>
        )}
      </StatRow>

      <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-7">
          <Panel title="What needs doing">
            {view.suggestions.length === 0 ? (
              <Empty>Nothing overdue and nothing waiting. Everything open has a next step.</Empty>
            ) : (
              <ul className="divide-y divide-hairline">
                {view.suggestions.map((s) => (
                  <li key={s.id} className="flex items-baseline gap-3 py-2.5">
                    <Pill tone={s.severity === "urgent" ? "attention" : "neutral"}>
                      {s.severity === "urgent"
                        ? "Now"
                        : s.severity === "attention"
                          ? "Soon"
                          : "Note"}
                    </Pill>
                    <span className={cn(TEXT.body, "min-w-0 flex-1")}>{s.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Follow-ups">
            {dueCount + queue.upcoming.length === 0 ? (
              <Empty>No follow-ups scheduled.</Empty>
            ) : (
              <Table head={["When", "Who", "Action", "Stage", "Owner"]}>
                {[...queue.overdue, ...queue.today, ...queue.upcoming].slice(0, 25).map((f) => (
                  <Row
                    key={f.id}
                    onClick={() => router.navigate({ to: `/admin/leads/${f.id}` as never })}
                  >
                    <Cell>
                      <Pill tone={queue.overdue.includes(f) ? "attention" : "neutral"}>
                        {queue.overdue.includes(f)
                          ? "Overdue"
                          : queue.today.includes(f)
                            ? "Today"
                            : new Date(f.nextActionDueAt!).toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "short",
                              })}
                      </Pill>
                    </Cell>
                    <Cell>
                      <span className="block font-medium">{f.personName}</span>
                      <span className="text-ink/55">{f.companyName ?? "—"}</span>
                    </Cell>
                    <Cell>{f.nextAction ?? "—"}</Cell>
                    <Cell>{f.stageKey}</Cell>
                    <Cell>{f.ownerName ?? "Unassigned"}</Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-7">
          {view.unassignedInbox.length > 0 ? (
            <Panel title="Unassigned">
              <Table head={["Who", "Function", "Edition", "Arrived"]}>
                {view.unassignedInbox.slice(0, 12).map((o) => (
                  <Row
                    key={o.id}
                    onClick={() => router.navigate({ to: `/admin/leads/${o.id}` as never })}
                  >
                    <Cell>
                      <span className="block font-medium">{o.personName}</span>
                      <span className="text-ink/55">{o.companyName ?? "—"}</span>
                    </Cell>
                    <Cell>{o.function}</Cell>
                    <Cell>{o.editionName}</Cell>
                    <Cell>
                      {new Date(o.createdAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </Cell>
                  </Row>
                ))}
              </Table>
            </Panel>
          ) : null}

          {view.rates ? (
            <Panel title="How it is going">
              <dl className="divide-y divide-hairline">
                {[
                  ["Contact rate", rate(view.rates.contactRate)],
                  ["Meeting rate", rate(view.rates.meetingRate)],
                  ["Close rate", rate(view.rates.closeRate)],
                  ["Loss rate", rate(view.rates.lossRate)],
                  ...(fn === "speaker"
                    ? [["Attrition", rate(view.rates.attritionRate)] as const]
                    : []),
                  ...(fn === "delegate"
                    ? [["Attendance", rate(view.rates.attendanceRate)] as const]
                    : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4 py-2">
                    <dt className={cn(TEXT.micro, "text-ink/60")}>{label}</dt>
                    <dd className={cn(TEXT.micro, "tabular-nums text-right")}>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className={cn(TEXT.micro, "mt-3 text-ink/45")}>
                Rates need {view.rates.minSample} records before they mean anything. Below that they
                read NOT ENOUGH DATA rather than a number the data cannot support.
              </p>
            </Panel>
          ) : null}

          {view.team && view.team.length > 0 ? (
            <Panel title="Team">
              <Table head={["Who", "Active", "Won", "Closed", "Overdue"]}>
                {view.team.map((t) => (
                  <Row key={t.userId}>
                    <Cell>{t.fullName}</Cell>
                    <Cell numeric>{t.active}</Cell>
                    <Cell numeric>{t.achieved}</Cell>
                    <Cell numeric>{money(t.closedRevenue)}</Cell>
                    <Cell numeric>
                      {t.overdue > 0 ? <Pill tone="attention">{t.overdue}</Pill> : "—"}
                    </Cell>
                  </Row>
                ))}
              </Table>
            </Panel>
          ) : null}
        </div>
      </div>

      <p className={cn(TEXT.micro, "mt-8 max-w-[70ch] text-ink/45")}>
        <Label>Note</Label> Every figure here is computed from records in this system. Nothing is
        modelled or estimated. Weighted pipeline is a forecast, never committed revenue.
      </p>
    </Shell>
  );
}
