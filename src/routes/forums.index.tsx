import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Section } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { FinalCta } from "@/components/site/primitives";
import {
  FEATURED_EVENT,
  NEXT_EVENT,
  UPCOMING_EVENTS,
  type PortfolioEvent,
} from "@/lib/event-portfolio";

export const Route = createFileRoute("/forums/")({
  head: () => ({
    meta: [
      { title: "Financial Rails Forums — Asia, Africa, MENA | Financial Rails" },
      {
        name: "description",
        content:
          "Three editions in 2026 — Asia, Africa and MENA. Closed-door working rooms for the institutions building, funding, regulating and operating financial infrastructure.",
      },
      { property: "og:title", content: "Financial Rails Forums" },
      {
        property: "og:description",
        content:
          "Closed-door working rooms across payments, banking infrastructure, digital money, settlement, markets and regulation.",
      },
    ],
    links: [{ rel: "canonical", href: "https://financialrails.org/forums" }],
  }),
  component: Forums,
});

/* ------------------------------------------------------------------ data -- */

/**
 * This page has one job: list the active Financial Rails editions. The old two-tier
 * category architecture (Originals / Vertical Summits) is retired — the
 * portfolio in src/lib/event-portfolio.ts is the whole inventory, and this
 * page presents it in its editorial order: the two events that matter most
 * right now, then the rest of the calendar.
 */
const DISPLAY_ORDER: PortfolioEvent[] = [NEXT_EVENT, FEATURED_EVENT, ...UPCOMING_EVENTS];

/** The filter reads the portfolio's own statuses — no invented categories. */
const STATUS_FILTERS = [
  { id: "all", label: "All Editions" },
  { id: "next", label: "Next" },
  { id: "featured", label: "Featured" },
  { id: "upcoming", label: "Upcoming" },
] as const;

type StatusFilterId = (typeof STATUS_FILTERS)[number]["id"];

/* ---------------------------------------------------------------- pieces -- */

/**
 * One directory entry — the approved card structure, unchanged: frame, index
 * and status, name, tagline, schedule, action.
 *
 * NOT EVERY EVENT HAS A PAGE. The platform now runs one canonical event
 * micro-site template, so an event is only linked once its instance of that
 * template exists — `to` is set. An event still on the calendar without a page
 * renders exactly the same card minus the link and the "View Edition" line,
 * rather than pointing at a route that would 404. The card body is identical
 * in both states, so the grid never breaks rhythm.
 */
