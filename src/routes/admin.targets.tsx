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
  money,
} from "@/components/admin/primitives";
import { changeTarget, createTarget, targetOptions, targets } from "@/rpc/targets";
import { leadFormOptions } from "@/rpc/leads";
import { me } from "@/rpc/auth";

/**
 * TARGETS — §9.
 *
 * Every row shows TARGET · ACHIEVED · REMAINING · PIPELINE · FORECAST ·
 * PROGRESS, measured against the same owner, function, edition and window the
 * target names. Delegate ATTENDED and speaker WITHDRAWN sit BESIDE the target
 * in their own column — never folded into achievement (D2, D4).
 *
 * A Team Member reaches this screen and sees only their own numbers. Setting a
 * target is Super Admin only, and the check is on the server: an Admin who
 * could set their team's numbers could set them low, and every progress figure
 * in the system would become unfalsifiable.
 */

export const Route = createFileRoute("/admin/targets")({
  head: () => ({
    meta: [{ title: "Targets — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const user = await me().catch(() => null);
    if (!user) throw redirect({ to: "/admin/login" });
    return { user };
  },
  loader: async ({ context }) => {
    const rows = await targets({ data: {} });
    const canSet = context.user.role === "super_admin";
    const [options, form] = await Promise.all([
      canSet ? targetOptions() : Promise.resolve({ users: [] }),
      canSet ? leadFormOptions() : Promise.resolve(null),
    ]);
    return { user: context.user, rows, options, form, canSet };
  },
  component: TargetsPage,
});

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

function TargetsPage() {
  const { user, rows, options, form, canSet } = Route.useLoaderData();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await createTarget({
        data: {
          userId: String(data.get("userId")),
          function: String(data.get("function")) as "sponsor",
          editionId: String(data.get("editionId")),
          targetValue: String(data.get("targetValue")),
          periodStart: String(data.get("periodStart")),
          periodEnd: String(data.get("periodEnd")),
        },
      });
      setAdding(false);
      await router.invalidate();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not set that target.");
    }
    setBusy(false);
  }

  return (
    <Shell
      role={user?.role}
      title="Targets"
      subtitle={
        canSet
          ? "Set by event, edition, function, team member and period."
          : "Your targets, for the functions you work."
      }
      actions={canSet ? <Button onClick={() => setAdding((v) => !v)}>+ Set target</Button> : null}
    >
      {adding && form ? (
        <Panel title="New target" className="mb-7">
          <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Team member" required>
              <select className={INPUT} name="userId" required>
                {options.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Function" required hint="Sponsor is money. The others are counts.">
              <select className={INPUT} name="function" defaultValue="sponsor">
                {["sponsor", "delegate", "speaker"].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Edition" required>
              <select className={INPUT} name="editionId" required>
                {form.editions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Target" required>
              <input className={INPUT} name="targetValue" inputMode="decimal" required />
            </Field>
            <Field label="Period start" required>
              <input className={INPUT} name="periodStart" type="date" required />
            </Field>
            <Field label="Period end" required>
              <input className={INPUT} name="periodEnd" type="date" required />
            </Field>

            {error ? (
              <p
                role="alert"
                className={cn(
                  TEXT.body,
                  "sm:col-span-2 lg:col-span-3 border-l-2 border-[var(--accord-orange-deep)] pl-3",
                )}
              >
                {error}
              </p>
            ) : null}

            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Set target"}
              </Button>
              <Button variant="quiet" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}

      {rows.length === 0 ? (
        <Empty>
          {canSet ? "No targets set yet." : "No targets set for you yet. A Super Admin sets them."}
        </Empty>
      ) : (
        <Table
          head={[
            "Who",
            "Function",
            "Edition",
            "Target",
            "Achieved",
            "Remaining",
            "Pipeline",
            "Forecast",
            "Progress",
            "Beside it",
          ]}
        >
          {rows.map((t) => {
            const fmt = (v: number) =>
              t.metric === "revenue" ? money(v, t.currency ?? "USD") : String(v);
            return (
              <Row key={t.id}>
                <Cell className="font-medium">{t.userName}</Cell>
                <Cell>{t.function}</Cell>
                <Cell>{t.editionName ?? t.eventName ?? "—"}</Cell>
                <Cell numeric>
                  {canSet ? (
                    <input
                      className="w-24 border border-transparent bg-transparent px-1 py-0.5 text-right text-[14px] tabular-nums hover:border-hairline focus:border-ink focus:outline-none"
                      defaultValue={t.target}
                      inputMode="decimal"
                      onBlur={async (e) => {
                        const next = e.target.value.trim();
                        if (!next || Number(next) === t.target) return;
                        try {
                          await changeTarget({ data: { targetId: t.id, targetValue: next } });
                          await router.invalidate();
                        } catch (problem) {
                          setError(
                            problem instanceof Error ? problem.message : "Could not change that.",
                          );
                          e.target.value = String(t.target);
                        }
                      }}
                    />
                  ) : (
                    fmt(t.target)
                  )}
                </Cell>
                <Cell numeric>{fmt(t.achieved)}</Cell>
                <Cell numeric>{fmt(t.remaining)}</Cell>
                <Cell numeric>{fmt(t.pipeline)}</Cell>
                <Cell numeric>{fmt(Math.round(t.forecast))}</Cell>
                <Cell numeric>
                  <Pill
                    tone={
                      t.progressPct == null
                        ? "neutral"
                        : t.progressPct >= 1
                          ? "won"
                          : t.progressPct >= 0.5
                            ? "open"
                            : "attention"
                    }
                  >
                    {pct(t.progressPct)}
                  </Pill>
                </Cell>
                <Cell>
                  {/* D2 / D4 — beside the target, never inside it. */}
                  {t.function === "delegate" && t.attended > 0 ? (
                    <span className={TEXT.micro}>{t.attended} attended</span>
                  ) : t.function === "speaker" && t.withdrawn > 0 ? (
                    <span className={TEXT.micro}>{t.withdrawn} withdrew</span>
                  ) : (
                    "—"
                  )}
                </Cell>
              </Row>
            );
          })}
        </Table>
      )}

      <p className={cn(TEXT.micro, "mt-6 max-w-[80ch] text-ink/45")}>
        <Label>Note</Label> Forecast is achieved plus weighted open pipeline. It is a forecast, not
        committed revenue. Achievement counts a workstream once it converts and stops counting it if
        the person withdraws; a delegate who goes on to attend still counts once.
      </p>
    </Shell>
  );
}
