import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/site/PageHero";
import { Section } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { NetworkMarquee } from "@/components/site/NetworkMarquee";
import { FINANCIAL_RAILS_LEADERS } from "@/lib/financial-rails-leaders";
import { EVENT_PORTFOLIO, type PortfolioEvent } from "@/lib/event-portfolio";
import { FinalCta, TitleBlock } from "@/components/site/primitives";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Financial Rails — The Infrastructure of the Next Financial System" },
      {
        name: "description",
        content:
          "The institutional platform for the infrastructure through which money is created, moved, settled, secured and governed. Forums in Asia, Africa and MENA, the FR30, the Council and original intelligence.",
      },
      {
        property: "og:title",
        content: "Financial Rails — The Infrastructure of the Next Financial System",
      },
      {
        property: "og:description",
        content:
          "The institutions building, funding, regulating and operating the financial rails are already moving.",
      },
      { property: "og:url", content: "https://financialrails.org" },
    ],
    links: [{ rel: "canonical", href: "https://financialrails.org" }],
  }),
  component: Home,
});

/**
 * The four components of the platform, in the order the institution presents
 * them: the room, the index, the council, the desk. Each links to its own
 * property — nothing here is a label without a page behind it.
 */
const PLATFORM = [
  {
    name: "Financial Rails Forums",
    body: "Invitation-only working rooms in Asia, Africa and MENA.",
    to: "/forums",
  },
  {
    name: "FR30",
    body: "The thirty people building the infrastructure money moves through.",
    to: "/fr30",
  },
  {
    name: "Financial Rails Council",
    body: "The institutional leadership network shaping the agenda.",
    to: "/council",
  },
  {
    name: "Financial Rails Intelligence",
    body: "Research, briefings and analysis from the editorial desk.",
    to: "/intelligence",
  },
];

const MISSION_METRICS = [
  { value: "50+", label: "Countries" },
  { value: "10+", label: "Programmes" },
];

/**
 * The Financial Rails positioning statement, set as one fixed lockup.
 *
 *   THE INFRASTRUCTURE / OF THE NEXT / FINANCIAL SYSTEM.
 *
 * Each line is its own block, so the break points are authored rather than left
 * to the measure. The break falls where the sentence breaks — after the noun,
 * then after the qualifier — which is why the short middle line reads as
 * deliberate rather than as a bad wrap. The lockup holds all three lines from
 * 320px up; nothing reflows between breakpoints, only the type scale moves.
 */
const HEADLINE_LINES = ["The infrastructure", "of the next", "financial system."];

