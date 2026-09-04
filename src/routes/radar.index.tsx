import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { RadarShell } from "@/components/radar/Shell";
import { Button, INPUT, T } from "@/components/radar/primitives";
import { corridorIndex } from "@/rpc/radar";

/**
 * THE ENTRY POINT.
 *
 * The homepage asks ONE question, and it is deliberately not "what's the best
 * route". Cost and settlement time are not verifiable at scale today, so V1
 * ships the map, not the meter: which rails exist, who gives access to them,
 * what licences they hold, what limits and requirements apply.
 *
 * The call to action says SEE AVAILABLE RAILS. It does not promise cheapest or
 * fastest, because the product does not know and will not guess.
 *
 * AMOUNT IS OPTIONAL AND IT IS NOT A PRICE. It filters routes by published
 * min/max limits and does nothing else.
 */
export const Route = createFileRoute("/radar/")({
  head: () => ({
    meta: [
      { title: "Rails Radar — How can money move from A to B?" },
      {
        name: "description",
        content:
          "Which rails exist in a corridor, which providers give access to them, the licences they hold, their operating hours, settlement finality, supported assets and published limits. Every figure carries its source.",
      },
      { property: "og:title", content: "Rails Radar — Intelligence Layer for Moving Money" },
      {
        property: "og:description",
        content:
          "The rails, providers, licences and limits behind every corridor — sourced and verified per record.",
      },
      { property: "og:url", content: "https://railsradar.com" },
    ],
    links: [{ rel: "canonical", href: "https://railsradar.com" }],
  }),
  loader: () => corridorIndex().catch(() => ({ corridors: [], counts: null })),
  component: RadarHome,
});

function RadarHome() {
  const { corridors, counts } = Route.useLoaderData();
  const navigate = useNavigate();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  /* Origins and destinations come from corridors that actually exist. Offering
     a country pair that resolves to nothing would be a worse experience than
     offering fewer options honestly. */
  const origins = useMemo(
    () => [...new Set(corridors.map((c) => c.origin.country))].sort(),
    [corridors],
  );
  const destinations = useMemo(
    () =>
      [
        ...new Set(
          corridors
            .filter((c) => !from || c.origin.country === from)
            .map((c) => c.destination.country),
        ),
      ].sort(),
    [corridors, from],
  );

  const match = corridors.find((c) => c.origin.country === from && c.destination.country === to);

  function go() {
    if (!match) return;
    const trimmed = amount.trim();
    navigate({
      to: "/radar/corridors/$slug",
      params: { slug: match.slug },
      search: trimmed ? { amount: Number(trimmed) } : {},
    });
  }

  const popular = corridors.slice(0, 6);

  return (
    <RadarShell counts={counts}>
      <div className="mx-auto max-w-3xl">
        <h1 className={cn(T.page, "text-ink")}>How can money move?</h1>
        <p className={cn(T.body, "mt-4 max-w-xl text-ink/60")}>
          Choose a corridor to see which rails exist, who provides access, and what each one
          requires. Every figure carries the source it came from and the date it was checked.
        </p>

        <form
          className="mt-10 border-t border-hairline pt-8"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
        >
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_10rem]">
            <label className="block">
              <span className={cn(T.label, "accord-signal text-ink/55")}>From</span>
              <select
                className={cn(INPUT, "mt-2")}
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setTo("");
                }}
                disabled={origins.length === 0}
              >
                <option value="">{origins.length ? "Select country" : "No corridors yet"}</option>
                {origins.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={cn(T.label, "accord-signal text-ink/55")}>To</span>
              <select
                className={cn(INPUT, "mt-2")}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={!from}
              >
                <option value="">{from ? "Select country" : "Choose an origin first"}</option>
                {destinations.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={cn(T.label, "accord-signal text-ink/55")}>
                Amount <span className="normal-case tracking-normal text-ink/35">(optional)</span>
              </span>
              <input
                className={cn(INPUT, "mt-2 text-right font-mono tabular-nums")}
                inputMode="decimal"
                placeholder="—"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              />
            </label>
          </div>

          <p className={cn(T.micro, "mt-3 text-ink/45")}>
            Amount filters routes by published minimum and maximum limits. It is not used to
            estimate cost — Rails Radar does not price transfers.
          </p>

          <Button type="submit" className="mt-6 w-full" disabled={!match}>
            See available rails
          </Button>
          {from && to && !match ? (
            <p className={cn(T.micro, "mt-3 text-[var(--accord-orange-deep)]")}>
              No corridor recorded for that pair yet.{" "}
              <Link to="/radar/corridors" className="underline underline-offset-2">
                Browse what exists
              </Link>
              .
            </p>
          ) : null}
        </form>

        {popular.length > 0 ? (
          <section className="mt-14 border-t border-hairline pt-8">
            <h2 className={cn(T.label, "accord-signal text-ink/55")}>Corridors</h2>
            <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {popular.map((c) => (
                <li key={c.slug}>
                  <Link
                    to="/radar/corridors/$slug"
                    params={{ slug: c.slug }}
                    className={cn(
                      T.body,
                      "text-ink underline decoration-ink/20 underline-offset-4 transition-colors hover:text-[var(--accord-orange-deep)] hover:decoration-[var(--accord-orange-deep)]",
                    )}
                  >
                    {c.origin.country} → {c.destination.country}
                  </Link>
                  <span className={cn(T.micro, "ml-2 text-ink/40")}>
                    {c.origin.currency}/{c.destination.currency}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          /* The launch state, and it is designed rather than apologised for.
             An empty dataset is the normal condition of a verification-first
             product on day one — the honest move is to say so and offer a way in. */
          <section className="mt-14 border-t border-hairline pt-8">
            <h2 className={cn(T.heading, "text-ink")}>No corridors published yet</h2>
            <p className={cn(T.body, "mt-3 max-w-xl text-ink/60")}>
              Rails Radar publishes a corridor only once its rails, providers and licences have been
              checked against primary sources — provider documentation and regulator registers.
              Nothing here is estimated or inferred, so the map fills in as verification completes
              rather than all at once.
            </p>
            <p className={cn(T.body, "mt-4")}>
              <Link
                to="/radar/corridors"
                className="underline decoration-ink/25 underline-offset-4 transition-colors hover:text-[var(--accord-orange-deep)]"
              >
                Submit a source
              </Link>
              <span className="text-ink/45">
                {" "}
                — if you have documentation for a corridor, it goes into the verification queue.
              </span>
            </p>
          </section>
        )}
      </div>
    </RadarShell>
  );
}
