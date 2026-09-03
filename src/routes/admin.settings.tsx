import { createFileRoute, redirect } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { Shell } from "@/components/admin/Shell";
import { Cell, Empty, Panel, Row, TEXT, Table } from "@/components/admin/primitives";
import { audit, erasures } from "@/rpc/governance";
import { me } from "@/rpc/auth";

/**
 * SETTINGS — reached from the account menu, never from the daily navigation.
 *
 * What lives here is what is consulted rarely and deliberately: the audit trail,
 * and the register of people whose personal data has been erased. Neither
 * belongs in a four-item navigation competing with the work.
 *
 * Both are read-only. Erasure is EXECUTED nowhere in this interface — the
 * capability exists and is authorized on the server, but there is no control
 * for it, which is a recorded and approved position rather than an oversight.
 */

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [{ title: "Settings — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  loader: async () => {
    const user = await me().catch(() => null);
    if (!user) throw redirect({ to: "/admin/login" });

    /* Super Admin only, on the server. A manager who is not one simply sees the
       account section; the trail never reaches the browser. */
    const isSuper = user.role === "super_admin";
    const [trail, register] = await Promise.all([
      isSuper ? audit({ data: { limit: 100 } }).catch(() => []) : Promise.resolve([]),
      isSuper ? erasures().catch(() => []) : Promise.resolve([]),
    ]);
    return { user, trail, register, isSuper };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { user, trail, register, isSuper } = Route.useLoaderData();

  return (
    <Shell role={user.role} title="Settings" subtitle="Configuration and record-keeping">
      <Panel title="Account">
        <dl className="grid gap-3 py-4 sm:grid-cols-3">
          <div>
            <dt className={cn(TEXT.micro, "text-ink/50")}>Name</dt>
            <dd className="mt-1">{user.fullName}</dd>
          </div>
          <div>
            <dt className={cn(TEXT.micro, "text-ink/50")}>Email</dt>
            <dd className="mt-1">{user.email}</dd>
          </div>
          <div>
            <dt className={cn(TEXT.micro, "text-ink/50")}>Role</dt>
            <dd className="mt-1">{user.role.replace("_", " ")}</dd>
          </div>
        </dl>
      </Panel>

      {isSuper ? (
        <>
          <div className="mt-7">
            <Panel title="Audit trail">
              {trail.length === 0 ? (
                <Empty>Nothing recorded yet.</Empty>
              ) : (
                <Table head={["When", "Who", "What", "Record"]}>
                  {trail.map((a) => (
                    <Row key={a.id}>
                      <Cell>{new Date(a.occurredAt).toLocaleString("en-GB")}</Cell>
                      <Cell>{a.actorName ?? "—"}</Cell>
                      <Cell>{a.action.replace(/_/g, " ")}</Cell>
                      <Cell>{a.entityType}</Cell>
                    </Row>
                  ))}
                </Table>
              )}
            </Panel>
          </div>

          <div className="mt-7">
            <Panel title="Erasure register">
              {register.length === 0 ? (
                <Empty>Nobody has been erased.</Empty>
              ) : (
                <Table head={["When", "Record", "Reason"]}>
                  {register.map((e) => (
                    <Row key={e.id}>
                      <Cell>{new Date(e.performedAt).toLocaleString("en-GB")}</Cell>
                      <Cell>{e.personId}</Cell>
                      <Cell>{e.reason ?? "—"}</Cell>
                    </Row>
                  ))}
                </Table>
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </Shell>
  );
}
