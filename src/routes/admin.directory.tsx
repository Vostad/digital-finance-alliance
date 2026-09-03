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
    meta: [{ title: "Duplicates — Financial Rails OS" }, { name: "robots", content: "noindex" }],
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

function DirectoryPage() {
  const { user, queue, reversible, canMerge } = Route.useLoaderData();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

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
      title="Duplicates"
      subtitle="The same person or company, entered twice — and the merges you can undo."
    >
      {error ? (
        <p
          role="alert"
          className={cn(TEXT.body, "mt-4 border-l-2 border-[var(--accord-orange-deep)] pl-3")}
        >
          {error}
        </p>
      ) : null}

      <div className="mt-2 grid gap-7 lg:grid-cols-2">
        <Panel title="Possible duplicates">
          {queue.companies.length === 0 && queue.people.length === 0 ? (
            <Empty>Nothing to review. No two records share a normalised name.</Empty>
          ) : (
            <>
              <p className={cn(TEXT.micro, "mt-3 text-ink/55")}>
                A similar name is never enough to merge on its own, so these were created separately
                and surfaced here. Merging is reversible for 30 days.
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
    </Shell>
  );
}
