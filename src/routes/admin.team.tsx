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
} from "@/components/admin/primitives";
import {
  addUser,
  changeEventScopes,
  changeFunctions,
  changeRole,
  roster,
  scopeEvents,
} from "@/rpc/team";
import { setAccountActive } from "@/rpc/auth";

/**
 * TEAM — "who is working what?"
 *
 * Five things, in the order they are needed: create the person, say what they
 * are, say what work they do, say which events they may see, switch them off
 * when they leave. There is no profile, no hierarchy, no permission matrix.
 *
 * An Admin can read this screen because assigning work requires knowing who
 * exists. Every control that CHANGES anything is Super Admin only, and the
 * server refuses the rest regardless of what this file renders.
 */

const ROLES = ["super_admin", "admin", "team_member"] as const;
const FUNCTIONS = ["sponsor", "delegate", "speaker"] as const;

export const Route = createFileRoute("/admin/team")({
  head: () => ({
    meta: [{ title: "Team — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  loader: async () => {
    const [team, events] = await Promise.all([
      roster().catch(() => null),
      scopeEvents().catch(() => []),
    ]);
    if (!team) throw redirect({ to: "/admin/login" });
    return { people: team.rows, viewer: team.user, events };
  },
  component: TeamPage,
});

function TeamPage() {
  const { people, viewer, events } = Route.useLoaderData();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Readable by any manager; every mutation is Super Admin only. Hiding the
     controls is courtesy — the refusal is on the server. */
  const isSuper = viewer.role === "super_admin";

  const run = async (work: () => Promise<unknown>) => {
    setError(null);
    try {
      await work();
      await router.invalidate();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That change was refused.");
    }
  };

  return (
    <Shell
      role={viewer.role}
      title="Team"
      subtitle={`${people.length} ${people.length === 1 ? "person" : "people"}`}
      actions={
        isSuper ? (
          <Button onClick={() => setAdding((v) => !v)}>{adding ? "Cancel" : "+ Add person"}</Button>
        ) : null
      }
    >
      {error ? (
        <p className={cn(TEXT.micro, "mb-3 text-[var(--accord-orange-deep)]")}>{error}</p>
      ) : null}

      {adding ? (
        <NewPersonForm
          events={events}
          onDone={async () => {
            setAdding(false);
            await router.invalidate();
          }}
          onError={setError}
        />
      ) : null}

      <Panel title="Who is working what">
        {people.length === 0 ? (
          <Empty>Nobody yet.</Empty>
        ) : (
          <Table head={["Name", "Email", "Role", "Work", "Events", "Status", ""]}>
            {people.map((p) => (
              <Row key={p.id}>
                <Cell className="font-medium">{p.fullName}</Cell>
                <Cell>{p.email}</Cell>
                <Cell>{p.role.replace("_", " ")}</Cell>
                <Cell>{p.functions.length ? p.functions.join(", ") : "—"}</Cell>
                <Cell>
                  {p.role === "super_admin"
                    ? "all"
                    : p.eventIds.length
                      ? String(p.eventIds.length)
                      : "none"}
                </Cell>
                <Cell>
                  <Pill tone={p.status === "active" ? "won" : "attention"}>{p.status}</Pill>
                </Cell>
                <Cell>
                  {isSuper ? (
                    <Button
                      variant="quiet"
                      onClick={() => setEditing(editing === p.id ? null : p.id)}
                    >
                      {editing === p.id ? "Close" : "Edit"}
                    </Button>
                  ) : null}
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Panel>

      {editing && isSuper ? (
        <EditPerson
          person={people.find((p) => p.id === editing)!}
          events={events}
          onRole={(role) => run(() => changeRole({ data: { userId: editing, role } }))}
          onFunctions={(functions) =>
            run(() => changeFunctions({ data: { userId: editing, functions } }))
          }
          onScopes={(eventIds) =>
            run(() => changeEventScopes({ data: { userId: editing, eventIds } }))
          }
          onActive={(active) => run(() => setAccountActive({ data: { userId: editing, active } }))}
        />
      ) : null}

      <p className={cn(TEXT.micro, "mt-4 text-ink/45")}>
        Creating people and changing roles, work or event access is Super Admin only. The server
        refuses everyone else, whatever this screen offers.
      </p>
    </Shell>
  );
}

function NewPersonForm({
  events,
  onDone,
  onError,
}: {
  events: { id: string; name: string }[];
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("team_member");
  const [functions, setFunctions] = useState<string[]>([]);
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  return (
    <form
      className="mb-6 grid gap-3 border border-hairline p-4 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await addUser({
            data: {
              email,
              fullName,
              password,
              role,
              functions: functions as ("sponsor" | "delegate" | "speaker")[],
              eventIds,
            },
          });
          onDone();
        } catch (problem) {
          onError(problem instanceof Error ? problem.message : "Could not create that account.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Full name">
        <input
          className={INPUT}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </Field>
      <Field label="Email">
        <input
          className={INPUT}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>
      <Field label="First password" hint="At least 12 characters. They can change it later.">
        <input
          className={INPUT}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={12}
          required
        />
      </Field>
      <Field label="Role">
        <select
          className={INPUT}
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Work">
        <div className="flex flex-wrap gap-1 pt-1">
          {FUNCTIONS.map((f) => (
            <Toggle
              key={f}
              on={functions.includes(f)}
              onClick={() => setFunctions(toggle(functions, f))}
            >
              {f}
            </Toggle>
          ))}
        </div>
      </Field>
      <Field label="Events they may see">
        <div className="flex flex-wrap gap-1 pt-1">
          {events.map((ev) => (
            <Toggle
              key={ev.id}
              on={eventIds.includes(ev.id)}
              onClick={() => setEventIds(toggle(eventIds, ev.id))}
            >
              {ev.name}
            </Toggle>
          ))}
        </div>
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </div>
    </form>
  );
}

function EditPerson({
  person,
  events,
  onRole,
  onFunctions,
  onScopes,
  onActive,
}: {
  person: {
    id: string;
    fullName: string;
    role: string;
    status: string;
    functions: string[];
    eventIds: string[];
  };
  events: { id: string; name: string }[];
  onRole: (r: (typeof ROLES)[number]) => void;
  onFunctions: (f: ("sponsor" | "delegate" | "speaker")[]) => void;
  onScopes: (e: string[]) => void;
  onActive: (a: boolean) => void;
}) {
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  return (
    <div className="mt-5 border border-hairline p-4">
      <h3 className={cn(TEXT.heading, "mb-3 text-ink")}>{person.fullName}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Role">
          <select
            className={INPUT}
            value={person.role}
            onChange={(e) => onRole(e.target.value as (typeof ROLES)[number])}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Work">
          <div className="flex flex-wrap gap-1 pt-1">
            {FUNCTIONS.map((f) => (
              <Toggle
                key={f}
                on={person.functions.includes(f)}
                onClick={() =>
                  onFunctions(toggle(person.functions, f) as ("sponsor" | "delegate" | "speaker")[])
                }
              >
                {f}
              </Toggle>
            ))}
          </div>
        </Field>
        <Field label="Events">
          <div className="flex flex-wrap gap-1 pt-1">
            {events.map((ev) => (
              <Toggle
                key={ev.id}
                on={person.eventIds.includes(ev.id)}
                onClick={() => onScopes(toggle(person.eventIds, ev.id))}
              >
                {ev.name}
              </Toggle>
            ))}
          </div>
        </Field>
        <Field label="Access">
          <Button variant="secondary" onClick={() => onActive(person.status !== "active")}>
            {person.status === "active" ? "Deactivate" : "Reactivate"}
          </Button>
        </Field>
      </div>
    </div>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2 py-1 font-mono text-[12px] uppercase tracking-[0.08em] transition-colors",
        on ? "bg-ink text-bone" : "border border-hairline text-ink/55 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
