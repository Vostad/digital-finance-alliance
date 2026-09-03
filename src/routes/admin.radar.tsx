import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";
import { Shell } from "@/components/admin/Shell";
import {
  Button,
  Cell,
  Empty,
  INPUT,
  Panel,
  Pill,
  Row,
  Stat,
  StatRow,
  TEXT,
  Table,
} from "@/components/admin/primitives";
import {
  CorridorEventForm,
  CorridorForm,
  LicenceForm,
  ProviderForm,
  RailForm,
  RouteForm,
  type CorridorRow,
  type ProviderRow,
  type RailRow,
  type RouteRow,
} from "@/components/admin/RadarForms";
import {
  adminCorridors,
  adminProviders,
  adminRails,
  adminRoutes,
  decideSubmission,
  radarAdminOverview,
  removeLicence,
  submissionQueue,
} from "@/rpc/radar-admin";

/**
 * RAILS RADAR — THE ADMIN SURFACE.
 *
 * Authenticated, and not by this file. Every RPC it calls resolves identity on
 * the server and refuses a non-editor there, so the redirect below is courtesy
 * for a signed-out visitor rather than the control.
 *
 * EVERY MUTATION ON THE RADAR SERVER HAS A PATH FROM THIS SCREEN. That is not
 * a coincidence and it is now checked: `saveRoute` shipped once with no screen
 * at all, and every upsert shipped able to create but never to edit — which
 * quietly made the re-verification queue decorative, because re-verifying a
 * record IS an edit. `src/server/test/admin-reachability.test.ts` fails if a
 * server mutation ever loses its UI path again.
 *
 * Reviewing a submission still cannot write to a live field. Accept marks a
 * claim worth acting on; an editor then opens the source and edits the record.
 * There is no "apply this submission" button and there must not be.
 */
