import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AIAccordIcon } from "@/components/site/AIAccordIcon";
import { Reveal } from "@/components/site/Reveal";
import { Section } from "@/components/site/Section";
import { MicrositePhoto } from "@/components/site/MicrositePhoto";
import type { MicrositePhoto as MicrositePhotoData } from "@/lib/microsite-photography";
import { NetworkMarquee } from "@/components/site/NetworkMarquee";
import type { EventMicrositeData } from "@/lib/event-microsite";

/**
 * THE EVENT MICRO-SITE TEMPLATE — one composition, many editions.
 *
 * This is the Financial Rails Summit build, lifted verbatim into a component
 * so that every forum in the platform renders through the same file. The
 * markup, the grid, the type, the spacing, the photography treatment, the film
 * plate, the reveals, the hover grammar and the responsive behaviour are the
 * approved master exactly as it shipped; nothing here was redesigned when it
 * was generalised. The only change was replacing the handful of strings that
 * name a particular event with reads from the event data object.
 *
 * ONE PLATFORM, THREE FORUMS. An edition is a data module — see
 * src/lib/financial-rails-v2.ts, african-money-movement.ts and
 * india-digital-payments.ts — and a four-line route. Every edition shares the
 * same media: the same hero film, the same photography, the same speaker
 * roster and the same partner marks, because they are one institutional
 * family rather than three websites.
 *
 * THE HERO TYPE IS FITTED PER EDITION, not per taste. The lockup is sized so
 * its widest line clears the six-column track at the tightest width it runs
 * at, which is a function of the event's own name: "Rails Summit" measures
 * 7.23em in this face, "Money Movement" 9.80em and "Digital Payments &
 * Fintech" 15.15em. Each edition therefore carries its own clamp, derived
 * from that measurement with the master's own headroom, so all three sit at
 * the same optical weight in their column instead of one overflowing.
 */

/* ------------------------------------------------------------------ frame -- */

/**
 * THE CONTENT CANVAS — one horizontal grid for the whole micro-site.
 *
 * Every chapter renders through Section, whose content column sits to the
 * right of the 6rem editorial rail and carries its own padding: px-6 at base,
 * md:px-12, lg:px-16. So the canvas the hero title, the hero photograph, the
 * cinematic plate and every section already occupy is:
 *
 *   base   left 24px            right 100vw − 24px
 *   md     left 48px            right 100vw − 48px
 *   lg     left 96 + 64 = 160px right 100vw − 64px
 *
 * The header and footer previously used a centred max-w-[86rem] shell with
 * px-14, which put the logo at 88px from the viewport edge at 1440 and 328px
 * at 1920 — 72px and 168px inside the hero title. They now inherit the same
 * boundaries: pl-40 is exactly the rail plus lg:px-16, so the header logo, the
 * hero title, the video's left edge and the footer all begin on one line, and
 * the header CTA, the hero photograph, the video's right edge and the footer
 * all end on the other. No max-width, because the sections have none.
 *
 * The rail itself is untouched and remains outside this canvas.
 */
const CONTENT_CANVAS = "w-full px-6 md:px-12 lg:pl-40 lg:pr-16";

/* ----------------------------------------------------------------- pieces -- */

/**
 * One chapter on the home page's own rail. The index and name run vertically
 * down the bordered left margin, sticky as you read — Section is the home
 * page's component, so the treatment cannot drift from it.
 */
function Chapter({
  id,
  index,
  label,
  tone = "canvas",
  children,
}: {
  id?: string;
  index: string;
  label: string;
  tone?: "canvas" | "surface" | "dark";
  children: ReactNode;
}) {
  const tones = { canvas: "paper", surface: "bone", dark: "ink" } as const;
  return (
    <Section
      {...(id ? { id } : {})}
      label={`${index} — ${label}`}
      tone={tones[tone]}
      className="scroll-mt-24"
    >
      {children}
    </Section>
  );
}

/**
 * V2's button treatment. Orange is the interaction signal, never the resting
 * fill: a button sits in plain white or plain black until it is addressed,
 * and only then does the accent appear.
 *
 *   on dark    white / black   →   black / orange
 *   on light   black / white   →   orange / black
 *
 * The two quiet variants stay outlines — they must never read as louder than
 * the primary — and take the same signal on hover, drawn in the deep orange
 * on light ground because the bright one measures 3.48:1 there and fails AA
 * at the 11px these labels are set in. Only colour moves: no transform, no
 * shadow, no lift. Tailwind gates `hover:` behind `(hover: hover)`, so a
 * touch device never leaves the neutral resting state.
 */