function EventCardBody({ event, index }: { event: PortfolioEvent; index: number }) {
  return (
    <>
      <figure
        className="relative w-full overflow-hidden bg-bone"
        style={{ aspectRatio: "16 / 10" }}
      >
        <img
          src={event.image.src}
          alt={event.image.alt}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover grayscale transition-[filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/card:grayscale-0 group-focus-visible/card:grayscale-0 motion-reduce:transition-none"
        />
      </figure>

      <div className="mt-7 flex grow flex-col">
        <div className="flex items-baseline justify-between gap-6">
          <span className="label accord-signal opacity-60">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="label opacity-45">{event.statusLabel}</span>
        </div>

        <h3 className="font-display mt-5 text-[clamp(1.75rem,2.9vw,2.6rem)] font-extrabold uppercase leading-[1.02] tracking-[-0.025em] break-words">
          {event.name}
        </h3>
        <p className="mt-4 max-w-[44ch] text-sm leading-relaxed opacity-65">{event.tagline}</p>

        <div className="mt-auto border-t border-hairline pt-6">
          <p className="label opacity-55">
            {" "}
            {event.dates} · {event.city}
            {event.country === event.city ? null : `, ${event.country}`}
          </p>
          {event.to ? (
            <span className="label accord-signal mt-4 inline-flex items-center gap-3">
              View Edition
              <span
                aria-hidden
                className="inline-block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/card:translate-x-1.5 motion-reduce:transition-none"
              >
                →
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}

function EventCard({
  event,
  index,
  delay,
}: {
  event: PortfolioEvent;
  index: number;
  delay: number;
}) {
  const shell = "group/card flex h-full flex-col";
  return (
    <Reveal delay={delay}>
      {event.to ? (
        <Link
          to={event.to}
          className={cn(
            shell,
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent",
          )}
        >
          <EventCardBody event={event} index={index} />
        </Link>
      ) : (
        <article className={shell}>
          <EventCardBody event={event} index={index} />
        </article>
      )}
    </Reveal>
  );
}

/* ------------------------------------------------------------------ page -- */

function Forums() {
  const [status, setStatus] = useState<StatusFilterId>("all");

  // Numbering follows the page's display order, not the filtered result, so an
  // event keeps its number when the filter narrows the grid.
  const numbered = DISPLAY_ORDER.map((event, index) => ({ event, index }));
  const visible = numbered.filter(({ event }) => status === "all" || event.status === status);

  return (
    <>
      {/* The directory — the functional heart of the page, and now its first
          section. pt-20 is not spacing of its own: it is the clearance the
          fixed nav needs, carried by whichever section opens a page (PageHero
          and PageOpener both do the same). The section's own padding is
          untouched. */}
      <Section label="The Forums" className="pt-20">
        <Reveal>
          <p className="label accord-signal opacity-45">The Forums</p>
        </Reveal>
        <Reveal delay={60}>
          {/* h1 now that the opener is gone: this is the page's own heading and
              the document needs exactly one. Visually identical — display-lg
              sets size and weight explicitly, and preflight resets heading
              defaults, so nothing about the rendering changes. */}
          <h1 className="display-lg mt-8 max-w-[20ch]">The rooms where the rails get decided.</h1>
        </Reveal>

        {/* The filter — deliberately quiet: mono, small, one row. It reads the
            portfolio's own statuses, so it cannot drift from the inventory. */}
        <Reveal
          delay={120}
          className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-hairline pt-8"
        >
          {STATUS_FILTERS.map((entry) => {
            const selected = entry.id === status;
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setStatus(entry.id)}
                className={cn(
                  "label transition-opacity duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink",
                  selected ? "accord-signal opacity-100" : "opacity-40 hover:opacity-70",
                )}
              >
                {entry.label}
              </button>
            );
          })}
          <span className="label ml-auto opacity-35">
            {visible.length} {visible.length === 1 ? "Edition" : "Editions"}
          </span>
        </Reveal>

        {status === "all" ? (
          <>
            {/* First row — the two events that matter most right now: the next
                date on the calendar beside the flagship. */}
            <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-2 lg:gap-x-10">
              <EventCard event={NEXT_EVENT} index={0} delay={0} />
              <EventCard event={FEATURED_EVENT} index={1} delay={80} />
            </div>

            {/* The rest of the calendar. */}
            <Reveal className="mt-20 border-t border-hairline pt-14 lg:mt-24">
              <h2 className="display-lg">Upcoming Editions</h2>
            </Reveal>
            <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-10">
              {UPCOMING_EVENTS.map((event, i) => (
                <EventCard key={event.id} event={event} index={2 + i} delay={(i % 3) * 80} />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-2 lg:gap-x-10">
            {visible.map(({ event, index }, i) => (
              <EventCard key={event.id} event={event} index={index} delay={(i % 2) * 80} />
            ))}
          </div>
        )}
      </Section>

      {/* Institutional positioning — the philosophy behind every Financial Rails
          forum, not one of them. It reads as the answer to the directory above:
          having seen what the forums are, this is how they are run. Built on
          this page's own Section rail rather than lifted wholesale from the
          Gigawatt page. */}
      <Section label="Positioning" tone="ink">
        <Reveal>
          <p className="lede max-w-[40ch] opacity-80">
            Each forum is invitation-only and built around the people making the decisions.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <h2 className="display-lg mt-14">Not another industry conference.</h2>
        </Reveal>

        <div className="mt-14 grid gap-y-12 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-5">
            {["Invitation-only.", "Decision-maker focused.", "Member access."].map((line, i) => (
              <Reveal key={line} delay={140 + i * 70}>
                <p
                  className={cn(
                    "display-sm border-t border-hairline-invert py-5",
                    i === 2 && "border-b",
                  )}
                >
                  {line}
                </p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={230} className="lg:col-span-6 lg:col-start-7 lg:pt-1">
            <p className="max-w-[52ch] text-base leading-relaxed opacity-75">
              Curated forums. Private meetings. Strategic deal-making. Intelligence. And, where it
              adds value, a highly selective environment for the technologies and companies shaping
              the sector.
            </p>
          </Reveal>
        </div>

        <Reveal delay={300} className="mt-16 border-t border-hairline-invert pt-12">
          <p className="display-md max-w-[30ch]">
            No mass audiences. No generic event floor. Just the right people in the room.
          </p>
        </Reveal>
      </Section>

      <FinalCta
        title="Find the Forum That Fits Your Institution."
        body="Three editions in 2026 — Asia, Africa and MENA. Each one a working room, not an audience."
        actions={[
          { label: "Explore Upcoming Forums", to: "/forums" },
          { label: "Become a Speaker", to: "/contact" },
        ]}
      />
    </>
  );
}