export const Route = createFileRoute("/admin/radar")({
  head: () => ({
    meta: [{ title: "Rails Radar — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  loader: async () => {
    const overview = await radarAdminOverview().catch(() => null);
    if (!overview) throw redirect({ to: "/admin/login" });
    const [queue, corridors, rails, providers] = await Promise.all([
      submissionQueue({ data: {} }).catch(() => []),
      adminCorridors().catch(() => []),
      adminRails().catch(() => []),
      adminProviders().catch(() => []),
    ]);
    return { ...overview, queue, corridors, rails, providers };
  },
  component: RadarAdmin,
});

type Tab = "queue" | "stale" | "corridors" | "rails" | "providers";

/** Derived from the RPCs rather than from `Route.useLoaderData`, which resolves
    to `any` here and takes every child prop down with it. */
type Overview = Awaited<ReturnType<typeof radarAdminOverview>>;
type Data = {
  counts: Overview["counts"];
  stale: Overview["stale"];
  queue: Awaited<ReturnType<typeof submissionQueue>>;
  corridors: Awaited<ReturnType<typeof adminCorridors>>;
  rails: Awaited<ReturnType<typeof adminRails>>;
  providers: Awaited<ReturnType<typeof adminProviders>>;
};

function RadarAdmin() {
  const data = Route.useLoaderData() as Data;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("queue");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    await router.invalidate();
  }, [router]);

  const run = async (work: () => Promise<unknown>) => {
    setError(null);
    try {
      await work();
      await refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That change was refused.");
    }
  };

  const staleTotal =
    data.stale.rails.length + data.stale.providers.length + data.stale.routes.length;

  return (
    <Shell title="Rails Radar" subtitle="Structural intelligence — verified per record">
      <StatRow>
        <Stat label="Corridors" value={data.counts.corridors} />
        <Stat label="Rails" value={data.counts.rails} />
        <Stat label="Providers" value={data.counts.providers} />
        <Stat label="Routes" value={data.counts.routes} />
        <Stat
          label="Pending"
          value={data.counts.pending}
          tone={data.counts.pending > 0 ? "urgent" : "default"}
          hint="Unverified claims. Never rendered publicly."
        />
      </StatRow>

      {error ? (
        <p className={cn(TEXT.micro, "mt-4 text-[var(--accord-orange-deep)]")}>{error}</p>
      ) : null}

      <nav className="mt-6 flex flex-wrap gap-1 border-b border-hairline">
        {(
          [
            ["queue", `Queue (${data.queue.length})`],
            ["stale", `Re-verify (${staleTotal})`],
            ["corridors", "Corridors"],
            ["rails", "Rails"],
            ["providers", "Providers"],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              TEXT.label,
              "border-b-2 px-3 py-2 transition-colors",
              tab === id
                ? "border-[var(--accord-orange-deep)] text-ink"
                : "border-transparent text-ink/50 hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {tab === "queue" ? <Queue rows={data.queue} run={run} /> : null}
        {tab === "stale" ? <Stale stale={data.stale} onGo={setTab} /> : null}
        {tab === "corridors" ? (
          <Corridors
            rows={data.corridors}
            providers={data.providers}
            rails={data.rails}
            refresh={refresh}
          />
        ) : null}
        {tab === "rails" ? <Rails rows={data.rails} refresh={refresh} /> : null}
        {tab === "providers" ? (
          <Providers rows={data.providers} refresh={refresh} run={run} />
        ) : null}
      </div>
    </Shell>
  );
}

/* ----------------------------------------------------------------- queue -- */

function Queue({
  rows,
  run,
}: {
  rows: Data["queue"];
  run: (w: () => Promise<unknown>) => Promise<void>;
}) {
  const [note, setNote] = useState<Record<string, string>>({});

  return (
    <Panel title="Submission queue">
      <p className={cn(TEXT.micro, "mt-3 mb-4 max-w-2xl text-ink/55")}>
        Unverified claims from the public forms. Nothing here renders on the site. Accepting a
        submission records that it is worth acting on — it does not publish anything. Open the
        source, confirm it, then edit the record yourself.
      </p>
      {rows.length === 0 ? (
        <Empty>Nothing pending.</Empty>
      ) : (
        <Table head={["Received", "Kind", "About", "Claimed source", "From", ""]}>
          {rows.map((r) => (
            <Row key={r.id}>
              <Cell>{new Date(r.createdAt).toLocaleDateString("en-GB")}</Cell>
              <Cell>
                <Pill tone={r.kind === "inaccuracy" ? "attention" : "neutral"}>{r.kind}</Pill>
              </Cell>
              <Cell>
                <span className={TEXT.body}>{r.subjectNote ?? "—"}</span>
                {r.corridorSlug ? (
                  <span className={cn(TEXT.micro, "block text-ink/45")}>
                    corridor: {r.corridorSlug}
                  </span>
                ) : null}
                {r.providerName ? (
                  <span className={cn(TEXT.micro, "block text-ink/45")}>
                    provider: {r.providerName}
                  </span>
                ) : null}
                {r.message ? (
                  <span className={cn(TEXT.micro, "mt-1 block text-ink/60")}>{r.message}</span>
                ) : null}
              </Cell>
              <Cell>
                {r.claimedSourceUrl ? (
                  <a
                    href={r.claimedSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="underline underline-offset-2"
                  >
                    Open
                  </a>
                ) : (
                  "—"
                )}
              </Cell>
              <Cell>
                <span className={cn(TEXT.micro, "text-ink/60")}>{r.submitterEmail}</span>
              </Cell>
              <Cell>
                <input
                  className={cn(INPUT, "mb-2 w-40")}
                  placeholder="Review note"
                  value={note[r.id] ?? ""}
                  onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      run(() =>
                        decideSubmission({
                          data: { id: r.id, status: "accepted", note: note[r.id] ?? null },
                        }),
                      )
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      run(() =>
                        decideSubmission({
                          data: { id: r.id, status: "rejected", note: note[r.id] ?? null },
                        }),
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              </Cell>
            </Row>
          ))}
        </Table>
      )}
    </Panel>
  );
}

/* ----------------------------------------------------------------- stale -- */

function Stale({ stale, onGo }: { stale: Data["stale"]; onGo: (t: Tab) => void }) {
  const rows = [
    ...stale.rails.map((r) => ({ kind: "Rail" as const, name: r.name, at: r.lastVerifiedAt })),
    ...stale.providers.map((r) => ({
      kind: "Provider" as const,
      name: r.name,
      at: r.lastVerifiedAt,
    })),
    ...stale.routes.map((r) => ({
      kind: "Route" as const,
      name: `${r.railName} via ${r.providerName} — ${r.corridorSlug}`,
      at: r.lastVerifiedAt,
    })),
  ];
  const tabFor = { Rail: "rails", Provider: "providers", Route: "corridors" } as const;

  return (
    <Panel title={`Re-verification — unchecked for ${stale.afterDays} days or more`}>
      <p className={cn(TEXT.micro, "mt-3 mb-4 max-w-2xl text-ink/55")}>
        Published records surface here once they go stale. Re-verifying one means opening its
        source, confirming it still says what we recorded, and saving with today's date — which is
        an edit, so it happens on the record's own tab.
      </p>
      {rows.length === 0 ? (
        <Empty>Nothing is overdue.</Empty>
      ) : (
        <Table head={["Type", "Record", "Last verified", ""]}>
          {rows.map((r, i) => (
            <Row key={i}>
              <Cell>
                <Pill>{r.kind}</Pill>
              </Cell>
              <Cell>{r.name}</Cell>
              <Cell>
                {r.at ? (
                  new Date(r.at).toLocaleDateString("en-GB")
                ) : (
                  <span className="text-[var(--accord-orange-deep)]">Never</span>
                )}
              </Cell>
              <Cell>
                <Button variant="quiet" onClick={() => onGo(tabFor[r.kind])}>
                  Go to {tabFor[r.kind]}
                </Button>
              </Cell>
            </Row>
          ))}
        </Table>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------- corridors -- */

function Corridors({
  rows,
  providers,
  rails,
  refresh,
}: {
  rows: Data["corridors"];
  providers: Data["providers"];
  rails: Data["rails"];
  refresh: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const open = rows.find((c) => c.id === openId);

  return (
    <Panel
      title="Corridors"
      action={
        <Button
          variant="secondary"
          onClick={() => {
            setCreating((v) => !v);
            setEditing(null);
          }}
        >
          {creating ? "Cancel" : "New corridor"}
        </Button>
      }
    >
      {creating ? (
        <CorridorForm
          onCancel={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await refresh();
          }}
        />
      ) : null}

      {rows.length === 0 ? (
        <Empty>No corridors yet.</Empty>
      ) : (
        <Table head={["Corridor", "Currencies", "Routes", "Status", "Last verified", ""]}>
          {rows.map((c) => (
            <Row key={c.id}>
              <Cell>
                <a href={`/radar/corridors/${c.slug}`} className="underline underline-offset-2">
                  {c.originCountry} → {c.destinationCountry}
                </a>
              </Cell>
              <Cell>
                {c.originCurrency} → {c.destinationCurrency}
              </Cell>
              <Cell>{c.routeCount}</Cell>
              <Cell>
                <Pill tone={c.status === "published" ? "open" : "neutral"}>{c.status}</Pill>
              </Cell>
              <Cell>
                {c.lastVerifiedAt ? new Date(c.lastVerifiedAt).toLocaleDateString("en-GB") : "—"}
              </Cell>
              <Cell>
                <div className="flex gap-2">
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setEditing(editing === c.id ? null : c.id);
                      setCreating(false);
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="quiet" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                    {openId === c.id ? "Close" : "Routes"}
                  </Button>
                </div>
              </Cell>
            </Row>
          ))}
        </Table>
      )}

      {editing ? (
        <div className="mt-6">
          <CorridorForm
            initial={rows.find((c) => c.id === editing) as CorridorRow}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              await refresh();
            }}
          />
        </div>
      ) : null}

      {open ? (
        <CorridorDetail
          corridor={open}
          providers={providers}
          rails={rails}
          refresh={refresh}
          key={open.id}
        />
      ) : null}
    </Panel>
  );
}

/** Routes and structural history for one corridor. Loaded on demand — the
    overview does not need every route in the system to render. */
function CorridorDetail({
  corridor,
  providers,
  rails,
  refresh,
}: {
  corridor: Data["corridors"][number];
  providers: Data["providers"];
  rails: Data["rails"];
  refresh: () => Promise<void>;
}) {
  const [routes, setRoutes] = useState<Awaited<ReturnType<typeof adminRoutes>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [addingEvent, setAddingEvent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRoutes(await adminRoutes({ data: { corridorId: corridor.id } }));
    } finally {
      setLoading(false);
    }
  }, [corridor.id]);

  if (routes === null && !loading) void load();

  const after = async () => {
    setCreating(false);
    setEditing(null);
    setAddingEvent(false);
    await load();
    await refresh();
  };

  return (
    <div className="mt-8 border-t-2 border-ink pt-6">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className={cn(TEXT.heading, "text-ink")}>
          {corridor.originCountry} → {corridor.destinationCountry}
        </h3>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setAddingEvent((v) => !v)}>
            {addingEvent ? "Cancel" : "Structural change"}
          </Button>
          <Button
            onClick={() => {
              setCreating((v) => !v);
              setEditing(null);
            }}
            disabled={providers.length === 0 || rails.length === 0}
          >
            {creating ? "Cancel" : "New route"}
          </Button>
        </div>
      </div>

      {providers.length === 0 || rails.length === 0 ? (
        <p className={cn(TEXT.micro, "mt-3 text-[var(--accord-orange-deep)]")}>
          A route is a rail reached through a provider — create at least one of each first.
        </p>
      ) : null}

      {addingEvent ? (
        <div className="mt-5">
          <CorridorEventForm
            corridorId={corridor.id}
            onCancel={() => setAddingEvent(false)}
            onSaved={after}
          />
        </div>
      ) : null}

      {creating ? (
        <div className="mt-5">
          <RouteForm
            corridorId={corridor.id}
            providers={providers}
            rails={rails}
            onCancel={() => setCreating(false)}
            onSaved={after}
          />
        </div>
      ) : null}

      <div className="mt-5">
        {loading && routes === null ? (
          <p className={cn(TEXT.micro, "text-ink/50")}>Loading routes…</p>
        ) : (routes?.length ?? 0) === 0 ? (
          <Empty>No routes on this corridor yet.</Empty>
        ) : (
          <Table head={["Rail", "Provider", "Finality", "Status", "Verified", ""]}>
            {(routes ?? []).map((r) => (
              <Row key={r.id}>
                <Cell>
                  {r.railName}
                  {r.railIsMessaging ? (
                    <span className={cn(TEXT.micro, "block text-ink/45")}>messaging network</span>
                  ) : null}
                </Cell>
                <Cell>{r.providerName}</Cell>
                <Cell>
                  {r.settlementFinality ?? (
                    <span className="text-ink/40 italic">Not published</span>
                  )}
                  {r.settlementFinality && r.settlementSystem ? (
                    <span className={cn(TEXT.micro, "block text-ink/45")}>
                      via {r.settlementSystem}
                    </span>
                  ) : null}
                </Cell>
                <Cell>
                  <Pill tone={r.status === "published" ? "open" : "neutral"}>{r.status}</Pill>
                </Cell>
                <Cell>
                  {r.lastVerifiedAt ? new Date(r.lastVerifiedAt).toLocaleDateString("en-GB") : "—"}
                </Cell>
                <Cell>
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setEditing(editing === r.id ? null : r.id);
                      setCreating(false);
                    }}
                  >
                    Edit
                  </Button>
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </div>

      {editing ? (
        <div className="mt-5">
          <RouteForm
            corridorId={corridor.id}
            providers={providers}
            rails={rails}
            initial={(routes ?? []).find((r) => r.id === editing) as unknown as RouteRow}
            onCancel={() => setEditing(null)}
            onSaved={after}
          />
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- rails -- */

function Rails({ rows, refresh }: { rows: Data["rails"]; refresh: () => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <Panel
      title="Rails"
      action={
        <Button
          variant="secondary"
          onClick={() => {
            setCreating((v) => !v);
            setEditing(null);
          }}
        >
          {creating ? "Cancel" : "New rail"}
        </Button>
      }
    >
      {creating ? (
        <RailForm
          onCancel={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await refresh();
          }}
        />
      ) : null}

      {rows.length === 0 ? (
        <Empty>No rails yet.</Empty>
      ) : (
        <Table head={["Rail", "Category", "Settles?", "Status", "Last verified", ""]}>
          {rows.map((r) => (
            <Row key={r.id}>
              <Cell>{r.name}</Cell>
              <Cell>{r.category}</Cell>
              <Cell>
                {r.isMessagingNetwork ? (
                  <span className="text-[var(--accord-orange-deep)]">messaging only</span>
                ) : (
                  "settles"
                )}
              </Cell>
              <Cell>
                <Pill tone={r.status === "published" ? "open" : "neutral"}>{r.status}</Pill>
              </Cell>
              <Cell>
                {r.lastVerifiedAt ? new Date(r.lastVerifiedAt).toLocaleDateString("en-GB") : "—"}
              </Cell>
              <Cell>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setEditing(editing === r.id ? null : r.id);
                    setCreating(false);
                  }}
                >
                  Edit
                </Button>
              </Cell>
            </Row>
          ))}
        </Table>
      )}

      {editing ? (
        <div className="mt-6">
          <RailForm
            initial={rows.find((r) => r.id === editing) as RailRow}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              await refresh();
            }}
          />
        </div>
      ) : null}
    </Panel>
  );
}

/* ------------------------------------------------------------- providers -- */

function Providers({
  rows,
  refresh,
  run,
}: {
  rows: Data["providers"];
  refresh: () => Promise<void>;
  run: (w: () => Promise<unknown>) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [licencesFor, setLicencesFor] = useState<string | null>(null);
  const [licenceEditing, setLicenceEditing] = useState<string | null>(null);
  const [addingLicence, setAddingLicence] = useState(false);

  const open = rows.find((p) => p.id === licencesFor);

  return (
    <Panel
      title="Providers"
      action={
        <Button
          variant="secondary"
          onClick={() => {
            setCreating((v) => !v);
            setEditing(null);
          }}
        >
          {creating ? "Cancel" : "New provider"}
        </Button>
      }
    >
      {creating ? (
        <ProviderForm
          onCancel={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await refresh();
          }}
        />
      ) : null}

      {rows.length === 0 ? (
        <Empty>No providers yet.</Empty>
      ) : (
        <Table head={["Provider", "Type", "Licences", "Status", "Last verified", ""]}>
          {rows.map((p) => (
            <Row key={p.id}>
              <Cell>
                <a href={`/radar/providers/${p.slug}`} className="underline underline-offset-2">
                  {p.name}
                </a>
              </Cell>
              <Cell>{p.type}</Cell>
              <Cell>{p.licences.length}</Cell>
              <Cell>
                <Pill tone={p.status === "published" ? "open" : "neutral"}>{p.status}</Pill>
              </Cell>
              <Cell>
                {p.lastVerifiedAt ? new Date(p.lastVerifiedAt).toLocaleDateString("en-GB") : "—"}
              </Cell>
              <Cell>
                <div className="flex gap-2">
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setEditing(editing === p.id ? null : p.id);
                      setCreating(false);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setLicencesFor(licencesFor === p.id ? null : p.id);
                      setAddingLicence(false);
                      setLicenceEditing(null);
                    }}
                  >
                    {licencesFor === p.id ? "Close" : "Licences"}
                  </Button>
                </div>
              </Cell>
            </Row>
          ))}
        </Table>
      )}

      {editing ? (
        <div className="mt-6">
          <ProviderForm
            initial={rows.find((p) => p.id === editing) as unknown as ProviderRow}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              await refresh();
            }}
          />
        </div>
      ) : null}

      {open ? (
        <div className="mt-8 border-t-2 border-ink pt-6">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className={cn(TEXT.heading, "text-ink")}>Licences — {open.name}</h3>
            <Button
              variant="secondary"
              onClick={() => {
                setAddingLicence((v) => !v);
                setLicenceEditing(null);
              }}
            >
              {addingLicence ? "Cancel" : "Add licence"}
            </Button>
          </div>

          {addingLicence ? (
            <div className="mt-5">
              <LicenceForm
                providerId={open.id}
                onCancel={() => setAddingLicence(false)}
                onSaved={async () => {
                  setAddingLicence(false);
                  await refresh();
                }}
              />
            </div>
          ) : null}

          <div className="mt-5">
            {open.licences.length === 0 ? (
              <Empty>No licences recorded. The provider page will say so plainly.</Empty>
            ) : (
              <Table head={["Licence", "Jurisdiction", "Reference", "Register", "Verified", ""]}>
                {open.licences.map((l) => (
                  <Row key={l.id}>
                    <Cell>{l.name}</Cell>
                    <Cell>{l.jurisdiction ?? "—"}</Cell>
                    <Cell>{l.referenceNumber ?? "—"}</Cell>
                    <Cell>
                      <a
                        href={l.registerUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="underline underline-offset-2"
                      >
                        Open
                      </a>
                    </Cell>
                    <Cell>
                      {l.lastVerifiedAt
                        ? new Date(l.lastVerifiedAt).toLocaleDateString("en-GB")
                        : "—"}
                    </Cell>
                    <Cell>
                      <div className="flex gap-2">
                        <Button
                          variant="quiet"
                          onClick={() => {
                            setLicenceEditing(licenceEditing === l.id ? null : l.id);
                            setAddingLicence(false);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="quiet"
                          onClick={() => run(() => removeLicence({ data: { id: l.id } }))}
                        >
                          Remove
                        </Button>
                      </div>
                    </Cell>
                  </Row>
                ))}
              </Table>
            )}
          </div>

          {licenceEditing ? (
            <div className="mt-5">
              <LicenceForm
                providerId={open.id}
                initial={open.licences.find((l) => l.id === licenceEditing)}
                onCancel={() => setLicenceEditing(null)}
                onSaved={async () => {
                  setLicenceEditing(null);
                  await refresh();
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
