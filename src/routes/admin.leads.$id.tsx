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
import { logWork, moveStage, setOwner, workstream } from "@/rpc/leads";
import { me } from "@/rpc/auth";

/**
 * ONE WORKSTREAM — the screen where work actually gets done.
 *
 * Three things happen here and nothing else: move the stage, log what
 * happened, set what happens next. Every rule §4 states is enforced on the
 * server; this screen's job is to ask for the reason the server is about to
 * require, in the same interaction, so nobody meets a validation error they
 * could have been asked about.
 */

export const Route = createFileRoute("/admin/leads/$id")({
  head: () => ({
    meta: [{ title: "Workstream — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const user = await me().catch(() => null);
    if (!user) throw redirect({ to: "/admin/login" });
    return { user };
  },
  loader: async ({ params }) => ({ data: await workstream({ data: { id: params.id } }) }),
  component: WorkstreamPage,
});

const ACTIVITY_TYPES = [
  "call",
  "email",
  "meeting",
  "proposal",
  "note",
  "follow_up",
  "other",
] as const;

function WorkstreamPage() {
  const { data } = Route.useLoaderData();
  const router = useRouter();
  const opp = data.opportunity;

  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [finalValue, setFinalValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!opp) return <Shell title="Not found">{null}</Shell>;

  const stage = data.stages.find((s) => s.key === opp.stageKey);
  const target = data.stages.find((s) => s.key === pendingStage);

  /* Which reason the server is about to demand, asked for before it does. */
  const needsLoss = Boolean(target?.isLost);
  const needsCancellation = Boolean(target?.isCancelled);
  const needsWithdrawal = Boolean(target?.isAttrition);
  const needsValue = Boolean(target?.isWon) && opp.function === "sponsor" && !opp.finalValue;
  const reasonOptions = needsCancellation
    ? data.cancellationReasons
    : needsWithdrawal
      ? data.withdrawalReasons
      : data.lossReasons;

  async function commitStage() {
    if (!pendingStage) return;
    setBusy(true);
    setError(null);
    try {
      await moveStage({
        data: {
          opportunityId: opp!.id,
          stageKey: pendingStage,
          lossReasonKey: needsLoss ? reason : undefined,
          cancellationReasonKey: needsCancellation ? reason : undefined,
          withdrawalReasonKey: needsWithdrawal ? reason : undefined,
          finalValue: needsValue ? finalValue : undefined,
        },
      });
      setPendingStage(null);
      setReason("");
      await router.invalidate();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not move that.");
    }
    setBusy(false);
  }

  async function submitActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const due = String(form.get("due") ?? "");
      await logWork({
        data: {
          opportunityId: opp!.id,
          type: String(form.get("type")) as "call",
          notes: String(form.get("notes") ?? "") || undefined,
          nextAction: String(form.get("nextAction") ?? "") || null,
          nextActionDueAt: due ? new Date(`${due}T12:00:00Z`).toISOString() : null,
        },
      });
      event.currentTarget.reset();
      await router.invalidate();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not save that.");
    }
    setBusy(false);
  }

  return (
    <Shell
      title={opp.personName}
      subtitle={`${opp.companyName ?? "No company"} · ${opp.function} · ${opp.editionName}`}
      actions={
        <>
          <Pill tone={stage?.isWon ? "won" : stage?.isLost ? "lost" : "open"}>
            {stage?.label ?? opp.stageKey}
          </Pill>
          {opp.ownerName ? null : <Pill tone="attention">Unassigned</Pill>}
        </>
      }
    >
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-7">
          <Panel title="Move stage">
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.stages.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  disabled={s.key === opp.stageKey}
                  onClick={() => {
                    setPendingStage(s.key);
                    setReason("");
                    setError(null);
                  }}
                  className={cn(
                    "border px-2.5 py-1.5 font-mono text-[13px] uppercase tracking-[0.08em] transition-colors",
                    s.key === opp.stageKey
                      ? "border-ink bg-ink text-paper"
                      : pendingStage === s.key
                        ? "border-[var(--accord-orange-deep)] text-[var(--accord-orange-deep)]"
                        : "border-hairline text-ink/60 hover:border-ink hover:text-ink",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {pendingStage ? (
              <div className="mt-4 border-t border-hairline pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {needsLoss || needsCancellation || needsWithdrawal ? (
                    <Field
                      label={
                        needsCancellation
                          ? "Cancellation reason"
                          : needsWithdrawal
                            ? "Withdrawal reason"
                            : "Loss reason"
                      }
                      required
                      hint={
                        needsWithdrawal
                          ? "A withdrawal is not a loss — it is reported separately."
                          : undefined
                      }
                    >
                      <select
                        className={INPUT}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      >
                        <option value="">Choose…</option>
                        {reasonOptions.map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}

                  {needsValue ? (
                    <Field
                      label="Final contracted value"
                      required
                      hint="The commission base and the closed-revenue figure."
                    >
                      <input
                        className={INPUT}
                        inputMode="decimal"
                        value={finalValue}
                        onChange={(e) => setFinalValue(e.target.value)}
                      />
                    </Field>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <Button
                    onClick={commitStage}
                    disabled={
                      busy ||
                      ((needsLoss || needsCancellation || needsWithdrawal) && !reason) ||
                      (needsValue && !finalValue)
                    }
                  >
                    Move to {target?.label}
                  </Button>
                  <Button variant="quiet" onClick={() => setPendingStage(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {error ? (
              <p
                role="alert"
                className={cn(TEXT.body, "mt-4 border-l-2 border-[var(--accord-orange-deep)] pl-3")}
              >
                {error}
              </p>
            ) : null}
          </Panel>

          <Panel title="Log activity">
            <form onSubmit={submitActivity} className="mt-3 space-y-4">
              <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <Field label="Type">
                  <select className={INPUT} name="type" defaultValue="call">
                    {ACTIVITY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="What happened">
                  <input className={INPUT} name="notes" autoComplete="off" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <Field label="Next action">
                  <input className={INPUT} name="nextAction" autoComplete="off" />
                </Field>
                <Field label="Due">
                  <input className={INPUT} name="due" type="date" />
                </Field>
              </div>
              <Button type="submit" disabled={busy}>
                Log
              </Button>
            </form>
          </Panel>

          <Panel title="Timeline">
            {data.timeline.length === 0 ? (
              <Empty>Nothing logged yet.</Empty>
            ) : (
              <ol className="divide-y divide-hairline">
                {data.timeline.map((a) => (
                  <li key={a.id} className="py-2.5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Pill>{a.type.replace("_", " ")}</Pill>
                      <span className={cn(TEXT.micro, "text-ink/55")}>
                        {new Date(a.occurredAt).toLocaleString(undefined, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {a.userName ? ` · ${a.userName}` : ""}
                      </span>
                    </div>
                    {a.notes ? <p className={cn(TEXT.body, "mt-1")}>{a.notes}</p> : null}
                    {a.metadata?.from ? (
                      <p className={cn(TEXT.micro, "mt-1 text-ink/55")}>
                        {a.metadata.from} → {a.metadata.to ?? "unassigned"}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-7">
          <Panel title="Detail">
            <dl className="divide-y divide-hairline">
              {[
                ["Owner", opp.ownerName ?? "Unassigned"],
                ["Source", opp.source],
                ["Edition", opp.editionName],
                ["Estimated", opp.estimatedValue ? money(opp.estimatedValue, opp.currency) : "—"],
                ["Final", opp.finalValue ? money(opp.finalValue, opp.currency) : "—"],
                ["Probability", `${opp.probability}%`],
                ["Next action", opp.nextAction ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className={cn(TEXT.micro, "text-ink/55")}>{k}</dt>
                  <dd className={cn(TEXT.micro, "text-right")}>{v}</dd>
                </div>
              ))}
            </dl>

            {data.canAssign ? (
              <div className="mt-4 border-t border-hairline pt-4">
                <Field label="Assign to">
                  <select
                    className={INPUT}
                    defaultValue={opp.ownerId ?? ""}
                    onChange={async (e) => {
                      setError(null);
                      try {
                        await setOwner({
                          data: { opportunityId: opp.id, ownerId: e.target.value || null },
                        });
                        await router.invalidate();
                      } catch (problem) {
                        setError(problem instanceof Error ? problem.message : "Could not assign.");
                      }
                    }}
                  >
                    <option value="">Unassigned</option>
                    {data.assignees.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : null}
          </Panel>

          {/* §13 — existence, owner, status. Never value, notes or commission. */}
          {data.otherWorkstreams.length > 0 ? (
            <Panel title="Other workstreams">
              <Table head={["Function", "Stage", "Owner"]}>
                {data.otherWorkstreams.map((w) => (
                  <Row key={w.id}>
                    <Cell>{w.function}</Cell>
                    <Cell>{w.stageKey}</Cell>
                    <Cell>{w.ownerId ? "Assigned" : "Unassigned"}</Cell>
                  </Row>
                ))}
              </Table>
              <p className={cn(TEXT.micro, "mt-3 text-ink/50")}>
                Shown so nobody contacts this person twice in the same week. Value, notes and
                commission on another workstream are not visible here.
              </p>
            </Panel>
          ) : null}
        </aside>
      </div>
    </Shell>
  );
}
