import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Shell } from "@/components/admin/Shell";
import {
  Button,
  Cell,
  Empty,
  INPUT,
  Label,
  Panel,
  Pill,
  Row,
  TEXT,
  Table,
} from "@/components/admin/primitives";
import {
  duplicateQueue,
  mergeTwoCompanies,
  mergeTwoPeople,
  search,
  undoMerge,
  undoableMerges,
} from "@/rpc/leads";
import { me } from "@/rpc/auth";

/**
 * DIRECTORY — §2 and §14.
 *
 * Search, plus the two things D6 and D7 require be reachable rather than
 * merely implemented: the review queue of name collisions the matcher was
 * never allowed to act on, and the un-merge for anything merged in the last
 * thirty days.
 */

export const Route = createFileRoute("/admin/directory")({
  head: () => ({
    meta: [{ title: "Directory — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const user = await me().catch(() => null);
    if (!user) throw redirect({ to: "/admin/login" });
    return { user };
  },
  loader: async ({ context }) => {
    const canMerge = context.user.role !== "team_member";
    const [queue, reversible] = await Promise.all([
      canMerge ? duplicateQueue() : Promise.resolve({ companies: [], people: [] }),
      canMerge ? undoableMerges() : Promise.resolve([]),
    ]);
    return { user: context.user, queue, reversible, canMerge };
  },
  component: DirectoryPage,
});

type Results = Awaited<ReturnType<typeof search>>;

function DirectoryPage() {
  const { user, queue, reversible, canMerge } = Route.useLoaderData();
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      setResults(await search({ data: { term } }));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Search failed.");
    }
  }

  async function merge(kind: "person" | "company", sourceId: string, targetId: string) {
    setError(null);
    try {
      if (kind === "person") await mergeTwoPeople({ data: { sourceId, targetId } });
      else await mergeTwoCompanies({ data: { sourceId, targetId } });
      await router.invalidate();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not merge.");
    }
  }

  return (
    <Shell
      role={user?.role}
      title="Directory"
      subtitle="People, companies, and the duplicates worth a second look."
    >
      <form onSubmit={runSearch} className="flex max-w-[36rem] items-end gap-3">
        <div className="min-w-0 flex-1">
          <Label>Search</Label>
          <input
            className={cn(INPUT, "mt-1.5")}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Name, company, email or phone"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {error ? (
        <p
          role="alert"
          className={cn(TEXT.body, "mt-4 border-l-2 border-[var(--accord-orange-deep)] pl-3")}
        >
          {error}
        </p>
      ) : null}

      {results ? (
        <div className="mt-7 grid gap-7 lg:grid-cols-2">
          <Panel title={`People (${results.people.length})`}>
            {results.people.length === 0 ? (
              <Empty>No people match.</Empty>
            ) : (
              <Table head={["Name", "Company", "Email"]}>
                {results.people.map((p) => (
                  <Row key={p.id}>
                    <Cell className="font-medium">{p.fullName}</Cell>
                    <Cell>{p.companyName ?? "—"}</Cell>
                    <Cell>{p.email ?? "—"}</Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Panel>

          <Panel title={`Companies (${results.companies.length})`}>
            {results.companies.length === 0 ? (
              <Empty>No companies match.</Empty>
            ) : (
              <Table head={["Name", "Country", "People"]}>
                {results.companies.map((c) => (
                  <Row key={c.id}>
                    <Cell className="font-medium">{c.name}</Cell>
                    <Cell>{c.country ?? "—"}</Cell>
                    <Cell numeric>{c.peopleCount}</Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Panel>

          <Panel title={`Workstreams (${results.opportunities.length})`}>
            {results.opportunities.length === 0 ? (
              <Empty>None you can see.</Empty>
            ) : (
              <Table head={["Who", "Function", "Stage", "Owner"]}>
                {results.opportunities.map((o) => (
                  <Row
                    key={o.id}
                    onClick={() => router.navigate({ to: `/admin/leads/${o.id}` as never })}
                  >
                    <Cell className="font-medium">{o.personName}</Cell>
                    <Cell>{o.function}</Cell>
                    <Cell>{o.stageKey}</Cell>
                    <Cell>{o.ownerName ?? "Unassigned"}</Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Panel>

          <Panel title={`Team (${results.users.length})`}>
            {results.users.length === 0 ? (
              <Empty>No team members match.</Empty>
            ) : (
              <Table head={["Name", "Role", "Email"]}>
                {results.users.map((u) => (
                  <Row key={u.id}>
                    <Cell className="font-medium">{u.fullName}</Cell>
                    {/* Absent by design: an Admin resolves a Super Admin's
                        name and nothing else. */}
                    <Cell>{u.role ?? <span className="text-ink/40">—</span>}</Cell>
                    <Cell>{u.email ?? <span className="text-ink/40">—</span>}</Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Panel>
        </div>
      ) : null}

      {canMerge ? (
        <div className="mt-9 grid gap-7 lg:grid-cols-2">
          <Panel title="Possible duplicates">
            {queue.companies.length === 0 && queue.people.length === 0 ? (
              <Empty>Nothing to review. No two records share a normalised name.</Empty>
            ) : (
              <>
                <p className={cn(TEXT.micro, "mt-3 text-ink/55")}>
                  A similar name is never enough to merge on its own, so these were created
                  separately and surfaced here. Merging is reversible for 30 days.
                </p>
                <ul className="mt-3 divide-y divide-hairline">
                  {queue.companies.map((group) => (
                    <li key={`c-${group.normalized_name}`} className="py-3">
                      <Label>Companies · {group.normalized_name}</Label>
                      <ul className="mt-2 space-y-1.5">
                        {group.records.map((r, i) => (
                          <li key={r.id} className="flex items-center justify-between gap-3">
                            <span className={TEXT.body}>{r.name}</span>
                            {i > 0 ? (
                              <Button
                                variant="secondary"
                                onClick={() => merge("company", r.id, group.records[0]!.id)}
                              >
                                Merge into {group.records[0]!.name}
                              </Button>
                            ) : (
                              <Pill tone="open">Keep</Pill>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                  {queue.people.map((group) => (
                    <li key={`p-${group.normalized_name}-${group.company_id}`} className="py-3">
                      <Label>People · {group.normalized_name}</Label>
                      <ul className="mt-2 space-y-1.5">
                        {group.records.map((r, i) => (
                          <li key={r.id} className="flex items-center justify-between gap-3">
                            <span className={TEXT.body}>{r.name}</span>
                            {i > 0 ? (
                              <Button
                                variant="secondary"
                                onClick={() => merge("person", r.id, group.records[0]!.id)}
                              >
                                Merge into the first
                              </Button>
                            ) : (
                              <Pill tone="open">Keep</Pill>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel title="Reversible merges">
            {reversible.length === 0 ? (
              <Empty>Nothing merged in the last 30 days.</Empty>
            ) : (
              <Table head={["What", "Merged", "Action"]}>
                {reversible.map((m) => (
                  <Row key={m.id}>
                    <Cell>{m.entityType}</Cell>
                    <Cell>
                      {new Date(m.performedAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </Cell>
                    <Cell>
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          setError(null);
                          try {
                            await undoMerge({ data: { mergeId: m.id } });
                            await router.invalidate();
                          } catch (problem) {
                            setError(
                              problem instanceof Error ? problem.message : "Could not undo that.",
                            );
                          }
                        }}
                      >
                        Undo
                      </Button>
                    </Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Panel>
        </div>
      ) : null}
    </Shell>
  );
}
