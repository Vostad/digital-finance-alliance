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
  Panel,
  Pill,
  Row,
  TEXT,
  Table,
  money,
} from "@/components/admin/primitives";
import { overview } from "@/rpc/events";
import { createTarget, targetOptions, targets } from "@/rpc/targets";

/**
 * EVENTS — "how is this event performing?"
 *
 * Targets live here rather than in their own destination. A target is a
 * property of an event and a person, and asking someone to hold an event in
 * their head while they navigate to a separate Targets screen was a step that
 * existed only because the data model had two tables.
 *
 * Money on this screen is sponsor money and says so. Delegate and speaker
 * numbers are counts, because that is what those workstreams are measured in.
 */

export const Route = createFileRoute("/admin/events")({
  head: () => ({
    meta: [{ title: "Events — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  loader: async () => {
    const data = await overview().catch(() => null);
    if (!data) throw redirect({ to: "/admin/login" });

    /* Targets ride along: the screen is about an event's performance, and a
       target with no progress beside it is just a number. */
    const [progress, options] = await Promise.all([
      targets({ data: {} }).catch(() => []),
      data.user.role === "super_admin"
        ? targetOptions().catch(() => ({ users: [] }))
        : Promise.resolve({ users: [] as { id: string; fullName: string; role: string }[] }),
    ]);
    return { ...data, progress, options };
  },
  component: EventsPage,
});

function EventsPage() {
  const { rows, user, progress, options } = Route.useLoaderData();
  const router = useRouter();
  const isSuper = user.role === "super_admin";
  const [openFor, setOpenFor] = useState<string | null>(null);

  return (
    <Shell
      role={user.role}
      title="Events"
      subtitle={
        rows.length === 0
          ? "No events in your scope"
          : `${rows.length} edition${rows.length === 1 ? "" : "s"}`
      }
    >
      {rows.length === 0 ? (
        <Empty>
          Nothing in your scope. A Super Admin grants access to an event from the Team screen.
        </Empty>
      ) : (
        <Table
          head={["Edition", "Event", "Status", "Leads", "Unassigned", "Won", "Pipeline", "Revenue"]}
        >
          {rows.map((e) => (
            <Row key={e.editionId}>
              <Cell className="font-medium">{e.editionName}</Cell>
              <Cell>{e.eventName}</Cell>
              <Cell>
                <Pill tone={e.status === "active" ? "won" : "open"}>{e.status}</Pill>
              </Cell>
              <Cell numeric>{e.leads}</Cell>
              <Cell numeric>
                {e.unassigned > 0 ? (
                  <span className="text-[var(--accord-orange-deep)]">{e.unassigned}</span>
                ) : (
                  e.unassigned
                )}
              </Cell>
              <Cell numeric>{e.won}</Cell>
              <Cell numeric>{money(e.pipeline, e.currency)}</Cell>
              <Cell numeric>{money(e.revenue, e.currency)}</Cell>
            </Row>
          ))}
        </Table>
      )}

      <p className={cn(TEXT.micro, "mt-2 text-ink/45")}>
        Pipeline and revenue are sponsor figures. Delegate and speaker work is counted, not summed.
      </p>

      <div className="mt-7">
        <Panel
          title="Targets"
          action={
            isSuper ? (
              <Button variant="quiet" onClick={() => setOpenFor(openFor ? null : "new")}>
                {openFor ? "Cancel" : "+ Set a target"}
              </Button>
            ) : null
          }
        >
          {openFor && isSuper ? (
            <TargetForm
              users={options.users}
              editions={rows.map((r) => ({ id: r.editionId, name: r.editionName }))}
              onDone={async () => {
                setOpenFor(null);
                await router.invalidate();
              }}
            />
          ) : null}

          {progress.length === 0 ? (
            <Empty>No targets set for the events you can see.</Empty>
          ) : (
            <Table head={["Person", "Work", "Edition", "Target", "Achieved", "Progress"]}>
              {progress.map((t) => (
                <Row key={t.id}>
                  <Cell className="font-medium">{t.userName}</Cell>
                  <Cell>{t.function}</Cell>
                  <Cell>{t.editionName ?? "—"}</Cell>
                  <Cell numeric>
                    {t.metric === "revenue" ? money(t.target, t.currency ?? "USD") : t.target}
                  </Cell>
                  <Cell numeric>
                    {t.metric === "revenue" ? money(t.achieved, t.currency ?? "USD") : t.achieved}
                  </Cell>
                  <Cell numeric>
                    {t.progressPct === null ? "—" : `${Math.round(t.progressPct)}%`}
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

function TargetForm({
  users,
  editions,
  onDone,
}: {
  users: { id: string; fullName: string }[];
  editions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [fn, setFn] = useState<"sponsor" | "delegate" | "speaker">("sponsor");
  const [editionId, setEditionId] = useState(editions[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const year = new Date().getFullYear();

  return (
    <form
      className="grid gap-3 border-b border-hairline py-4 sm:grid-cols-2 lg:grid-cols-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await createTarget({
            data: {
              userId,
              function: fn,
              editionId: editionId || null,
              targetValue: value,
              periodStart: `${year}-01-01`,
              periodEnd: `${year}-12-31`,
              currency: fn === "sponsor" ? "USD" : null,
            },
          });
          onDone();
        } catch (problem) {
          setError(problem instanceof Error ? problem.message : "Could not set that target.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Person">
        <select
          className={INPUT}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        >
          <option value="">Choose…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Work">
        <select className={INPUT} value={fn} onChange={(e) => setFn(e.target.value as typeof fn)}>
          <option value="sponsor">sponsor</option>
          <option value="delegate">delegate</option>
          <option value="speaker">speaker</option>
        </select>
      </Field>
      <Field label="Edition">
        <select className={INPUT} value={editionId} onChange={(e) => setEditionId(e.target.value)}>
          {editions.map((ed) => (
            <option key={ed.id} value={ed.id}>
              {ed.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={fn === "sponsor" ? "Target (USD)" : "Target (count)"}>
        <input
          className={INPUT}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          required
        />
      </Field>
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={busy || !userId || !value}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
      {error ? (
        <p
          className={cn(TEXT.micro, "text-[var(--accord-orange-deep)] sm:col-span-2 lg:col-span-5")}
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