function Cta({
  children,
  to = "/contact",
  tone = "onDark",
  className,
}: {
  children: ReactNode;
  to?: string;
  tone?: "onDark" | "onLight" | "quietDark" | "quietLight";
  className?: string;
}) {
  const styles = {
    onDark: "bg-paper text-ink hover:bg-ink hover:text-accent focus-visible:outline-accent",
    onLight: "bg-ink text-paper hover:bg-accent hover:text-ink focus-visible:outline-ink",
    quietDark:
      "border border-hairline-invert text-paper hover:border-accent hover:text-accent focus-visible:outline-accent",
    quietLight:
      "border border-ink/25 text-ink hover:border-[var(--accord-orange-deep)] hover:text-[var(--accord-orange-deep)] focus-visible:outline-ink",
  } as const;
  return (
    <Link
      to={to}
      className={cn(
        "label inline-flex items-center gap-3 px-7 py-4 transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none",
        styles[tone],
        className,
      )}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

/** V2's own sticky navigation. */
function SummitNav({ nav }: { nav: EventMicrositeData["nav"] }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 text-paper transition-[background-color,border-color] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          scrolled || open
            ? "border-b border-hairline-invert bg-ink/95 backdrop-blur-md"
            : "bg-transparent",
        )}
      >
        <div className={cn(CONTENT_CANVAS, "flex items-center justify-between gap-6 py-4")}>
          <a
            href="#top"
            onClick={() => setOpen(false)}
            className="group flex shrink-0 items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
          >
            <AIAccordIcon className="h-7" onPhotography={!scrolled} />
            <span className="font-display whitespace-nowrap text-xs font-extrabold uppercase leading-[0.95] tracking-tight">
              Digital Finance
              <br />
              Alliance
            </span>
          </a>

          <nav aria-label="Summit sections" className="hidden items-center gap-7 lg:flex">
            {nav.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="label opacity-65 transition-opacity duration-500 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper motion-reduce:transition-none"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              to="/contact"
              className="label hidden whitespace-nowrap bg-paper px-5 py-3 text-ink transition-colors duration-200 hover:bg-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:block motion-reduce:transition-none"
            >
              Request an Invitation <span aria-hidden>→</span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              className="label border border-hairline-invert px-4 py-3 transition-colors duration-500 hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper lg:hidden motion-reduce:transition-none"
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink text-paper transition-[opacity,visibility] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] lg:hidden motion-reduce:transition-none",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        <nav
          aria-label="Summit sections"
          className={cn(CONTENT_CANVAS, "flex h-full flex-col justify-center")}
        >
          {nav.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => setOpen(false)}
              className="display-md border-b border-hairline-invert py-4 transition-opacity duration-500 hover:opacity-50 motion-reduce:transition-none"
            >
              {item.label}
            </a>
          ))}
          <Link
            to="/contact"
            onClick={() => setOpen(false)}
            className="label mt-10 inline-flex items-center gap-3 self-start bg-paper px-6 py-4 text-ink transition-colors duration-200 hover:bg-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none"
          >
            Request an Invitation <span aria-hidden>→</span>
          </Link>
        </nav>
      </div>
    </>
  );
}

/**
 * V2's own photo delivery, used where a frame runs in a slot the shared photo
 * library was not measured for. Same files, same AVIF-first / JPEG-fallback
 * shape, same lazy + async decode — only the `sizes` describes V2's grid. It
 * takes the descriptor whole, so swapping the asset is a one-line data edit.
 */
function V2Photo({ photo, className }: { photo: MicrositePhotoData; className?: string }) {
  const set = (ext: string) =>
    photo.widths.map((w) => `${photo.base}-${w}.${ext} ${w}w`).join(", ");
  return (
    <picture className="contents">
      <source type="image/avif" srcSet={set("avif")} sizes={photo.sizes} />
      <img
        src={`${photo.base}-1280.jpg`}
        srcSet={set("jpg")}
        sizes={photo.sizes}
        alt={photo.alt}
        width={photo.intrinsic.width}
        height={photo.intrinsic.height}
        loading="lazy"
        decoding="async"
        className={cn("absolute inset-0 h-full w-full object-cover", className)}
      />
    </picture>
  );
}