function SignatureHeadline() {
  return (
    <>
      {HEADLINE_LINES.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </>
  );
}

/**
 * THE WORLD TOUR — the editions of Financial Rails, wherever they are held.
 *
 * The tour is an open series, not a fixed set. This band reads the platform's
 * own registry rather than a local list, so an edition added to EVENT_PORTFOLIO
 * appears here without touching this file — and the copy below never counts the
 * editions or calls them complete.
 *
 * Two things are stated per edition that the directory card states differently:
 * a tour-voice tagline, and a location written the way the edition writes it
 * ("Dubai, UAE", not the registry's formal country). Both are overrides keyed by
 * the registry id; anything without an override falls back to the registry, so a
 * new edition is legible here the moment it is added.
 */
const WORLD_TOUR_COPY: Record<string, { tagline?: string; location?: string }> = {
  "financial-rails-asia": { tagline: "Building Asia's next financial infrastructure." },
  "financial-rails-africa": { tagline: "Building Africa's next financial infrastructure." },
  "financial-rails-mena": {
    tagline: "Building the MENA financial infrastructure.",
    location: "Dubai, UAE",
  },
};

/** The registry's own formal location, used when an edition has no override. */
function registryLocation(event: PortfolioEvent) {
  return event.country === event.city ? event.city : `${event.city}, ${event.country}`;
}

/**
 * One edition, as a card: image, name, tagline, date, location, action — in
 * that order, and in that order at every width. The card is a flex column with
 * the schedule block pushed to `mt-auto`, so a longer tagline in one edition
 * cannot leave its neighbours' rules sitting at different heights.
 */
function WorldTourCard({ event, delay }: { event: PortfolioEvent; delay: number }) {
  const copy = WORLD_TOUR_COPY[event.id] ?? {};
  const body = (
    <>
      <figure
        className="relative w-full overflow-hidden bg-ink/40"
        style={{ aspectRatio: "16 / 10" }}
      >
        <img
          src={event.image.src}
          alt={event.image.alt}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover grayscale transition-[filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/tour:grayscale-0 group-focus-visible/tour:grayscale-0 motion-reduce:transition-none"
        />
      </figure>

      <div className="mt-7 flex grow flex-col">
        <h3 className="font-display text-[clamp(1.6rem,2.5vw,2.15rem)] font-extrabold uppercase leading-[1.02] tracking-[-0.025em] break-words">
          {event.name}
        </h3>
        <p className="mt-4 max-w-[40ch] text-sm leading-relaxed opacity-65">
          {copy.tagline ?? event.tagline}
        </p>

        <div className="mt-auto border-t border-hairline-invert pt-6">
          <p className="label opacity-70">{event.dates}</p>
          <p className="label mt-2 opacity-45">{copy.location ?? registryLocation(event)}</p>
          {event.to ? (
            <span className="label accord-signal-invert mt-6 inline-flex items-center gap-3">
              Explore Forum
              <span
                aria-hidden
                className="inline-block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/tour:translate-x-1.5 motion-reduce:transition-none"
              >
                →
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  const shell = "group/tour flex h-full flex-col";
  return (
    <Reveal delay={delay}>
      {event.to ? (
        <Link
          to={event.to}
          className={cn(
            shell,
            "transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none",
          )}
        >
          {body}
        </Link>
      ) : (
        <article className={shell}>{body}</article>
      )}
    </Reveal>
  );
}

function WorldTour() {
  return (
    <Section label="World Tour" tone="ink">
      <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-8">
        <div className="lg:col-span-7">
          <Reveal>
            <p className="label accord-signal-invert opacity-70">Financial Rails World Tour</p>
          </Reveal>
          <Reveal delay={60}>
            <h2 className="display-lg mt-8 max-w-[20ch]">
              The infrastructure of global finance, in every market.
            </h2>
          </Reveal>
        </div>
      </div>

      {/* The site's standing card grid: one column, two at md, three at lg —
          the same track the forums directory runs, so the tour and the
          directory read as one system rather than two. */}
      <div className="mt-16 grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:gap-x-10">
        {EVENT_PORTFOLIO.map((event, i) => (
          <WorldTourCard key={event.id} event={event} delay={i * 80} />
        ))}
      </div>
    </Section>
  );
}

/** Portrait travel, in pixels per second. Slow enough to read a name. */
const STRIP_SPEED = 34;

/**
 * The Vostad network as a continuously moving portrait archive.
 *
 * A native horizontal scroll container, not a carousel: swipe, trackpad and
 * keyboard scrolling all work for free, and the roster is rendered twice so
 * that advancing exactly one period puts an identical portrait under the
 * cursor — the loop has no seam to hide. With ten speakers and at most ~5 in
 * view, a portrait and its duplicate are never on screen together.
 *
 * The animation writes `scrollLeft` from a float accumulator rather than a CSS
 * keyframe, because a keyframe cannot be dragged, and re-reads the DOM when the
 * user moves the strip themselves. Nothing here re-renders React.
 */
function SpeakerStrip() {
  const scroller = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [held, setHeld] = useState(false);

  /** Distance from a portrait to its duplicate: the exact loop period. */
  const period = useCallback(() => {
    const node = scroller.current;
    const first = node?.children[0] as HTMLElement | undefined;
    const clone = node?.children[FINANCIAL_RAILS_LEADERS.length] as HTMLElement | undefined;
    return first && clone ? clone.offsetLeft - first.offsetLeft : 0;
  }, []);

  const wrap = useCallback(
    (value: number) => {
      const span = period();
      if (span <= 0) return value;
      return ((value % span) + span) % span;
    },
    [period],
  );

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    // Reduced motion keeps the strip — it simply stops driving it.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (held) return;

    let frame = 0;
    let last = performance.now();
    let position = node.scrollLeft;
    let written = position;

    const tick = (now: number) => {
      // A tab restored after minutes should not lurch forward.
      const elapsed = Math.min((now - last) / 1000, 0.05);
      last = now;
      // The user (or momentum) moved it: adopt their position, don't fight it.
      if (Math.abs(node.scrollLeft - written) > 1) position = node.scrollLeft;
      if (!dragging.current) {
        position = wrap(position + STRIP_SPEED * elapsed);
        node.scrollLeft = position;
        written = node.scrollLeft;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [held, wrap]);

  /* Mouse drag only. Touch and trackpad already scroll this natively, and
     intercepting them would replace good platform behaviour with worse. */
  const origin = useRef({ pointer: 0, scroll: 0 });

  return (
    <div
      ref={scroller}
      role="region"
      aria-label="Vostad network speakers"
      tabIndex={0}
      /* Hover deliberately does nothing here: the travel is continuous, and the
         only thing a pointer changes is the colour of the portrait it is over.
         The hold is keyed to an actual arrow-key press rather than to focus,
         because clicking to drag also focuses this container — and focus-visible
         is a browser heuristic, so keying off it risks a click leaving the strip
         stopped for good. A key press is unambiguous. */
      onKeyDown={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      onPointerDown={(event) => {
        if (event.pointerType !== "mouse") return;
        const node = scroller.current;
        if (!node) return;
        dragging.current = true;
        origin.current = { pointer: event.clientX, scroll: node.scrollLeft };
        node.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const node = scroller.current;
        if (!dragging.current || !node) return;
        node.scrollLeft = wrap(origin.current.scroll - (event.clientX - origin.current.pointer));
      }}
      onPointerUp={(event) => {
        dragging.current = false;
        scroller.current?.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      className={cn(
        "mt-8 flex gap-x-6 overflow-x-auto overscroll-x-contain lg:mt-10",
        "cursor-grab active:cursor-grabbing",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink",
      )}
    >
      {[...FINANCIAL_RAILS_LEADERS, ...FINANCIAL_RAILS_LEADERS].map((speaker, index) => {
        const duplicate = index >= FINANCIAL_RAILS_LEADERS.length;
        return (
          <figure
            key={`${speaker.name}-${index}`}
            /* The second pass exists only to close the loop; it is scenery,
               so it is hidden from assistive tech and the tab order. */
            {...(duplicate ? { "aria-hidden": true } : {})}
            /* A constant 1.5rem gutter at every width, so each slot is
               (100% − (N−1)·1.5rem)/N for N visible. N climbs to 6.4 on
               desktop, which is what makes the portraits compact: ~170px at
               1440 against the 202px they occupied as a five-up strip. */
            /* SLOT WIDTH IS DERIVED, NOT FIXED. Each slot is
               (100% − (N−1)·1.5rem)/N for N slots across the canvas, so the
               portrait is always a function of the available width rather than
               a hard-coded card count. N is chosen per breakpoint to keep the
               portrait large: it resolves to ~257px at 375, 244 at 768, 218 at
               1024, 221 at 1280, 224 at 1440 and 320 at 1920 — never the
               ~170px the previous 6.4-up strip produced at 1440. From 1440 the
               canvas comfortably carries five complete cards, which is where
               the roster reads as a gallery rather than a filmstrip. */
            /* Every step is an arbitrary `min-[]` variant rather than a mix of
               named and arbitrary ones. Tailwind emits arbitrary variants
               ahead of the named breakpoints, so a named `lg:`/`xl:` rule of
               equal specificity was winning over `min-[1440px]:` at 1440 and
               pinning the strip to the wrong slot count; written as one family
               they order by their own value and the widest matching step
               wins. */
            className={cn(
              "shrink-0 w-[calc((100%-0.375rem)/1.25)]",
              "min-[640px]:w-[calc((100%-1.8rem)/2.2)]",
              "min-[768px]:w-[calc((100%-2.4rem)/2.6)]",
              "min-[1024px]:w-[calc((100%-3.6rem)/3.4)]",
              "min-[1280px]:w-[calc((100%-5.1rem)/4.4)]",
              "min-[1440px]:w-[calc((100%-6rem)/5)]",
            )}
          >
            <div className="relative overflow-hidden bg-paper" style={{ aspectRatio: "4 / 5" }}>
              <picture className="contents">
                <source
                  type="image/avif"
                  srcSet={`${speaker.image}-400.avif 400w, ${speaker.image}-800.avif 800w`}
                  sizes="(min-width: 1440px) calc(20vw - 64px), (min-width: 1280px) calc(22.7vw - 70px), (min-width: 1024px) calc(29.4vw - 83px), (min-width: 768px) calc(38.5vw - 52px), (min-width: 640px) calc(45.5vw - 35px), calc(80vw - 43px)"
                />
                <img
                  src={`${speaker.image}-800.jpg`}
                  srcSet={`${speaker.image}-400.jpg 400w, ${speaker.image}-800.jpg 800w`}
                  sizes="(min-width: 1440px) calc(20vw - 64px), (min-width: 1280px) calc(22.7vw - 70px), (min-width: 1024px) calc(29.4vw - 83px), (min-width: 768px) calc(38.5vw - 52px), (min-width: 640px) calc(45.5vw - 35px), calc(80vw - 43px)"
                  alt={duplicate ? "" : speaker.name}
                  width={800}
                  height={1000}
                  loading="lazy"
                  draggable={false}
                  className="h-full w-full object-cover grayscale transition-[filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:grayscale-0 motion-reduce:transition-none"
                />
              </picture>
            </div>
            {/* The caption scales with the portrait: same display face, weight,
                case, leading and tracking as display-sm, on a smaller curve, so
                a 170px card is not carrying 22px type. */}
            {/* EVERY LINE RESERVES ITS OWN HEIGHT, so name, title and
                organisation sit on the same three baselines in every card and
                a longer title cannot push one card's block out of step with
                its neighbours. The reservations are in `em`, so they track the
                clamped type rather than assuming a pixel size, and the
                organisation line is always rendered — one leader's supplied
                filename names no organisation, and without the empty row that
                card's block would run short against the rest. */}
            <figcaption className="mt-4 border-t border-hairline pt-3">
              <p className="min-h-[2.04em] font-display text-[clamp(0.85rem,1.05vw,1.05rem)] font-bold uppercase leading-[1.02] tracking-[-0.015em] break-words">
                {speaker.name}
              </p>
              <p className="mt-1.5 min-h-[3.25em] text-xs leading-relaxed opacity-70">
                {speaker.title}
              </p>
              <p className="label mt-1.5 min-h-[1.5em] opacity-45">{speaker.company}</p>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
/** The widths that exist on disk for the hero photograph. */
const HERO_HOME_WIDTHS = [480, 768, 1024, 1400];

function Home() {
  return (
    <>
      <PageHero
        meta="MONEY · MARKETS · INFRASTRUCTURE · RULES"
        title={<SignatureHeadline />}
        /* Fitted, not chosen. "THE INFRASTRUCTURE" is the wide line at a
           measured 11.60em — far wider than the 10.05em the previous lockup
           was cut for — so the old 4.6vw wrapped it into two lines at every
           desktop width. The hero column is (0.62·(vw−96px) − 128px), which is
           447px at 1024 where it is tightest: 3.65vw puts the line at 433px
           there, a 3% margin, and it clears every width above. Below sm the
           column is (100vw − 48px) — 272px at 320px — and 7.2vw is what fits
           the same line inside it. */
        titleClassName="font-display max-w-[19ch] text-[clamp(1.1rem,7.2vw,2.25rem)] font-extrabold uppercase leading-[0.84] tracking-[-0.03em] sm:text-[clamp(2.25rem,3.65vw,5.75rem)]"
        lede="The institutions building, funding, regulating and operating the financial rails are already moving."
        body="An initiative by Vostad · Convening since 2014."
        actions={[
          { label: "Explore Forums", to: "/forums" },
          { label: "About Financial Rails", to: "/about" },
        ]}
        seed="dfa-hero"
        /* The standing image. Replaces the seeded picsum.photos placeholder
           the hero fell back to — a random stock frame — with the project's
           own photograph, encoded to the site's usual AVIF-first ladder.
           The master is a native 1400x1867, exactly the 3:4 the slot renders,
           so the frame is uncropped at every width. `sizes` is the measured
           track: the column is the full viewport below lg and
           (37.95vw - 37px) above it, which resolves to 352px at 1024,
           510px at 1440 and 692px at 1920. */
        image={{
          src: "/media/home/hero-home-1024.jpg",
          srcSet: HERO_HOME_WIDTHS.map((w) => `/media/home/hero-home-${w}.jpg ${w}w`).join(", "),
          avifSrcSet: HERO_HOME_WIDTHS.map((w) => `/media/home/hero-home-${w}.avif ${w}w`).join(
            ", ",
          ),
          sizes: "(min-width: 1024px) calc(37.95vw - 37px), 100vw",
          /* The placeholder's own frame: a locked 3:4 at every width, which is
             taller than the stretched default — 923px rather than 693px at
             1920. The master is a native 3:4, so the frame still crops nothing. */
          ratio: "3 / 4",
          alt: "Glass office towers rising above a financial district, photographed looking upward",
        }}
        figureTo="/forums/financial-rails-mena"
        figureLabel="Financial Rails MENA"
      />

      {/* One continuous proof of experience: the heading states the claim, the
          logos evidence the institutions, the portraits evidence the people.
          No rail label, no eyebrows and no rule between the two tracks — the
          tighter gap below the marquee than above it is what binds them into a
          single block. */}
      <Section>
        <TitleBlock
          title="Convening Since 2014"
          body="Bringing leaders, institutions and ideas together across industries and more than 50 countries — and running a dedicated financial-infrastructure programme since 2018."
        />
        <div className="mt-16">
          <NetworkMarquee rows={2} presence="quiet" />
        </div>
        {/* One Reveal for the whole strip: a per-portrait Reveal would key its
            IntersectionObserver to the viewport, so every portrait waiting off
            the right edge would stay hidden and then pop in as it travelled. */}
        <Reveal>
          <SpeakerStrip />
        </Reveal>
      </Section>

      {/* The world tour — the editions themselves, between the institution's
          record and the institution's architecture. */}
      <WorldTour />

      {/* The featured event — the flagship carries the homepage alone. The
          full portfolio still lives at /forums; this page names only the
          signature property. */}
      {/* The platform — the institution's architecture, before any single
          event. Four components, each a real page. */}
      <Section label="The Platform" tone="ink">
        <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="label accord-signal-invert opacity-70">The Platform</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="display-lg mt-8 max-w-[18ch]">Not one event. An institution.</h2>
            </Reveal>
          </div>
        </div>

        <div className="mt-16 border-t border-hairline-invert lg:mt-20">
          {PLATFORM.map((component, i) => (
            <Reveal key={component.name} delay={i * 80}>
              <Link
                to={component.to}
                className="group grid items-baseline gap-x-8 gap-y-3 border-b border-hairline-invert py-8 transition-opacity duration-500 hover:opacity-60 lg:grid-cols-12 lg:py-10"
              >
                <p className="label accord-signal-invert opacity-60 lg:col-span-1">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="display-md lg:col-span-5">{component.name}</h3>
                <p className="max-w-[52ch] text-base leading-relaxed opacity-70 lg:col-span-5 lg:col-start-7">
                  {component.body}
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section label="Mission" tone="ink" flush>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_28rem]">
          <div className="flex items-center bg-bone px-6 py-20 text-ink md:px-12 md:py-28 lg:px-16 lg:py-32">
            <Reveal>
              <div className="max-w-[52ch] text-[clamp(1.25rem,2.05vw,1.9rem)] leading-[1.4] tracking-[-0.01em]">
                <p>
                  Since 2018 we have convened leaders across 50+ countries around the forces
                  reshaping global markets.
                </p>
                <p className="mt-6">
                  From Blockchain for Banking and Blockchain for Sustainability to the Halal Economy
                  and multiple editions of the World Token Summit, that work kept arriving at the
                  same place.
                </p>
                <p className="mt-6">Not the products. The rails underneath them.</p>
                <p className="mt-6">
                  Payments, settlement, digital money and the rules around them are being rebuilt at
                  the same time, by institutions that rarely sit in one room.
                </p>
                <p className="mt-6">Financial Rails exists to put them there.</p>
              </div>
            </Reveal>
          </div>

          <div className="px-6 py-20 md:px-12 md:py-28 lg:px-12 lg:py-32">
            {MISSION_METRICS.map((metric, index) => (
              <Reveal
                key={metric.label}
                delay={index * 80}
                className={index > 0 ? "mt-14 border-t border-hairline-invert pt-14" : ""}
              >
                <p className="display-xl leading-none">{metric.value}</p>
                <p className="label mt-6 opacity-60">{metric.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <FinalCta
        title="The Rails Are Being Built Now."
        body="Join the institutions building, funding, regulating and operating the infrastructure money moves through."
        actions={[
          { label: "Explore Forums", to: "/forums" },
          { label: "About Financial Rails", to: "/about" },
        ]}
      />
    </>
  );
}
