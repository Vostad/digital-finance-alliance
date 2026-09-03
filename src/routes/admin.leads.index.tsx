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
  Pill,
  Row,
  TEXT,
  Table,
  money,
} from "@/components/admin/primitives";
import { board, listWorkstreams } from "@/rpc/leads";
import { exportData } from "@/rpc/governance";

/**
 * LEADS — the screen the day is spent on.
 *
 * Website submissions and manually created leads are the same rows here. There
 * is no separate "website leads" product, because the moment a lead arrives the
 * question is identical whatever door it came through: who owns it, what stage
 * is it at, when is it next being touched.
 *
 * TWO VIEWS OF ONE SET. The list is for scanning and searching; the pipeline is
 * for seeing where the sponsor money sits, stage by stage. They are the same
 * rows, the same scope, the same authorization — a `view` in the URL, not a
 * second product. Every stage, probability and ownership rule is the existing
 * one; nothing here computes a number the server did not.
 *
 * The pipeline is SPONSOR-CONTEXT ONLY. Delegate and speaker workstreams are
 * counted, never priced, and forcing them into a sponsor's stage ladder would
 * invent a model the business does not have. So the board shows sponsor work,
 * and the toggle is offered only to someone who has sponsor work to see.
 */

type Search = {
  view?: "pipeline" | undefined;
  function?: string | undefined;
  unassigned?: string | undefined;
  q?: string | undefined;
  page?: string | undefined;
};

