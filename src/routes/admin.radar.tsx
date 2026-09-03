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
  Stat,
  StatRow,
  TEXT,
  Table,
} from "@/components/admin/primitives";
import {
  adminCorridors,
  adminProviders,
  adminRails,
  decideSubmission,
  radarAdminOverview,
  saveCorridor,
  saveLicence,
  saveProvider,
  saveRail,
  submissionQueue,
} from "@/rpc/radar-admin";

/**
 * RAILS RADAR — THE ADMIN SURFACE.
 *
 * Authenticated, and not by this file. Every RPC it calls resolves identity on
 * the server and refuses a non-editor there, so the redirect below is courtesy
 * for a signed-out visitor rather than the control. Hiding a button has never
 * been an authorization mechanism and is not one here.
 *
 * TWO THINGS THIS SCREEN MAKES UNAVOIDABLE:
 *
 *   · every save demands a source URL and a verification date. They are
 *     required fields, the server re-checks them, and the database has a CHECK
 *     constraint behind that. Three layers, because provenance is the product.
 *
 *   · reviewing a submission cannot write to a live field. Accept marks the
 *     claim worth acting on; an editor then opens the source and types the
 *     record. There is no "apply this submission" button and there must not be.
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

type Tab = "queue" | "corridors" | "rails" | "providers" | "stale";

const TODAY = () => new Date().toISOString().slice(0, 10);

function RadarAdmin() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("queue");
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<unknown>) => {
    setError(null);
    try {
      await work();
      await router.invalidate();
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
        {tab === "stale" ? <Stale stale={data.stale} /> : null}
        {tab === "corridors" ? <Corridors rows={data.corridors} run={run} /> : null}
        {tab === "rails" ? <Rails rows={data.rails} run={run} /> : null}
        {tab === "providers" ? <Providers rows={data.providers} run={run} /> : null}
      </div>
    </Shell>
  );
}

/* ----------------------------------------------------------------- queue -- */

function Queue({
  rows,
  run,
}: {
  rows: Awaited<ReturnType<typeof submissionQueue>>;
  run: (w: () => Promise<unknown>) => Promise<void>;
}) {
  const [note, setNote] = useState<Record<string, string>>({});

  return (
    <Panel title="Submission queue">
      <p className={cn(TEXT.micro, "mt-3 mb-4 max-w-2xl text-ink/55")}>
        Unverified claims from the public forms. Nothing here renders on the site. Accepting a
        submission records that it is worth acting on — it does not publish anything. Open the
        source, confirm it, then enter the record yourself.
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

type StaleQueue = Awaited<ReturnType<typeof radarAdminOverview>>["stale"];

function Stale({ stale }: { stale: StaleQueue }) {
  const rows = [
    ...stale.rails.map((r) => ({ kind: "Rail", name: r.name, at: r.lastVerifiedAt })),
    ...stale.providers.map((r) => ({ kind: "Provider", name: r.name, at: r.lastVerifiedAt })),
    ...stale.routes.map((r) => ({
      kind: "Route",
      name: `${r.railName} via ${r.providerName} — ${r.corridorSlug}`,
      at: r.lastVerifiedAt,
    })),
  ];

  return (
    <Panel title={`Re-verification — unchecked for ${stale.afterDays} days or more`}>
      <p className={cn(TEXT.micro, "mt-3 mb-4 max-w-2xl text-ink/55")}>
        Published records surface here once they go stale. A record that has never been verified
        sorts first: it is more urgent than one checked a long time ago, not less.
      </p>
      {rows.length === 0 ? (
        <Empty>Nothing is overdue.</Empty>
      ) : (
        <Table head={["Type", "Record", "Last verified"]}>
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
  run,
}: {
  rows: Awaited<ReturnType<typeof adminCorridors>>;
  run: (w: () => Promise<unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    originCountry: "",
    originCountryCode: "",
    originCurrency: "",
    destinationCountry: "",
    destinationCountryCode: "",
    destinationCurrency: "",
    status: "draft" as "draft" | "published" | "archived",
    lastVerifiedAt: TODAY(),
    lastVerifiedBy: "",
  });

  return (
    <Panel
      title="Corridors"
      action={
        <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "New corridor"}
        </Button>
      }
    >
      {open ? (
        <div className="mb-6 grid gap-3 border border-hairline p-4 sm:grid-cols-3">
          <Field label="Origin country" required>
            <input
              className={INPUT}
              value={f.originCountry}
              onChange={(e) => setF({ ...f, originCountry: e.target.value })}
            />
          </Field>
          <Field label="Origin ISO" required>
            <input
              className={INPUT}
              maxLength={3}
              value={f.originCountryCode}
              onChange={(e) => setF({ ...f, originCountryCode: e.target.value })}
            />
          </Field>
          <Field label="Origin currency" required>
            <input
              className={INPUT}
              maxLength={3}
              value={f.originCurrency}
              onChange={(e) => setF({ ...f, originCurrency: e.target.value })}
            />
          </Field>
          <Field label="Destination country" required>
            <input
              className={INPUT}
              value={f.destinationCountry}
              onChange={(e) => setF({ ...f, destinationCountry: e.target.value })}
            />
          </Field>
          <Field label="Destination ISO" required>
            <input
              className={INPUT}
              maxLength={3}
              value={f.destinationCountryCode}
              onChange={(e) => setF({ ...f, destinationCountryCode: e.target.value })}
            />
          </Field>
          <Field label="Destination currency" required>
            <input
              className={INPUT}
              maxLength={3}
              value={f.destinationCurrency}
              onChange={(e) => setF({ ...f, destinationCurrency: e.target.value })}
            />
          </Field>
          <Field label="Verified on" required>
            <input
              type="date"
              className={INPUT}
              value={f.lastVerifiedAt}
              onChange={(e) => setF({ ...f, lastVerifiedAt: e.target.value })}
            />
          </Field>
          <Field label="Verified by">
            <input
              className={INPUT}
              value={f.lastVerifiedBy}
              onChange={(e) => setF({ ...f, lastVerifiedBy: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select
              className={INPUT}
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value as typeof f.status })}
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </Field>
          <div className="sm:col-span-3">
            <Button
              onClick={() =>
                run(async () => {
                  await saveCorridor({ data: f });
                  setOpen(false);
                })
              }
            >
              Save corridor
            </Button>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <Empty>No corridors yet.</Empty>
      ) : (
        <Table head={["Corridor", "Currencies", "Routes", "Status", "Last verified"]}>
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
            </Row>
          ))}
        </Table>
      )}
    </Panel>
  );
}

