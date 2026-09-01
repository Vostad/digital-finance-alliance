import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Shell } from "@/components/admin/Shell";
import { Button, Field, INPUT, Label, Panel, Pill, TEXT } from "@/components/admin/primitives";
import { addLead, leadFormOptions, previewDuplicates } from "@/rpc/leads";
import { me } from "@/rpc/auth";

/**
 * + ADD LEAD — §5, first class for every Team Member.
 *
 * The screen's real job is not collecting fields; it is **showing the operator
 * who already exists before they create a second one**. Matching runs as they
 * type and the candidates sit directly above the button, not behind a "check
 * for duplicates" step nobody presses.
 *
 * A `certain` match is not an error here. It means "this person exists, and
 * this will attach to them" — which is usually exactly what the operator wants.
 */

export const Route = createFileRoute("/admin/leads/new")({
  head: () => ({
    meta: [{ title: "Add lead — Financial Rails OS" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const user = await me().catch(() => null);
    if (!user) throw redirect({ to: "/admin/login" });
    return { user };
  },
  loader: async () => ({ options: await leadFormOptions() }),
  component: NewLeadPage,
});

type Matches = Awaited<ReturnType<typeof previewDuplicates>>;

function NewLeadPage() {
  const { options } = Route.useLoaderData();
  const router = useRouter();

  const [functions, setFunctions] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [editionId, setEditionId] = useState(options.editions[0]?.id ?? "");
  const [matches, setMatches] = useState<Matches | null>(null);
  const [acceptPerson, setAcceptPerson] = useState<string | null>(null);
  const [acceptCompany, setAcceptCompany] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  /* §5 — matching runs BEFORE save, as they type. Debounced, because it fires
     on every keystroke and the answer only matters once they pause. */
  useEffect(() => {
    if (name.trim().length < 2 && email.trim().length < 4) {
      setMatches(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setMatches(
          await previewDuplicates({ data: { fullName: name, email, companyName: company } }),
        );
      } catch {
        /* A failed preview must never block typing. */
      }
    }, 350);
    return () => clearTimeout(t);
  }, [name, email, company]);

  const certainPerson = matches?.people.find((p) => p.confidence === "certain");
  const strongPeople = matches?.people.filter((p) => p.confidence === "strong") ?? [];
  const otherPeople = matches?.people.filter((p) => p.confidence === "possible") ?? [];
  const companyCandidates = matches?.companies ?? [];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const v = (k: string) => String(data.get(k) ?? "").trim() || undefined;

    try {
      const result = await addLead({
        data: {
          fullName: name.trim(),
          companyName: company.trim() || undefined,
          jobTitle: v("jobTitle"),
          email: email.trim() || undefined,
          phone: v("phone"),
          country: v("country"),
          functions: functions as ("sponsor" | "delegate" | "speaker")[],
          editionId,
          source: (v("source") ?? "manual") as "manual",
          notes: v("notes"),
          estimatedValue: v("estimatedValue"),
          acceptPersonMatchId: acceptPerson ?? undefined,
          acceptCompanyMatchId: acceptCompany ?? undefined,
        },
      });
      await router.navigate({ to: `/admin/leads/${result.opportunityIds[0]}` as never });
    } catch (problem) {
      setError(
        problem instanceof Error && problem.message ? problem.message : "Could not save that.",
      );
      setBusy(false);
    }
  }

  return (
    <Shell title="Add lead" subtitle="One person. One company. A workstream per function.">
      <form ref={form} onSubmit={submit} className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <Panel title="Person">
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required>
                <input
                  className={INPUT}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="off"
                />
              </Field>
              <Field label="Work email" hint="The identity key. One address, one person.">
                <input
                  className={INPUT}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="Company">
                <input
                  className={INPUT}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="Job title">
                <input className={INPUT} name="jobTitle" autoComplete="off" />
              </Field>
              <Field label="Phone">
                <input className={INPUT} name="phone" autoComplete="off" />
              </Field>
              <Field label="Country">
                <input className={INPUT} name="country" autoComplete="off" />
              </Field>
            </div>
          </Panel>

          <Panel title="Workstream">
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Function" required hint="One workstream opens per function chosen.">
                <div className="flex flex-wrap gap-2">
                  {options.functions.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() =>
                        setFunctions((cur) =>
                          cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f],
                        )
                      }
                      className={cn(
                        "border px-3 py-1.5 font-mono text-[13px] uppercase tracking-[0.1em] transition-colors",
                        functions.includes(f)
                          ? "border-ink bg-ink text-paper"
                          : "border-hairline text-ink/60 hover:border-ink hover:text-ink",
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Edition" required>
                <select
                  className={INPUT}
                  value={editionId}
                  onChange={(e) => setEditionId(e.target.value)}
                >
                  {options.editions.map((ed) => (
                    <option key={ed.id} value={ed.id}>
                      {ed.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Lead source">
                <select className={INPUT} name="source" defaultValue="manual">
                  {["manual", "referral", "event", "import", "other"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>

              {functions.includes("sponsor") ? (
                <Field label="Estimated value" hint="Sponsor only. Counted functions carry none.">
                  <input className={INPUT} name="estimatedValue" inputMode="decimal" />
                </Field>
              ) : null}
            </div>

            <div className="mt-4">
              <Field label="Notes">
                <textarea className={cn(INPUT, "min-h-[5rem]")} name="notes" />
              </Field>
            </div>
          </Panel>

          {error ? (
            <p
              role="alert"
              className={cn(TEXT.body, "border-l-2 border-[var(--accord-orange-deep)] pl-3")}
            >
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={busy || !name.trim() || functions.length === 0}>
              {busy ? "Saving…" : "Create lead"}
            </Button>
            <Button variant="quiet" onClick={() => router.navigate({ to: "/admin" })}>
              Cancel
            </Button>
          </div>
        </div>

        {/* §5 — the candidates, beside the form and always visible. */}
        <aside className="min-w-0 space-y-5">
          <Panel title="Already in the system">
            {!matches ? (
              <p className={cn(TEXT.micro, "py-4 text-ink/50")}>
                Start typing a name or email. Matches appear here before you save.
              </p>
            ) : certainPerson ? (
              <div className="py-3">
                <Pill tone="won">Exact match</Pill>
                <p className={cn(TEXT.body, "mt-2")}>
                  <strong>{certainPerson.fullName}</strong>
                  {certainPerson.companyName ? ` · ${certainPerson.companyName}` : ""}
                </p>
                <p className={cn(TEXT.micro, "mt-1 text-ink/60")}>{certainPerson.reason}</p>
                <p className={cn(TEXT.micro, "mt-2 text-ink/60")}>
                  This will attach a new workstream to them rather than creating a second record.
                </p>
              </div>
            ) : strongPeople.length || otherPeople.length ? (
              <ul className="divide-y divide-hairline">
                {[...strongPeople, ...otherPeople].map((p) => (
                  <li key={p.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={cn(TEXT.body, "font-medium")}>{p.fullName}</p>
                        <p className={cn(TEXT.micro, "text-ink/60")}>{p.reason}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAcceptPerson(acceptPerson === p.id ? null : p.id)}
                        className={cn(
                          "shrink-0 border px-2 py-1 font-mono text-[13px] uppercase tracking-[0.08em]",
                          acceptPerson === p.id
                            ? "border-ink bg-ink text-paper"
                            : "border-hairline text-ink/60 hover:border-ink hover:text-ink",
                        )}
                      >
                        {acceptPerson === p.id ? "Same" : "Same?"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={cn(TEXT.micro, "py-4 text-ink/50")}>
                No match. This will create a new person.
              </p>
            )}
          </Panel>

          {companyCandidates.length ? (
            <Panel title="Similar companies">
              <ul className="divide-y divide-hairline">
                {companyCandidates.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className={cn(TEXT.body, "font-medium")}>{c.name}</p>
                      <p className={cn(TEXT.micro, "text-ink/60")}>{c.reason}</p>
                    </div>
                    {c.confidence === "certain" ? (
                      <Pill tone="won">Match</Pill>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAcceptCompany(acceptCompany === c.id ? null : c.id)}
                        className={cn(
                          "shrink-0 border px-2 py-1 font-mono text-[13px] uppercase tracking-[0.08em]",
                          acceptCompany === c.id
                            ? "border-ink bg-ink text-paper"
                            : "border-hairline text-ink/60 hover:border-ink hover:text-ink",
                        )}
                      >
                        {acceptCompany === c.id ? "Same" : "Same?"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className={cn(TEXT.micro, "mt-3 text-ink/50")}>
                A similar name is never enough to merge on its own — confirm it here, or a separate
                company is created and flagged for review.
              </p>
            </Panel>
          ) : null}
        </aside>
      </form>
    </Shell>
  );
}