export const Route = createFileRoute("/admin/leads/")({
  head: () => ({
    meta: [{ title: "Leads — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    view: search["view"] === "pipeline" ? "pipeline" : undefined,
    function: typeof search["function"] === "string" ? search["function"] : undefined,
    unassigned: search["unassigned"] === "1" ? "1" : undefined,
    q: typeof search["q"] === "string" && search["q"].trim() ? search["q"].trim() : undefined,
    page: typeof search["page"] === "string" ? search["page"] : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (deps.view === "pipeline") {
      /* Sponsor-context only. The same search and unassigned filters apply; the
         function filter does not, because the board IS the sponsor function. */
      const data = await board({
        data: {
          function: "sponsor",
          filters: {
            search: deps.q ?? null,
            unassignedOnly: deps.unassigned === "1",
          },
        },
      }).catch(() => null);
      if (!data) throw redirect({ to: "/admin/login" });
      return { view: "pipeline" as const, ...data };
    }

    const page = Math.max(0, Number(deps.page ?? "0") || 0);
    const data = await listWorkstreams({
      data: {
        function: (deps.function as "sponsor" | "delegate" | "speaker" | undefined) ?? null,
        unassignedOnly: deps.unassigned === "1",
        search: deps.q ?? null,
        page,
        pageSize: 50,
      },
    }).catch(() => null);
    if (!data) throw redirect({ to: "/admin/login" });
    return { view: "list" as const, ...data };
  },
  component: LeadsPage,
});

const FUNCTIONS = ["sponsor", "delegate", "speaker"] as const;

function LeadsPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const router = useRouter();
  const [term, setTerm] = useState(search.q ?? "");
  const [exporting, setExporting] = useState(false);

  const { user } = data;
  const isMember = user.role === "team_member";
  const isSuper = user.role === "super_admin";
  /* Sponsor pipeline is only meaningful to someone who works sponsor. A
     manager always does; a member does when it was granted to them. */
  const canPipeline = !isMember || user.functions.includes("sponsor");

  const go = (next: Partial<Search>) =>
    router.navigate({
      to: "/admin/leads",
      search: { ...search, page: undefined, ...next } as never,
    });

  const runExport = async () => {
    setExporting(true);
    try {
      const result = await exportData({ data: { kind: "opportunities" } });
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const subtitle =
    data.view === "pipeline"
      ? `${data.cards.length} sponsor workstream${data.cards.length === 1 ? "" : "s"}`
      : data.rows.length === 0
        ? "Nothing matches"
        : `${data.rows.length} shown${data.hasMore ? " · more available" : ""}`;

  return (
    <Shell
      role={user.role}
      title={isMember ? "My leads" : "Leads"}
      subtitle={subtitle}
      actions={
        <>
          {canPipeline ? (
            <div className="flex items-center border border-hairline">
              <ViewTab active={data.view === "list"} onClick={() => go({ view: undefined })}>
                List
              </ViewTab>
              <ViewTab
                active={data.view === "pipeline"}
                onClick={() => go({ view: "pipeline", function: undefined })}
              >
                Pipeline
              </ViewTab>
            </div>
          ) : null}
          {isSuper ? (
            <Button variant="quiet" onClick={runExport} disabled={exporting}>
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          ) : null}
          <Button onClick={() => router.navigate({ to: "/admin/leads/new" })}>+ Add lead</Button>
        </>
      }
    >
      {/* Search applies to both views. The function filter is a list-only
          control — the pipeline is already the sponsor function. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline pb-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: term.trim() || undefined });
          }}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search name or company"
            aria-label="Search leads"
            className={cn(INPUT, "min-w-0 flex-1 sm:max-w-xs")}
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-1">
          {data.view === "list" ? (
            <>
              <FilterChip active={!search.function} onClick={() => go({ function: undefined })}>
                All work
              </FilterChip>
              {FUNCTIONS.filter((f) => !isMember || user.functions.includes(f)).map((f) => (
                <FilterChip
                  key={f}
                  active={search.function === f}
                  onClick={() => go({ function: f })}
                >
                  {f}
                </FilterChip>
              ))}
            </>
          ) : (
            <span className={cn(TEXT.micro, "px-1 text-ink/45")}>Sponsor pipeline</span>
          )}
          <FilterChip
            active={search.unassigned === "1"}
            onClick={() => go({ unassigned: search.unassigned === "1" ? undefined : "1" })}
          >
            Unassigned
          </FilterChip>
        </div>
      </div>

      {data.view === "pipeline" ? (
        <PipelineBoard
          columns={data.columns}
          cards={data.cards}
          onOpen={(id) => router.navigate({ to: `/admin/leads/${id}` as never })}
        />
      ) : (
        <ListView
          rows={data.rows}
          page={data.page}
          hasMore={data.hasMore}
          search={search}
          onOpen={(id) => router.navigate({ to: `/admin/leads/${id}` as never })}
          onPage={(p) =>
            router.navigate({ to: "/admin/leads", search: { ...search, page: String(p) } as never })
          }
        />
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ list */

function ListView({
  rows,
  page,
  hasMore,
  search,
  onOpen,
  onPage,
}: {
  rows: Awaited<ReturnType<typeof listWorkstreams>>["rows"];
  page: number;
  hasMore: boolean;
  search: Search;
  onOpen: (id: string) => void;
  onPage: (page: number) => void;
}) {
  void search;
  if (rows.length === 0) {
    return <Empty>Nothing here yet. Add a lead, or wait for the website to send one.</Empty>;
  }
  return (
    <>
      <Table
        head={[
          "Name",
          "Company",
          "Email",
          "Phone",
          "Event",
          "Work",
          "Source",
          "Status",
          "Owner",
          "Created",
          "Follow-up",
          "Value",
        ]}
      >
        {rows.map((r) => (
          <Row key={r.id} onClick={() => onOpen(r.id)}>
            <Cell className="font-medium">{r.personName}</Cell>
            <Cell>{r.companyName ?? "—"}</Cell>
            <Cell>{r.email ?? "—"}</Cell>
            <Cell>{r.phone ?? "—"}</Cell>
            <Cell>{r.editionName}</Cell>
            <Cell>{r.function}</Cell>
            <Cell>{r.source}</Cell>
            <Cell>
              <Pill tone={r.finalValue ? "won" : "open"}>{r.stageKey}</Pill>
            </Cell>
            <Cell>{r.ownerName ?? <Pill tone="attention">Unassigned</Pill>}</Cell>
            <Cell>{shortDate(r.createdAt)}</Cell>
            <Cell>
              {r.nextActionDueAt ? (
                <span
                  className={cn(
                    new Date(r.nextActionDueAt) < new Date() && "text-[var(--accord-orange-deep)]",
                  )}
                >
                  {shortDate(r.nextActionDueAt)}
                </span>
              ) : (
                "—"
              )}
            </Cell>
            <Cell numeric>
              {r.finalValue || r.estimatedValue
                ? money(r.finalValue ?? r.estimatedValue, r.currency)
                : "—"}
            </Cell>
          </Row>
        ))}
      </Table>

      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between gap-3 pt-4">
          <Button variant="quiet" disabled={page === 0} onClick={() => onPage(page - 1)}>
            ← Previous
          </Button>
          <span className={cn(TEXT.micro, "text-ink/50")}>Page {page + 1}</span>
          <Button variant="quiet" disabled={!hasMore} onClick={() => onPage(page + 1)}>
            Next →
          </Button>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------- pipeline */

function PipelineBoard({
  columns,
  cards,
  onOpen,
}: {
  columns: Awaited<ReturnType<typeof board>>["columns"];
  cards: Awaited<ReturnType<typeof board>>["cards"];
  onOpen: (id: string) => void;
}) {
  if (cards.length === 0) {
    return <Empty>No sponsor workstreams here yet. Add a lead to start one.</Empty>;
  }
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
      <div className="flex min-w-max gap-3 pt-4">
        {columns.map((col) => {
          const colCards = cards.filter((c) => c.stageKey === col.key);
          return (
            <section
              key={col.key}
              className="flex w-[15.5rem] shrink-0 flex-col border border-hairline bg-paper"
            >
              <header className="border-b border-hairline px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label>{col.label}</Label>
                  <span className={cn(TEXT.micro, "tabular-nums text-ink/55")}>{col.count}</span>
                </div>
                {col.totalValue !== null ? (
                  <p className={cn(TEXT.micro, "mt-1 tabular-nums text-ink/60")}>
                    {money(col.totalValue)}
                    {col.isOpen && col.weightedValue ? (
                      <span className="text-ink/40"> · {money(col.weightedValue)} weighted</span>
                    ) : null}
                  </p>
                ) : null}
              </header>

              <div className="flex-1 space-y-px bg-hairline/40">
                {colCards.length === 0 ? (
                  <p className={cn(TEXT.micro, "bg-paper px-3 py-4 text-ink/35")}>—</p>
                ) : (
                  colCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => onOpen(card.id)}
                      className="block w-full bg-paper px-3 py-2.5 text-left transition-colors hover:bg-ink/[0.035]"
                    >
                      <span className={cn(TEXT.strong, "block truncate")}>{card.personName}</span>
                      <span className={cn(TEXT.micro, "block truncate text-ink/55")}>
                        {card.companyName ?? "—"}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {card.priority === "high" ? <Pill tone="attention">High</Pill> : null}
                        {card.estimatedValue ? (
                          <span className={cn(TEXT.micro, "tabular-nums text-ink/70")}>
                            {money(card.finalValue ?? card.estimatedValue, card.currency)}
                          </span>
                        ) : null}
                        {card.ownerName ? null : <Pill tone="attention">Unassigned</Pill>}
                      </span>
                      {card.nextActionDueAt ? (
                        <span className={cn(TEXT.micro, "mt-1 block text-ink/50")}>
                          {card.nextAction} · {shortDate(card.nextActionDueAt)}
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- chrome */

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 font-mono text-[13px] uppercase tracking-[0.1em] transition-colors",
        active ? "bg-ink text-paper" : "text-ink/55 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1.5 font-mono text-[12px] uppercase tracking-[0.09em] transition-colors",
        active ? "bg-ink text-bone" : "text-ink/55 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function shortDate(value: Date | string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
