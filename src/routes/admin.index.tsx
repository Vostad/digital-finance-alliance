import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { Shell } from "@/components/admin/Shell";
import {
  Button,
  Cell,
  Empty,
  Panel,
  Pill,
  Row,
  Stat,
  StatRow,
  TEXT,
  Table,
  money,
} from "@/components/admin/primitives";
import { dashboardView } from "@/rpc/dashboard";

/**
 * THE DASHBOARD — one screen, one question: what needs my attention right now?
 *
 * Five figures and a queue. Everything that used to be here and did not answer
 * that question — conversion rates, team standing, an inbox of fifty rows, a
 * list of every edition — has moved to the screen built to hold it. The measure
 * of this page is not how much it shows; it is how quickly someone knows what
 * to do next.
 *
 * PIPELINE and WON are sponsor money and are labelled as such. For a
 * delegate-only or speaker-only person they are ABSENT, not zero: showing
 * somebody "$0" for work that never carries money reads as a broken screen
 * rather than as a deliberate silence.
 *
 * One server call. `beforeLoad` used to resolve the user and the loader then
 * fetched the screen, which cost a whole round trip before any data started
 * moving. The payload now carries the user.
 */

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Dashboard — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  loader: async () => {
    const view = await dashboardView({ data: {} }).catch(() => null);
    if (!view) throw redirect({ to: "/admin/login" });
    return { view };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { view } = Route.useLoaderData();
  const router = useRouter();
  const { headline, followUps, showSponsorMoney, user } = view;

  const isMember = user.role === "team_member";
  const overdue = followUps.overdue.length;
  const today = followUps.today.length;
  const attention = overdue + today;

  const goLeads = (search?: Record<string, string>) =>
    router.navigate({ to: "/admin/leads", search: search as never });

  return (
    <Shell
      role={user.role}
      title={isMember ? `Today, ${user.fullName.split(" ")[0]}` : "Dashboard"}
      subtitle={
        attention > 0
          ? `${attention} ${attention === 1 ? "thing needs" : "things need"} your attention`
          : "Nothing overdue. Nothing due today."
      }
      actions={
        <Button onClick={() => router.navigate({ to: "/admin/leads/new" })}>+ Add lead</Button>
      }
    >
      <StatRow>
        <Stat label="New leads" value={headline.newLeads} hint="Not yet worked" />
        <Stat
          label="Unassigned"
          value={headline.unassigned}
          tone={headline.unassigned > 0 ? "urgent" : "default"}
          hint={headline.unassigned > 0 ? "Nobody owns these" : "All owned"}
        />
        <Stat
          label="Follow-ups due"
          value={attention}
          tone={overdue > 0 ? "urgent" : "default"}
          hint={overdue > 0 ? `${overdue} overdue` : "Nothing overdue"}
        />
        {showSponsorMoney ? (
          <>
            <Stat
              label="Pipeline"
              value={money(headline.totalPipeline, headline.currency)}
              hint="Sponsor · open workstreams"
            />
            <Stat
              label="Won revenue"
              value={money(headline.closedRevenue, headline.currency)}
              hint="Sponsor · cancellations excluded"
            />
          </>
        ) : null}
      </StatRow>

      <div className="mt-6">
        <Panel
          title="Needs attention"
          action={
            <Button variant="quiet" onClick={() => goLeads()}>
              Open leads →
            </Button>
          }
        >
          {attention === 0 ? (
            <Empty>
              Nothing overdue and nothing due today. New leads appear here the moment the website
              sends one.
            </Empty>
          ) : (
            <Table head={["Who", "Company", "Function", "Owner", "Due"]}>
              {[...followUps.overdue, ...followUps.today].slice(0, 25).map((f) => (
                <Row
                  key={f.id}
                  onClick={() => router.navigate({ to: `/admin/leads/${f.id}` as never })}
                >
                  <Cell className="font-medium">{f.personName}</Cell>
                  <Cell>{f.companyName ?? "—"}</Cell>
                  <Cell>{f.function}</Cell>
                  <Cell>{f.ownerName ?? <Pill tone="attention">Unassigned</Pill>}</Cell>
                  <Cell>
                    {followUps.overdue.some((o) => o.id === f.id) ? (
                      <Pill tone="attention">Overdue</Pill>
                    ) : (
                      <span className={cn(TEXT.micro, "text-ink/55")}>Today</span>
                    )}
                  </Cell>
                </Row>
              ))}
            </Table>
          )}
        </Panel>
      </div>
    </Shell>
  );
}
