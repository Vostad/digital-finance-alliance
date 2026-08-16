import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/site/PageHero";
import { Section } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { NetworkMarquee } from "@/components/site/NetworkMarquee";
import { MicrositePhoto } from "@/components/site/MicrositePhoto";
import { DIGITAL_ASSET_ACCORD_LEADERS } from "@/lib/digital-asset-accord-leaders";
import { MICROSITE_PHOTOS } from "@/lib/microsite-photography";
import { Action, FinalCta, TitleBlock } from "@/components/site/primitives";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Digital Finance Alliance — Where Institutions Meet Digital Assets" },
      {
        name: "description",
        content:
          "Executive forums, private networks and leadership communities advancing institutional adoption of real digital assets.",
      },
      {
        property: "og:title",
        content: "Digital Finance Alliance — Where Institutions Meet Digital Assets",
      },
      {
        property: "og:description",
        content:
          "Executive forums, private networks and leadership communities advancing institutional adoption of real digital assets.",
      },
    ],
  }),
  component: Home,
});

const MISSION_METRICS = [
  { value: "7+", label: "Years" },
  { value: "10+", label: "Niche Events" },
];

/**
 * The Digital Finance Alliance signature device: one statement, one changing final word.
 *
 *   AI IS GOING PHYSICAL.  →  AI IS GOING VERTICAL.
 *
 * "AI IS GOING" never moves. The word sits in a masked slot measured against
 * BOTH words, so the slot is as wide and as tall as the widest of them and the
 * headline cannot reflow, resize or shift the copy beneath it.
 *
 * The track carries a third item duplicating the first, so every transition
 * slides upward — the word always exits up and the next enters from below. The
 * final step renders the same glyphs as the first, which makes the reset back
 * to zero invisible; the transition is disarmed for exactly that one frame.
 *
 * Two lines at every breakpoint, deliberately: one line needs 743px against
 * the 705px hero column at 1440, and would only fit past roughly 1900px — a
 * lockup that flips between one and two lines is not a signature.
 */
const HEADLINE_WORDS = ["programmable.", "tokenized."];
const HEADLINE_TRACK = [...HEADLINE_WORDS, HEADLINE_WORDS[0]];
const HEADLINE_DWELL_MS = 3600;
const HEADLINE_SLIDE_MS = 620;

