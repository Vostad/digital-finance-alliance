import { createFileRoute, redirect } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { Shell } from "@/components/admin/Shell";
import { Cell, Empty, Row, Stat, StatRow, TEXT, Table, money } from "@/components/admin/primitives";
import { targets } from "@/rpc/targets";
import { me } from "@/rpc/auth";

/**
 * MY TARGETS — "what am I expected to achieve?"
 *
 * A team member's whole reporting surface, and deliberately one screen. There
 * is no forecast module here and no analytics: the question is what the number
 * is, what it is now, and how far that leaves to go.
 *
 * `targetProgress` already confines a team member to their own rows on the
 * server, so this screen asks for "targets" and receives only theirs. Managers
 * reach the same data inside Events, where it sits beside the event it belongs
 * to.
 *
 * ATTENDED and WITHDRAWN are shown BESIDE the target, never inside it —
 * delegate achievement is CONFIRMED, and a speaker who withdraws is attrition
 * rather than a loss. Folding either into the headline number would quietly
 * restate what the business means by hitting a target.
 */

export const Route = createFileRoute("/admin/targets")({
  head: () => ({
    meta: [{ title: "My targets — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  loader: async () => {
    const user = await me().catch(() => null);
    if (!user) throw redirect({ to: "/admin/login" });
    const rows = await targets({ data: {} }).catch(() => []);
    return { user, rows };
  },
  component: MyTargetsPage,
});

function MyTargetsPage() {
  const { user, rows } = Route.useLoaderData();

  const money_ = rows.filter((r) => r.metric === "revenue");
  const counted = rows.filter((r) => r.metric === "count");
  const totalTarget = money_.reduce((s, r) => s + r.target, 0);
  const totalAchieved = money_.reduce((s, r) => s + r.achieved, 0);

  return (
    <Shell
      role={user.role}
      title="My targets"
      subtitle={
        rows.length === 0
          ? "Nothing set yet"
          : `${rows.length} target${rows.length === 1 ? "" : "s"}`
      }
    >
      {rows.length === 0 ? (
        <Empty>
          No targets have been set for you yet. A Super Admin sets them against an event.
        </Empty>
      ) : (
        <>
          <StatRow>
            {money_.length > 0 ? (
              <>
                <Stat label="Sponsor target" value={money(totalTarget)} hint="This period" />
                <Stat label="Achieved" value={money(totalAchieved)} hint="Cancellations excluded" />
                <Stat
                  label="Remaining"
                  value={money(Math.max(0, totalTarget - totalAchieved))}
                  tone={totalAchieved >= totalTarget ? "muted" : "default"}
                />
              </>
            ) : null}
            {counted.length > 0 ? (
              <>
                <Stat
                  label="Counted targets"
                  value={counted.reduce((s, r) => s + r.target, 0)}
                  hint="Delegate and speaker"
                />
                <Stat
                  label="Confirmed"
                  value={counted.reduce((s, r) => s + r.achieved, 0)}
                  hint="Attendance is reported separately"
                />
              </>
            ) : null}
          </StatRow>

          <div className="mt-6">
            <Table
              head={["Work", "Edition", "Target", "Achieved", "Remaining", "Progress", "Beside it"]}
            >
              {rows.map((t) => (
                <Row key={t.id}>
                  <Cell className="font-medium">{t.function}</Cell>
                  <Cell>{t.editionName ?? "—"}</Cell>
                  <Cell numeric>
                    {t.metric === "revenue" ? money(t.target, t.currency ?? "USD") : t.target}
                  </Cell>
                  <Cell numeric>
                    {t.metric === "revenue" ? money(t.achieved, t.currency ?? "USD") : t.achieved}
                  </Cell>
                  <Cell numeric>
                    {t.metric === "revenue" ? money(t.remaining, t.currency ?? "USD") : t.remaining}
                  </Cell>
                  <Cell numeric>
                    {t.progressPct === null ? "—" : `${Math.round(t.progressPct)}%`}
                  </Cell>
                  <Cell>
                    <span className={cn(TEXT.micro, "text-ink/55")}>
                      {t.function === "delegate" && `${t.attended} attended`}
                      {t.function === "speaker" && `${t.withdrawn} withdrawn`}
                      {t.function === "sponsor" && "—"}
                    </span>
                  </Cell>
                </Row>
              ))}
            </Table>
          </div>
        </>
      )}
    </Shell>
  );
}
