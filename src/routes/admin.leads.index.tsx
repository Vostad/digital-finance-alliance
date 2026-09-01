import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";

import { Shell } from "@/components/admin/Shell";
import { Button, Cell, Empty, Pill, Row, Table, money } from "@/components/admin/primitives";
import { listWorkstreams } from "@/rpc/leads";
import { me } from "@/rpc/auth";

/** LEADS — the flat list, for when the board is the wrong shape. Same scope,
    same rows; a table is simply better for scanning fifty of them. */

export const Route = createFileRoute("/admin/leads/")({
  head: () => ({
    meta: [{ title: "Leads — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const user = await me().catch(() => null);
    if (!user) throw redirect({ to: "/admin/login" });
    return { user };
  },
  loader: async () => ({ rows: await listWorkstreams({ data: {} }) }),
  component: LeadsPage,
});

function LeadsPage() {
  const { rows } = Route.useLoaderData();
  const router = useRouter();

  return (
    <Shell
      title="Leads"
      subtitle={`${rows.length} workstream${rows.length === 1 ? "" : "s"}`}
      actions={
        <Button onClick={() => router.navigate({ to: "/admin/leads/new" })}>+ Add lead</Button>
      }
    >
      {rows.length === 0 ? (
        <Empty>Nothing yet. Add a lead, or wait for the website to send one.</Empty>
      ) : (
        <Table head={["Who", "Company", "Function", "Stage", "Owner", "Edition", "Value"]}>
          {rows.map((r) => (
            <Row
              key={r.id}
              onClick={() => router.navigate({ to: `/admin/leads/${r.id}` as never })}
            >
              <Cell className="font-medium">{r.personName}</Cell>
              <Cell>{r.companyName ?? "—"}</Cell>
              <Cell>{r.function}</Cell>
              <Cell>
                <Pill tone={r.finalValue ? "won" : "open"}>{r.stageKey}</Pill>
              </Cell>
              <Cell>{r.ownerName ?? <Pill tone="attention">Unassigned</Pill>}</Cell>
              <Cell>{r.editionName}</Cell>
              <Cell numeric>
                {r.finalValue || r.estimatedValue
                  ? money(r.finalValue ?? r.estimatedValue, r.currency)
                  : "—"}
              </Cell>
            </Row>
          ))}
        </Table>
      )}
    </Shell>
  );
}