function SignatureHeadline() {
  const [step, setStep] = useState(0);
  const [snapping, setSnapping] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced) return;
    // The duplicate step exists only for the length of one slide.
    if (step === HEADLINE_TRACK.length - 1) {
      const reset = setTimeout(() => {
        setSnapping(true);
        setStep(0);
      }, HEADLINE_SLIDE_MS);
      return () => clearTimeout(reset);
    }
    const advance = setTimeout(() => setStep((s) => s + 1), HEADLINE_DWELL_MS);
    return () => clearTimeout(advance);
  }, [step, reduced]);

  // Re-arm the transition a frame after the invisible reset, never during it.
  useEffect(() => {
    if (!snapping) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setSnapping(false)));
    return () => cancelAnimationFrame(raf);
  }, [snapping]);

  return (
    <>
      {/* The whole signature is spoken once; the animation carries no meaning
          a screen reader would otherwise miss. */}
      <span className="sr-only">Money is going programmable. Money is going tokenized.</span>{" "}
      <span aria-hidden>
        Money is going
        <br />
        <span className="relative block overflow-hidden">
          {/* Invisible measure — both words stacked in one grid cell, so the
              slot takes the width and height of the wider one. */}
          <span className="invisible grid">
            {HEADLINE_WORDS.map((word) => (
              <span key={word} className="col-start-1 row-start-1 block">
                {word}
              </span>
            ))}
          </span>
          <span
            className={cn(
              "absolute inset-0 block",
              !snapping &&
                "transition-transform duration-[620ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
            )}
            style={{ transform: `translateY(-${(reduced ? 0 : step) * 100}%)` }}
          >
            {HEADLINE_TRACK.map((word, i) => (
              <span key={`${word}-${i}`} className="block h-full">
                {word}
              </span>
            ))}
          </span>
        </span>
      </span>
    </>
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
    const clone = node?.children[DIGITAL_ASSET_ACCORD_LEADERS.length] as HTMLElement | undefined;
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
      {[...DIGITAL_ASSET_ACCORD_LEADERS, ...DIGITAL_ASSET_ACCORD_LEADERS].map((speaker, index) => {
        const duplicate = index >= DIGITAL_ASSET_ACCORD_LEADERS.length;
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
/**
 * THE FEATURED SUMMIT — the flagship, presented as the homepage's one dark
 * editorial spread. Five things and nothing else: what it is, why it matters,
 * when, where, and the one door in. The visitor should be able to answer all
 * five within seconds, so everything that was competing with them — the
 * "Invitation Only" tag, the five-rail taxonomy line, the delegate count and
 * the second CTA — is gone.
 *
 * A REAL ROOM, NOT A STOCK PHOTOGRAPH. The frame this module used to carry was
 * an external stock picture of glass office towers, which said "finance
 * website" rather than "our event". It now carries the summit's own hero
 * frame from the shared event photography — a room of senior delegates in
 * session — so the homepage and /forums/financial-rails-v2 open on the same
 * image and the property is recognisable at a glance.
 *
 * The composition follows the approved V2 editorial language: two equal halves
 * on the site's own grid, the words left and one landscape frame right, and no
 * nested container of its own — the section is the homepage canvas.
 */

/* The frame's slot: a six-column half of the content column, which sits inside
   the shared Section's 96px rail and lg:px-16 padding. Six of twelve columns
   with 48px gutters resolves to 50vw − 136px; below lg the halves stack and the
   frame is the full content width inside the shell's padding. This overrides
   the shared library's full-bleed `sizes`, which would fetch a 3840 file for a
   584px slot, and is a spread onto a fresh object so the shared set is read and
   never mutated. */
/** The widths that exist on disk for the hero photograph. */
const HERO_HOME_WIDTHS = [480, 768, 1024, 1400];

const FEATURE_PHOTO_SIZES =
  "(min-width: 1024px) calc(50vw - 136px), (min-width: 768px) calc(100vw - 96px), calc(100vw - 48px)";

function FinancialRailsFeature() {
  return (
    <Section label="Featured Summit" tone="ink">
      <Reveal>
        <h2 className="display-lg">Featured Summit</h2>
      </Reveal>

      <div className="mt-10 grid gap-y-12 lg:mt-14 lg:grid-cols-12 lg:items-center lg:gap-x-12">
        {/* The words lead the DOM, so the stack reads title → statement →
            date → location → door → frame on a phone, and no `order`
            utilities are needed to get there. */}
        <div className="min-w-0 lg:col-span-6">
          <Reveal delay={80}>
            {/* Fitted to the six-column half: "RAILS SUMMIT" is the wide line
                at a measured 7.23em, and the column is 376px at 1024 and 584px
                at 1440, so 4.9vw with a 4.4rem ceiling holds the lockup at
                every width without wrapping. */}
            <h3 className="font-display text-[clamp(2.2rem,4.9vw,4.4rem)] font-extrabold uppercase leading-[0.84] tracking-[-0.035em]">
              Financial
              <br />
              Rails Summit
            </h3>
          </Reveal>

          <Reveal delay={140}>
            <p className="display-sm mt-8 max-w-[30ch]">
              The infrastructure of the next financial system.
            </p>
          </Reveal>

          <Reveal delay={200} className="mt-10 border-t border-hairline-invert pt-8">
            <p className="display-sm">4–5 November 2026</p>
            <p className="label mt-3 opacity-60">Dubai, UAE</p>
          </Reveal>

          <Reveal delay={260} className="mt-10">
            <Action to="/forums/financial-rails-v2" variant="outlineInvert">
              Explore Summit
            </Action>
          </Reveal>
        </div>

        {/* One landscape frame, 3:2 — a 15% crop off the sides of the native
            16:9 master, which costs the room nothing. The reveal class lands on
            the <img>, which fills the figure absolutely, so colour returns
            under the photograph and nowhere else: not the column, not the
            words, not the ground. Only the filter moves — no zoom, no scale. */}
        <Reveal delay={120} className="min-w-0 lg:col-span-6">
          <figure className="relative aspect-[3/2] w-full overflow-hidden bg-ink/40">
            <MicrositePhoto
              photo={{ ...MICROSITE_PHOTOS.closing, sizes: FEATURE_PHOTO_SIZES }}
              className="grayscale transition-[filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:grayscale-0 motion-reduce:transition-none"
            />
          </figure>
        </Reveal>
      </div>
    </Section>
  );
}

function Home() {
  return (
    <>
      <PageHero
        meta="TOKENIZATION . PAYMENTS . CUSTODY . REGULATION."
        title={<SignatureHeadline />}
        /* The signature slot is measured against its widest word, and
           "PROGRAMMABLE." is 9.14em — far wider than the 5.35em "PHYSICAL."
           this hero was originally fitted for. The shared 14ch default capped
           the line at 8.76em, so the final E wrapped inside the slot's
           overflow-hidden and was clipped at every breakpoint. 15.5ch clears
           the widest word, and below sm the size tracks the viewport because
           the 2.25rem floor alone needs 329px inside a 327px column at 375. */
        titleClassName="font-display max-w-[15.5ch] text-[clamp(1.1rem,9vw,2.25rem)] font-extrabold uppercase leading-[0.84] tracking-[-0.03em] sm:text-[clamp(2.25rem,4.6vw,5.75rem)]"
        lede="We convene the institutions, regulators, and builders deploying real digital asset infrastructure."
        body="Initiative by Vostad Labs · Established in 2014."
        actions={[
          { label: "Explore Forums", to: "/forums" },
          { label: "About Digital Finance Alliance", to: "/about" },
        ]}
        seed="aiaccord-hero"
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
        figureTo="/forums/financial-rails-v2"
        figureLabel="Financial Rails Summit"
      />

      {/* One continuous proof of experience: the heading states the claim, the
          logos evidence the institutions, the portraits evidence the people.
          No rail label, no eyebrows and no rule between the two tracks — the
          tighter gap below the marquee than above it is what binds them into a
          single block. */}
      <Section>
        <TitleBlock
          title="Transforming Finance Since 2018"
          body="More than a sever years of bringing leaders, organizations and ideas together across ecosystem and around the world."
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

      {/* The featured event — the flagship carries the homepage alone. The
          full portfolio still lives at /forums; this page names only the
          signature property. */}
      <FinancialRailsFeature />

      <Section label="Mission" tone="ink" flush>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_28rem]">
          <div className="flex items-center bg-bone px-6 py-20 text-ink md:px-12 md:py-28 lg:px-16 lg:py-32">
            <Reveal>
              <div className="max-w-[52ch] text-[clamp(1.25rem,2.05vw,1.9rem)] leading-[1.4] tracking-[-0.01em]">
                <p>
                  Since 2018, we have convened leaders across 50+ countries around the forces
                  reshaping global markets.
                </p>
                <p className="mt-6">
                  From Blockchain for Banking and Blockchain for Sustainability to the Halal Economy
                  and multiple editions of the World Token Summit, our work has consistently focused
                  on what comes next.
                </p>
                <p className="mt-6">We saw two things clearly:</p>
                <p className="mt-6">
                  Digital assets need trusted infrastructure.
                  <br />
                  And they need real-world adoption.
                </p>
                <p className="mt-6">
                  Digital Finance Alliance exists to bring the people building both into the same
                  room.
                </p>
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
        title="Money Is Becoming Programmable."
        body="No hype. Only deployed. Join the institutions, regulators and builders putting real digital assets to work."
        actions={[{ label: "Explore Forums", to: "/forums" }]}
      />
    </>
  );
}