/* ----------------------------------------------------------------- rails -- */

function Rails({
  rows,
  run,
}: {
  rows: Awaited<ReturnType<typeof adminRails>>;
  run: (w: () => Promise<unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "",
    category: "traditional" as "traditional" | "digital" | "blockchain" | "emerging",
    description: "",
    isMessagingNetwork: false,
    status: "draft" as "draft" | "published" | "archived",
    sourceUrl: "",
    lastVerifiedAt: TODAY(),
    lastVerifiedBy: "",
  });

  return (
    <Panel
      title="Rails"
      action={
        <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "New rail"}
        </Button>
      }
    >
      {open ? (
        <div className="mb-6 grid gap-3 border border-hairline p-4 sm:grid-cols-2">
          <Field label="Name" required>
            <input
              className={INPUT}
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <select
              className={INPUT}
              value={f.category}
              onChange={(e) => setF({ ...f, category: e.target.value as typeof f.category })}
            >
              <option value="traditional">traditional</option>
              <option value="digital">digital</option>
              <option value="blockchain">blockchain</option>
              <option value="emerging">emerging</option>
            </select>
          </Field>
          <Field label="Description">
            <input
              className={INPUT}
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
            />
          </Field>
          <Field label="Source URL" required>
            <input
              className={INPUT}
              placeholder="https://"
              value={f.sourceUrl}
              onChange={(e) => setF({ ...f, sourceUrl: e.target.value })}
            />
          </Field>
          <Field label="Verified on" required>
            <input
              type="date"
              className={INPUT}
              value={f.lastVerifiedAt}
              onChange={(e) => setF({ ...f, lastVerifiedAt: e.target.value })}
            />
          </Field>
          <Field label="Verified by">
            <input
              className={INPUT}
              value={f.lastVerifiedBy}
              onChange={(e) => setF({ ...f, lastVerifiedBy: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            {/* The ontological switch. Setting this changes how every route on
                this rail may record finality — the server refuses a finality
                claim on a messaging network unless the settlement system is named. */}
            <label className={cn(TEXT.body, "flex items-center gap-2")}>
              <input
                type="checkbox"
                checked={f.isMessagingNetwork}
                onChange={(e) => setF({ ...f, isMessagingNetwork: e.target.checked })}
              />
              This is a messaging network — it carries instructions and does not settle
            </label>
          </div>
          <Field label="Status">
            <select
              className={INPUT}
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value as typeof f.status })}
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Button
              onClick={() =>
                run(async () => {
                  await saveRail({ data: f });
                  setOpen(false);
                })
              }
            >
              Save rail
            </Button>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <Empty>No rails yet.</Empty>
      ) : (
        <Table head={["Rail", "Category", "Settles?", "Status", "Last verified"]}>
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
            </Row>
          ))}
        </Table>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------- providers -- */