/**
 * V2's hero film.
 *
 * Local rather than the shared EventHeroVideo, because that component plays
 * the site-wide `/media/hero-events.mp4` that V1 and every other micro-site
 * depend on — swapping the source there would have changed all of them.
 *
 * Grayscale rests on the element and lifts on direct hover of the video
 * itself, never of the hero around it. `preload="metadata"` keeps the 3.3 MB
 * off the critical path: the poster paints immediately and the film streams
 * progressively behind it, and the moov atom sits before the mdat so playback
 * can start on a prefix. Reduced motion pauses it and drops the autoplay
 * attribute, leaving the poster as a still hero.
 */
function V2HeroFilm({ film }: { film: EventMicrositeData["heroFilm"] }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (query.matches) {
        video.pause();
        video.currentTime = 0;
        video.removeAttribute("autoplay");
      } else {
        void video.play().catch(() => {});
      }
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return (
    <video
      ref={ref}
      aria-hidden
      tabIndex={-1}
      src={film.src}
      poster={film.poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      disablePictureInPicture
      className="absolute inset-0 h-full w-full object-cover grayscale transition-[filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:grayscale-0 motion-reduce:transition-none"
    />
  );
}

/**
 * The hero's desktop-only photograph.
 *
 * Both <source> elements are gated to the lg breakpoint, so below it nothing
 * matches and the browser falls through to the <img>'s own src — an inline
 * transparent pixel that costs no request. A phone therefore never downloads
 * the frame, which `hidden lg:block` on the figure alone could not guarantee:
 * a display:none subtree still fetches its images in most browsers.
 *
 * Grayscale is the resting state; hover brings the colour back, and
 * focus-within on the hero does the same for a keyboard reader tabbing to the
 * invitation. Only the filter moves — no scale, no opacity, no drift.
 */
const BLANK_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function V2HeroPhoto({ photo }: { photo: MicrositePhotoData }) {
  const set = (ext: string) =>
    photo.widths.map((w) => `${photo.base}-${w}.${ext} ${w}w`).join(", ");
  return (
    <picture className="contents">
      <source
        media="(min-width: 1024px)"
        type="image/avif"
        srcSet={set("avif")}
        sizes={photo.sizes}
      />
      <source
        media="(min-width: 1024px)"
        type="image/jpeg"
        srcSet={set("jpg")}
        sizes={photo.sizes}
      />
      <img
        src={BLANK_PIXEL}
        alt={photo.alt}
        width={photo.intrinsic.width}
        height={photo.intrinsic.height}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover grayscale transition-[filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:grayscale-0 motion-reduce:transition-none"
      />
    </picture>
  );
}

/**
 * 04 — the historical mark field. Marks rest on the open ground at generous
 * intervals — no slots, no boxes, monochrome, travelling slowly. The track
 * renders twice because the shared keyframe translates -50%; the second pass
 * is hidden from assistive technology so the roster is announced once. Under
 * reduced motion the shared stylesheet stops the animation and the strip
 * becomes horizontally scrollable instead of stranding the tail.
 */
/**
 * 04 — the historical mark field: the shared Digital Finance Alliance network,
 * replayed on this chapter's dark ground as historical proof. Same component,
 * same eighty-mark source of truth as the homepage's network section — the
 * two surfaces can never disagree. The dark tone applies the chapter's
 * established non-destructive luminance inversion; the copy above the field
 * still frames every mark as history, not current sponsorship.
 */
function PartnerField() {
  return <NetworkMarquee tone="dark" rows={2} />;
}

/**
 * 05 — the card's width, as arithmetic rather than estimate.
 *
 * The grid runs two equal columns with a 48px gutter at lg and 40px at md,
 * inside a content column that is the viewport less the 96px rail and 128px of
 * padding. So a card measures (100vw − 224 − 48) / 2 = 50vw − 136px at lg,
 * (100vw − 96 − 40) / 2 = 50vw − 68px at md, and the full content width once
 * the grid collapses to one column.
 *
 * This overrides the shared library's `sizes`, which describes the master
 * template's 6/5/4-column slots and a full-bleed plate — none of which matches
 * this card. The override is a spread onto a fresh object, so the shared
 * photography set is read and never mutated.
 */
const CARD_SIZES =
  "(min-width: 1024px) calc(50vw - 136px), (min-width: 768px) calc(50vw - 68px), calc(100vw - 48px)";

/**
 * 05 — the frame band, and where each photograph is cut inside it.
 *
 * A FIXED HEIGHT, NOT A RATIO. Every frame in the field is exactly the same
 * height at a given width, which is what makes the four cards read as one
 * composition rather than four objects of different sizes; an aspect ratio
 * would make each frame's height track its card's width and grow unchecked at
 * 1920. The heights are deterministic and known before any file arrives, so
 * the band reserves its own space and nothing shifts.
 *
 * OBJECT-POSITION IS PER SOURCE. The band is wider than any of the four
 * masters, so all of them are cropped vertically, and a blind centre crop cuts
 * heads on the frames whose subjects sit high. Each card therefore declares
 * where its own crop is anchored — measured against the actual photographs,
 * not guessed.
 */
const EXPERIENCE_CARDS = [
  /* KEYNOTE. The speaker stands at the lectern on the left of frame and the
     presentation screen fills the right, so the band is pulled left of centre
     to keep the speaker clear of the crop where the card narrows and crops
     horizontally, and sits just below the midline to hold both the speaker's
     head and the screen's content in the wide desktop band. */
  { focus: "object-[45%_52%]" },
  /* NETWORKING. Two delegates in conversation, their heads in the upper half;
     the nearer figure runs to the left edge, so the band is anchored high and
     slightly left to keep both faces whole at every ratio. */
  { focus: "object-[45%_38%]" },
  /* PANEL. The speakers are seated mid-frame with the panel's screen above
     them and the audience below; anchoring just above centre holds the screen
     and the panel together and trims the foreground seating. */
  { focus: "object-[center_45%]" },
  /* AGENDA. Delegates working at the tables, faces below the midline; the top
     of the frame is empty room, so the band is dropped to spend its height on
     the working tables rather than the ceiling. */
  { focus: "object-[center_55%]" },
] as const;

/* ------------------------------------------------------------------- page -- */

export function EventMicrosite({ event }: { event: EventMicrositeData }) {
  const {
    nav: V2_NAV,
    heroFilm: V2_HERO_FILM,
    heroImage: V2_HERO_IMAGE,
    whyImage: V2_WHY_IMAGE,
    roomImage: V2_ROOM_IMAGE,
    why: V2_WHY,
    roomFigures: V2_ROOM_FIGURES,
    roomFilters: V2_ROOM_FILTERS,
    roomClose: V2_ROOM_CLOSE,
    speakers: V2_SPEAKERS,
    partnersStatement: V2_PARTNERS_STATEMENT,
    experience: V2_EXPERIENCE,
    outputIndex: V2_OUTPUT_INDEX,
    invitation: V2_INVITATION,
  } = event;
  const V2_EVENT = event.event;
  return (
    <div>
      <SummitNav nav={V2_NAV} />

      {/* 01 — FINANCIAL RAILS · the editorial cover. Left page: the event
          identity and the one door, optically centred against the artwork.
          Right page: a single photograph, large enough to be the counterweight
          to the type — no text, no figures, no frame on it. The film plate
          below is untouched, so the still cover gives way to the moving one. */}
      <Chapter id="top" index="01" label={event.heroLabel} tone="dark">
        <div className="pt-10 lg:pt-16">
          <div className="grid gap-y-14 lg:grid-cols-12 lg:items-center lg:gap-x-12">
            {/* EVENT IDENTITY. */}
            <div className="min-w-0 lg:col-span-6">
              {/* "RAILS SUMMIT" is the wide line at a measured 7.23em, so it
                  sets the ceiling, not "FINANCIAL". Below lg it runs against
                  (100vw − 48px): 11vw holds from 320px up. At lg the
                  six-column track binds — 376px at 1024 is its tightest,
                  where 4.7vw leaves 8% of margin. */}
              <Reveal>
                {/* Plain concatenation, not cn(): tailwind-merge treats an
                    arbitrary text-[...] as a font-size, and a font-size wins
                    over a preceding leading-*, so merging silently dropped
                    leading-[0.84] from the lockup. */}
                <h1
                  className={`font-display font-extrabold uppercase leading-[0.84] tracking-[-0.035em] ${event.heroTitleClass}`}
                >
                  {event.heroTitle[0]}
                  <br />
                  {event.heroTitle[1]}
                </h1>
              </Reveal>
              <Reveal delay={110}>
                <p className="display-md mt-10 max-w-[24ch] opacity-90">{V2_EVENT.positioning}</p>
              </Reveal>
              <Reveal delay={180} className="mt-12 border-t border-hairline-invert pt-8">
                <p className="display-sm">{V2_EVENT.dates}</p>
                <p className="label mt-2 opacity-65">{V2_EVENT.city}</p>
              </Reveal>
              <Reveal delay={240} className="mt-10">
                <Cta>Request an Invitation</Cta>
              </Reveal>
            </div>

            {/* THE PROOF. Desktop only — the mobile hero is text, then the
                film. A 16:9 frame matches the source exactly, so the room
                loses no depth, and the ratio reserves the box before the file
                lands, so nothing shifts. */}
            <Reveal delay={160} className="hidden min-w-0 lg:col-span-6 lg:col-start-7 lg:block">
              <figure className="relative aspect-[16/9] w-full overflow-hidden bg-ink">
                <V2HeroPhoto photo={V2_HERO_IMAGE} />
              </figure>
            </Reveal>
          </div>

          {/* The plate. The film is natively 16:9; the frame widens to 21:9
              at lg for the cinematic cut — a vertical crop that keeps every
              horizontal pixel. The ratio reserves the box before the poster
              arrives, so nothing shifts. */}
          <Reveal delay={180} className="mt-14 lg:mt-20">
            <figure className="relative aspect-[16/9] w-full overflow-hidden bg-ink lg:aspect-[21/9]">
              <V2HeroFilm film={V2_HERO_FILM} />
            </figure>
          </Reveal>
        </div>
      </Chapter>

      {/* 02 — WHY BE IN THE ROOM · a magazine spread. The left page is the
          whole argument — headline, the couplet on its own rules, the
          verdict, the door. The right page is one photograph and nothing
          else: no caption, no frame, no card.

          The figure holds a true 4:5 — the source's own ratio, so zero crop —
          and travels with the reader instead of stretching to the argument's
          height. Stretching aligned the two floors exactly at 1440 but turned
          the frame landscape at 1920 (1:0.94, throwing away a quarter of a
          portrait photograph). Sticky keeps it portrait at every width and
          still leaves no pool of empty margin. */}
      <Chapter id="why" index="02" label="Why Be in the Room">
        <div className="grid gap-y-14 lg:grid-cols-12 lg:gap-x-12">
          <div className="min-w-0 lg:col-span-6">
            <Reveal>
              <h2 className="display-lg max-w-[22ch]">{V2_WHY.heading}</h2>
            </Reveal>
            <Reveal delay={100}>
              <div className="mt-12 border-t border-hairline">
                {V2_WHY.couplet.map((line) => (
                  <p key={line} className="display-md max-w-[24ch] border-b border-hairline py-9">
                    {line}
                  </p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={200}>
              <p className="accord-hairline display-md mt-14 max-w-[22ch] border-t pt-9">
                {V2_WHY.close}
              </p>
            </Reveal>
            <Reveal delay={260} className="mt-12">
              <Cta tone="quietLight">Become Our Partner</Cta>
            </Reveal>
          </div>

          <Reveal delay={160} className="min-w-0 lg:col-span-6 lg:col-start-7">
            <figure className="relative aspect-[4/5] w-full overflow-hidden bg-bone lg:sticky lg:top-28">
              <V2Photo
                photo={V2_WHY_IMAGE}
                className="grayscale transition-[filter] duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:grayscale-0 motion-reduce:transition-none"
              />
            </figure>
          </Reveal>
        </div>
      </Chapter>

      {/* 03 — THE ROOM · a light editorial chapter, and the page's deliberate
          pause. The ledger reads at a glance: four figures in one horizontal
          row on four equal tracks divided by hairlines — an annual-report
          table, not four cards. Then the three refusals as the filter, then
          one sentence and the door.

          The ground is the brand's surface rather than its canvas. Chapters 02
          and 04 either side are already canvas, so canvas here would run three
          identical light sections together; surface makes this read as its own
          chapter — the paper stock changes — while still being a brand light
          background. The figures drop the signal colour and take primary ink,
          leaving the accent to the one rule beside the refusals. */}
      <Chapter id="the-room" index="03" label="The Room" tone="surface">
        <Reveal>
          <h2 className="display-lg max-w-[20ch]">{event.roomHeading}</h2>
        </Reveal>

        {/* One rule over the row, one under it, and a hairline between each
            track. Four across at lg; two-by-two below, where the same
            even-child rule draws the single divider. The number is sized so
            its widest string clears the narrowest track — 170px at 1024. */}
        <Reveal delay={100}>
          <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-12 border-y border-hairline py-12 lg:mt-16 lg:grid-cols-4 lg:gap-x-10 lg:py-14">
            {V2_ROOM_FIGURES.map((figure) => (
              <div
                key={figure.value}
                className="min-w-0 border-hairline [&:nth-child(even)]:border-l [&:nth-child(even)]:pl-6 lg:border-l lg:pl-8 lg:first:border-l-0 lg:first:pl-0"
              >
                <p className="font-display text-[clamp(2.5rem,5vw,5rem)] font-extrabold leading-[0.85] tracking-[-0.04em]">
                  {figure.value}
                </p>
                <p className="mt-5 text-sm leading-relaxed opacity-80">{figure.line}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* The filter and the proof, as one spread: the three refusals and
            the closing sentence on the left page, the room itself on the
            right — the photograph the statements are describing, at the
            source's own 16:9 so nothing is cropped. No caption, no card, no
            door: the invitation chapter carries the conversion. */}
        <div className="mt-14 grid gap-y-10 lg:mt-16 lg:grid-cols-12 lg:items-center lg:gap-x-12">
          <div className="min-w-0 lg:col-span-6">
            <Reveal delay={160}>
              <div className="accord-hairline border-l-2 pl-8 lg:pl-12">
                {V2_ROOM_FILTERS.map((line) => (
                  <p key={line} className="display-lg py-2">
                    {line}
                  </p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={220}>
              <p className="lede mt-8 max-w-[44ch] opacity-80">{V2_ROOM_CLOSE}</p>
            </Reveal>
          </div>
          <Reveal delay={200} className="min-w-0 lg:col-span-6 lg:col-start-7">
            <figure className="relative aspect-video w-full overflow-hidden bg-ink">
              <V2Photo
                photo={V2_ROOM_IMAGE}
                className="grayscale transition-[filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:grayscale-0 motion-reduce:transition-none"
              />
            </figure>
          </Reveal>
        </div>
      </Chapter>

      {/* 04 — THE PEOPLE · one dark proof chapter. A staggered portrait
          gallery — alternate columns drop, so the grid reads as a curated wall
          rather than a card sheet — running straight on into an open field of
          historical marks, with hairline rules rather than a change of ground
          separating the two. The archive is the argument, so the ground goes
          dark and everything on it stays light: the accent is spent only on
          the two labels and each speaker's organisation. */}
      <Chapter id="the-people" index="04" label="The People" tone="dark">
        <Reveal>
          <h2 className="display-lg max-w-[22ch]">{event.peopleHeading}</h2>
        </Reveal>

        <Reveal delay={90} className="mt-16 border-t border-hairline-invert pt-9">
          <h3 className="label accord-signal-invert">Previous Speakers</h3>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-20">
          {V2_SPEAKERS.map((person, i) => (
            <Reveal
              key={person.name}
              delay={(i % 4) * 70}
              className={cn(i % 2 === 1 && "lg:relative lg:top-14")}
            >
              <div className="relative overflow-hidden bg-ink" style={{ aspectRatio: "4 / 5" }}>
                <picture className="contents">
                  <source
                    type="image/avif"
                    srcSet={`${person.image}-400.avif 400w, ${person.image}-800.avif 800w`}
                    sizes="(min-width: 1024px) 22vw, (min-width: 640px) 44vw, 88vw"
                  />
                  <img
                    src={`${person.image}-800.jpg`}
                    srcSet={`${person.image}-400.jpg 400w, ${person.image}-800.jpg 800w`}
                    sizes="(min-width: 1024px) 22vw, (min-width: 640px) 44vw, 88vw"
                    alt={[person.name, person.title, person.company].filter(Boolean).join(", ")}
                    width={800}
                    height={1000}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover grayscale transition-[filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:grayscale-0 motion-reduce:transition-none"
                  />
                </picture>
              </div>
              <p className="font-display mt-6 text-lg font-extrabold uppercase leading-[1.05] tracking-[-0.01em]">
                {person.name}
              </p>
              <p className="mt-2 text-sm leading-snug opacity-75">{person.title}</p>
              {person.company ? (
                <p className="label accord-signal-invert mt-3">{person.company}</p>
              ) : null}
            </Reveal>
          ))}
        </div>

        <Reveal delay={90} className="mt-24 border-t border-hairline-invert pt-9 lg:mt-32">
          <h3 className="label accord-signal-invert">Previous Partners</h3>
        </Reveal>
        <Reveal delay={140}>
          <p className="display-md mt-8 max-w-[26ch]">{V2_PARTNERS_STATEMENT}</p>
        </Reveal>

        <div className="mt-12">
          <PartnerField />
        </div>
      </Chapter>

      {/* 05 — THE EXPERIENCE · a dense two-column editorial field. The four
          experiences are one composition, not four moments read one at a
          time: a 2×2 grid of complete cards, each a photograph with its own
          number, title and copy directly beneath it.

          WHY THE FIELD REPLACED THE ROWS. The alternating full-width rows put
          one experience on screen at a time and left the short copy floating
          beside a tall frame; the emptiness was structural, not a padding
          value. Here the frames run a fixed band, the copy sits against the
          picture it belongs to, and two cards occupy every screen — so the
          chapter reads as one field with no half-screen gaps in it.

          NO BOXES. The cards carry no border, fill or radius. The only rules
          are the two editorial hairlines the brief asks for: heading to grid,
          and row one to row two. Below md the grid is one column and the rule
          falls between every card instead.

          The Output closes the field as its fourth card, inside the same grid,
          and carries the sequence's own index, 04, exactly as briefed — it
          stays in this chapter because the page's rail 04 is The People and
          the Invitation must remain 06.

          HOVER IS THE PICTURE. The reveal class lands on the <img>, which fills
          its frame absolutely, so colour returns under the photograph and
          nowhere else — not the card, not the type, not the ground. Tailwind
          gates `hover:` behind (hover: hover), so a touch device never enters
          the colour state. Only the filter moves. */}
      <Chapter id="the-experience" index="05" label="The Experience" tone="surface">
        <Reveal>
          <h2 className="display-lg max-w-[22ch]">{event.experienceHeading}</h2>
        </Reveal>

        {/* The heading's own rule, and the grid immediately under it. */}
        <div className="mt-8 grid gap-x-10 gap-y-10 border-t border-hairline pt-9 md:grid-cols-2 lg:gap-x-12 lg:gap-y-12">
          {V2_EXPERIENCE.map((exp, i) => {
            const card = EXPERIENCE_CARDS[i];
            if (!exp.photo || !card) return null;
            const isOutput = i === 3;

            return (
              <Reveal
                key={exp.index}
                delay={(i % 2) * 90}
                className={cn(
                  /* One column: a rule above every card but the first. Two
                     columns: only above the second row, so the field carries
                     exactly the two hairlines it was specified with. */
                  i > 0 && "border-t border-hairline pt-8 md:border-t-0 md:pt-0",
                  i >= 2 && "md:border-t md:border-hairline md:pt-10 lg:pt-12",
                )}
              >
                <article className="flex h-full flex-col">
                  {/* The band: one height across all four cards at any given
                      width, so the field reads as a composition. */}
                  <figure className="relative h-[212px] w-full overflow-hidden bg-ink sm:h-[236px] lg:h-[252px] xl:h-[284px]">
                    <MicrositePhoto
                      photo={{ ...exp.photo, sizes: CARD_SIZES }}
                      className={cn(
                        card.focus,
                        "grayscale transition-[filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:grayscale-0 motion-reduce:transition-none",
                      )}
                    />
                  </figure>

                  <div className="mt-6 flex items-baseline gap-x-4">
                    <p className="accord-signal font-display text-[clamp(1.5rem,1.9vw,1.95rem)] font-extrabold leading-[0.82] tracking-[-0.035em]">
                      {exp.index}
                    </p>
                    {isOutput ? <p className="label opacity-55">The Output</p> : null}
                  </div>
                  <h3 className="mt-3 font-display text-[clamp(1.25rem,1.65vw,1.6rem)] font-extrabold uppercase leading-[1.02] tracking-[-0.02em]">
                    {exp.title}
                  </h3>
                  <p className="mt-3 max-w-[54ch] text-sm leading-relaxed opacity-75">{exp.body}</p>

                  {isOutput ? (
                    <>
                      {/* The index, set at the card's own scale rather than the
                          section's: in display-sm the four words measure 642px
                          and cannot sit on one line inside a card. Spacing comes
                          from the container's gap so a wrapped line starts flush
                          at the card edge, and the dividing rules are carried
                          only from xl — the four words measure 434px with rules
                          and the card is 376px at 1024, so below xl the strip
                          wraps and a rule on the second line's first word would
                          hang off nothing. */}
                      <ul className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                        {V2_OUTPUT_INDEX.map((word, j) => (
                          <li
                            key={word}
                            className={cn(
                              "font-display text-sm font-extrabold uppercase tracking-[-0.01em]",
                              j > 0 && "xl:border-l xl:border-ink/25 xl:pl-4",
                            )}
                          >
                            {word}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-6">
                        <Cta tone="onLight">Request an Invitation</Cta>
                      </div>
                    </>
                  ) : null}
                </article>
              </Reveal>
            );
          })}
        </div>
      </Chapter>

      {/* 06 — THE INVITATION · the closing plate. One statement at full
          scale, the schedule, one dominant door and one quiet one. */}
      <Chapter id="the-invitation" index="06" label="The Invitation" tone="dark">
        <div className="py-6 lg:py-16">
          <Reveal>
            <h2 className="display-md max-w-[26ch] opacity-80">{V2_INVITATION.heading}</h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="mt-9 max-w-[13ch] font-display text-[clamp(2rem,10.4vw,3.2rem)] font-extrabold uppercase leading-[0.85] tracking-[-0.035em] sm:text-[clamp(3.2rem,7.8vw,8rem)]">
              {V2_INVITATION.line}
            </p>
          </Reveal>

          <div className="mt-16 grid items-end gap-y-10 border-t border-hairline-invert pt-10 lg:mt-24 lg:grid-cols-12 lg:gap-x-12">
            <Reveal delay={160} className="lg:col-span-6">
              <p className="display-sm">{V2_EVENT.dates}</p>
              <p className="label mt-2 opacity-65">{V2_EVENT.city}</p>
              <p className="mt-8 max-w-[44ch] text-base leading-relaxed opacity-75">
                {V2_INVITATION.body}
              </p>
            </Reveal>
            <Reveal
              delay={220}
              className="flex flex-wrap items-center gap-x-7 gap-y-5 lg:col-span-6 lg:justify-end"
            >
              <Cta>Request an Invitation</Cta>
              <Cta tone="quietDark">Become a Partner</Cta>
            </Reveal>
          </div>
        </div>
      </Chapter>

      {/* FOOTER */}
      <footer className="border-t border-hairline-invert bg-ink pb-10 pt-20 text-paper">
        <div className={CONTENT_CANVAS}>
          <p className="label opacity-65">Digital Finance Alliance</p>
          <p className="font-display mt-5 text-[clamp(1.8rem,4.6vw,4.2rem)] font-extrabold uppercase leading-[0.87] tracking-[-0.03em]">
            {V2_EVENT.name}
          </p>
          {/* Editions that supply no descriptor of their own inherit the
              master's, per the platform's own copy. */}
          <p className="mt-5 max-w-md text-sm leading-relaxed opacity-70">{V2_EVENT.footerLine}</p>

          <div className="mt-16 grid gap-y-12 border-t border-hairline-invert pt-12 sm:grid-cols-2 lg:grid-cols-3">
            <nav aria-label="Explore">
              <p className="label accord-signal-invert">Explore</p>
              <ul className="mt-5 space-y-3">
                {[
                  { label: "The Room", href: "#the-room" },
                  { label: "The People", href: "#the-people" },
                  { label: "The Experience", href: "#the-experience" },
                ].map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-sm opacity-75 transition-opacity duration-500 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper motion-reduce:transition-none"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Participate">
              <p className="label accord-signal-invert">Participate</p>
              <ul className="mt-5 space-y-3">
                {["Request an Invitation", "Request a Private Meeting", "Partner"].map((item) => (
                  <li key={item}>
                    <Link
                      to="/contact"
                      className="text-sm opacity-75 transition-opacity duration-500 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper motion-reduce:transition-none"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <p className="label accord-signal-invert">Presented by Digital Finance Alliance</p>
              <ul className="mt-5 space-y-3">
                <li>
                  <Link
                    to="/"
                    className="text-sm opacity-75 transition-opacity duration-500 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper motion-reduce:transition-none"
                  >
                    <span aria-hidden>←</span> Back to Digital Finance Alliance
                  </Link>
                </li>
                <li>
                  <Link
                    to="/forums"
                    className="text-sm opacity-75 transition-opacity duration-500 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper motion-reduce:transition-none"
                  >
                    All Digital Finance Alliance Forums <span aria-hidden>→</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-3 border-t border-hairline-invert pt-6 md:flex-row md:items-center md:justify-between">
            <p className="label opacity-55">
              © 2026 Digital Finance Alliance. All Rights Reserved.
            </p>
            <p className="label opacity-55">
              Privacy <span className="mx-2">|</span> Terms
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
