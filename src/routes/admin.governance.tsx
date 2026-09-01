import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Shell } from "@/components/admin/Shell";
import {
  Button,
  Cell,
  Empty,
  Field,
  INPUT,
  Label,
  Panel,
  Pill,
  Row,
  TEXT,
  Table,
} from "@/components/admin/primitives";
import { audit, erasures, exportData } from "@/rpc/governance";
import { me } from "@/rpc/auth";

/**
 * GOVERNANCE — §14, §15, §17. Super Admin only.
 *
 * The audit trail, CSV export, and the erasure register. Nothing here is
 * reachable by an Admin or a Team Member; the server refuses each call
 * independently, and the route redirects rather than rendering an empty shell.
 */

export const Route = createFileRoute("/admin/governance")({
  head: () => ({
    meta: [{ title: "Governance — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const user = await me().catch(() => null);
    if (!user) throw redirect({ to: "/admin/login" });
    /* Not a hidden menu item — a closed door. The server would refuse anyway;
       this stops the screen rendering a shell it cannot fill. */
    if (user.role !== "super_admin") throw redirect({ to: "/admin" });
    return { user };
  },
  loader: async ({ context }) => {
    const [trail, register] = await Promise.all([audit({ data: { limit: 200 } }), erasures()]);
    return { user: context.user, trail, register };
  },
  component: GovernancePage,
});

const EXPORTS = ["opportunities", "people", "companies", "commission"] as const;

function GovernancePage() {
  const { user, trail, register } = Route.useLoaderData();
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const rows = filter
    ? trail.filter(
        (t) =>
          t.action.includes(filter) ||
          t.entityType.includes(filter) ||
          (t.actorName ?? "").toLowerCase().includes(filter.toLowerCase()),
      )
    : trail;

  async function download(kind: (typeof EXPORTS)[number]) {
    setBusy(kind);
    setNote(null);
    try {
      const result = await exportData({ data: { kind } });
      /* Built in the browser from data the server already authorised, so the
         file never becomes a second, unguarded endpoint. */
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      setNote(`${result.rows} row${result.rows === 1 ? "" : "s"} exported. The export is audited.`);
      await router.invalidate();
    } catch (problem) {
      setNote(problem instanceof Error ? problem.message : "Export failed.");
    }
    setBusy(null);
  }

  return (
    <Shell
      role={user?.role}
      title="Governance"
      subtitle="Audit trail, export and the erasure register."
    >
      <Panel title="Export">
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {EXPORTS.map((kind) => (
            <Button
              key={kind}
              variant="secondary"
              disabled={busy !== null}
              onClick={() => download(kind)}
            >
              {busy === kind ? "Preparing…" : kind}
            </Button>
          ))}
        </div>
        {note ? <p className={cn(TEXT.micro, "mt-3 text-ink/60")}>{note}</p> : null}
        <p className={cn(TEXT.micro, "mt-3 max-w-[80ch] text-ink/50")}>
          Rows come through the same scoped queries the screens use, and every export is written to
          the audit trail — a copy of the pipeline leaving the building is an event somebody may
          need to account for.
        </p>
      </Panel>

      <Panel title="Audit trail" className="mt-8">
        <div className="mt-3 max-w-[22rem]">
          <Field label="Filter">
            <input
              className={INPUT}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="action, entity or person"
            />
          </Field>
        </div>

        <div className="mt-4">
          {rows.length === 0 ? (
            <Empty>Nothing matches.</Empty>
          ) : (
            <Table head={["When", "Who", "What", "Entity", "Changed"]}>
              {rows.map((t) => (
                <Row key={t.id}>
                  <Cell>
                    {new Date(t.occurredAt).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Cell>
                  <Cell>{t.actorName ?? <span className="text-ink/50">Website</span>}</Cell>
                  <Cell>
                    <Pill
                      tone={
                        t.action === "erased" || t.action.includes("reversed")
                          ? "attention"
                          : t.action === "won"
                            ? "won"
                            : "neutral"
                      }
                    >
                      {t.action.replace(/_/g, " ")}
                    </Pill>
                  </Cell>
                  <Cell>{t.entityType}</Cell>
                  <Cell>
                    {t.before || t.after ? (
                      <span className="font-mono text-[13px] leading-[1.45] text-ink/70">
                        {t.before ? (
                          <span className="line-through opacity-60">{summarise(t.before)}</span>
                        ) : null}
                        {t.before && t.after ? " → " : null}
                        {t.after ? summarise(t.after) : null}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Cell>
                </Row>
              ))}
            </Table>
          )}
        </div>
      </Panel>

      <Panel title="Erasure register" className="mt-8">
        {register.length === 0 ? (
          <Empty>Nobody has been erased.</Empty>
        ) : (
          <>
            <Table head={["When", "By", "Fields cleared", "Reason"]}>
              {register.map((e) => (
                <Row key={e.id}>
                  <Cell>
                    {new Date(e.performedAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Cell>
                  <Cell>{e.performedByName ?? "—"}</Cell>
                  <Cell>{e.fieldsCleared.join(", ")}</Cell>
                  <Cell>{e.reason ?? "—"}</Cell>
                </Row>
              ))}
            </Table>
            <p className={cn(TEXT.micro, "mt-3 text-ink/50")}>
              <Label>Note</Label> Field names only. What those fields contained is not recorded
              anywhere — storing it would defeat the purpose of erasing it.
            </p>
          </>
        )}
      </Panel>
    </Shell>
  );
}

/** Changed fields, short enough for a table cell. */
function summarise(payload: Record<string, unknown>): string {
  return Object.entries(payload)
    .slice(0, 3)
    .map(([k, v]) => `${k}=${typeof v === "object" ? "…" : String(v)}`)
    .join(" ");
}