function Providers({
  rows,
  run,
}: {
  rows: Awaited<ReturnType<typeof adminProviders>>;
  run: (w: () => Promise<unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [licenceFor, setLicenceFor] = useState<string | null>(null);
  const [lic, setLic] = useState({
    name: "",
    registerUrl: "",
    jurisdiction: "",
    lastVerifiedAt: TODAY(),
    lastVerifiedBy: "",
  });
  const [f, setF] = useState({
    name: "",
    type: "psp" as
      "bank" | "psp" | "orchestration" | "stablecoin" | "fx" | "custodian" | "exchange" | "onramp",
    website: "",
    markets: "",
    assets: "",
    networks: "",
    status: "draft" as "draft" | "published" | "archived",
    sourceUrl: "",
    lastVerifiedAt: TODAY(),
    lastVerifiedBy: "",
  });

  const split = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  return (
    <Panel
      title="Providers"
      action={
        <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "New provider"}
        </Button>
      }
    >
      {open ? (
        <div className="mb-6 grid gap-3 border border-hairline p-4 sm:grid-cols-2">
          <Field label="Name" required>
            <input
              className={INPUT}
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <select
              className={INPUT}
              value={f.type}
              onChange={(e) => setF({ ...f, type: e.target.value as typeof f.type })}
            >
              {[
                "bank",
                "psp",
                "orchestration",
                "stablecoin",
                "fx",
                "custodian",
                "exchange",
                "onramp",
              ].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Website">
            <input
              className={INPUT}
              value={f.website}
              onChange={(e) => setF({ ...f, website: e.target.value })}
            />
          </Field>
          <Field label="Markets (comma separated)">
            <input
              className={INPUT}
              value={f.markets}
              onChange={(e) => setF({ ...f, markets: e.target.value })}
            />
          </Field>
          <Field label="Assets (comma separated)">
            <input
              className={INPUT}
              value={f.assets}
              onChange={(e) => setF({ ...f, assets: e.target.value })}
            />
          </Field>
          <Field label="Networks (comma separated)">
            <input
              className={INPUT}
              value={f.networks}
              onChange={(e) => setF({ ...f, networks: e.target.value })}
            />
          </Field>
          <Field label="Source URL" required>
            <input
              className={INPUT}
              placeholder="https://"
              value={f.sourceUrl}
              onChange={(e) => setF({ ...f, sourceUrl: e.target.value })}
            />
          </Field>
          <Field label="Verified on" required>
            <input
              type="date"
              className={INPUT}
              value={f.lastVerifiedAt}
              onChange={(e) => setF({ ...f, lastVerifiedAt: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select
              className={INPUT}
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value as typeof f.status })}
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Button
              onClick={() =>
                run(async () => {
                  await saveProvider({
                    data: {
                      name: f.name,
                      type: f.type,
                      website: f.website || null,
                      markets: split(f.markets),
                      assets: split(f.assets),
                      networks: split(f.networks),
                      useCases: [],
                      requirements: [],
                      status: f.status,
                      sourceUrl: f.sourceUrl,
                      lastVerifiedAt: f.lastVerifiedAt,
                      lastVerifiedBy: f.lastVerifiedBy,
                    },
                  });
                  setOpen(false);
                })
              }
            >
              Save provider
            </Button>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <Empty>No providers yet.</Empty>
      ) : (
        <Table head={["Provider", "Type", "Status", "Last verified", "Licence"]}>
          {rows.map((p) => (
            <Row key={p.id}>
              <Cell>
                <a href={`/radar/providers/${p.slug}`} className="underline underline-offset-2">
                  {p.name}
                </a>
              </Cell>
              <Cell>{p.type}</Cell>
              <Cell>
                <Pill tone={p.status === "published" ? "open" : "neutral"}>{p.status}</Pill>
              </Cell>
              <Cell>
                {p.lastVerifiedAt ? new Date(p.lastVerifiedAt).toLocaleDateString("en-GB") : "—"}
              </Cell>
              <Cell>
                {licenceFor === p.id ? (
                  <div className="grid gap-2">
                    <input
                      className={INPUT}
                      placeholder="Licence name"
                      value={lic.name}
                      onChange={(e) => setLic({ ...lic, name: e.target.value })}
                    />
                    {/* Mandatory. The server and the database both refuse without it. */}
                    <input
                      className={INPUT}
                      placeholder="Register URL (required)"
                      value={lic.registerUrl}
                      onChange={(e) => setLic({ ...lic, registerUrl: e.target.value })}
                    />
                    <input
                      className={INPUT}
                      placeholder="Jurisdiction"
                      value={lic.jurisdiction}
                      onChange={(e) => setLic({ ...lic, jurisdiction: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() =>
                          run(async () => {
                            await saveLicence({
                              data: {
                                providerId: p.id,
                                name: lic.name,
                                registerUrl: lic.registerUrl,
                                jurisdiction: lic.jurisdiction || null,
                                lastVerifiedAt: lic.lastVerifiedAt,
                                lastVerifiedBy: lic.lastVerifiedBy,
                              },
                            });
                            setLicenceFor(null);
                            setLic({
                              name: "",
                              registerUrl: "",
                              jurisdiction: "",
                              lastVerifiedAt: TODAY(),
                              lastVerifiedBy: "",
                            });
                          })
                        }
                      >
                        Save
                      </Button>
                      <Button variant="secondary" onClick={() => setLicenceFor(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="secondary" onClick={() => setLicenceFor(p.id)}>
                    Add licence
                  </Button>
                )}
              </Cell>
            </Row>
          ))}
        </Table>
      )}
    </Panel>
  );
}
