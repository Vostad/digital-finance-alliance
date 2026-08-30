import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Section } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { FinancialRailsIcon } from "@/components/site/FinancialRailsIcon";
import {
  SUMMIT,
  CTA,
  SUMMIT_NAV,
  MARKET,
  ROOM,
  AUDIENCE,
  PROCESS,
  DIFFERENCE,
  AGENDA,
  VOICES,
  PARTNER_LOGOS,
  WINDOW,
  PARTNERSHIP,
  COMMERCIAL_DEADLINES,
  ABOUT,
  FINAL_BAND,
  FOOTER,
  submitLead,
  type LeadPayload,
} from "@/lib/financial-rails-summit";

/**
 * FINANCIAL RAILS SUMMIT — the V4 microsite, page-scoped.
 *
 * Composition only: every sentence lives in financial-rails-summit.ts. The
 * page is built in the site's own identity — Archivo display, IBM Plex
 * body and mono, paper/ink grounds, hairline rules, the periwinkle accent
 * pair — with this page's two deviations, both deliberate: labels sit at
 * 13px (`label-lg`, the V4 floor) instead of the site's 11px `label`, and
 * the entry animation is capped at 280ms via the `summit-scope` override.
 *
 * Exactly two CTA phrasings exist anywhere on this page, and both open
 * modals rather than navigating: the conversion is the form, not a page.
 */

/* ------------------------------------------------------------ type scale */

/* The hero proposition — the page's largest typographic moment. */
const HERO_TYPE =
  "font-display text-[clamp(1.55rem,7vw,3.3rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.03em] lg:text-[clamp(2.2rem,3.5vw,3.3rem)]";

/* Every section headline sits one confident step below the hero. */
const SECTION_TYPE =
  "font-display text-[clamp(1.5rem,5.4vw,2.1rem)] font-extrabold uppercase leading-[0.94] tracking-[-0.028em] lg:text-[clamp(1.8rem,2.9vw,2.6rem)]";

/* Statement stacks — the page's loudest device after the hero. */
const STATEMENT_TYPE =
  "font-display text-[clamp(1.55rem,5.8vw,2.2rem)] font-extrabold uppercase leading-[1.06] tracking-[-0.028em] lg:text-[clamp(1.9rem,3.1vw,2.9rem)]";

/* Body copy: 17px on mobile, 18px from lg — the V4 floors, exactly. */
const BODY = "text-[17px] leading-[1.6] lg:text-lg";

/* ------------------------------------------------------------ photography */

type Photo = { base: string; widths: number[]; alt: string };

const PHOTO_ROOM: Photo = {
  base: "/media/microsite/attend",
  widths: [480, 768, 1280, 1888],
  alt: "A senior delegate seated at a working table during a Vostad finance event session",
};
const PHOTO_MARKET: Photo = {
  base: "/media/microsite/who-in-room",
  widths: [480, 768, 1280, 1888],
  alt: "Two senior delegates in conversation at a Vostad finance event in Dubai",
};
const PHOTO_NETWORKING: Photo = {
  base: "/media/financial-rails-v2/experience/networking",
  widths: [480, 768, 1280, 1920],
  alt: "Two senior delegates in conversation between sessions at a Vostad event",
};
const PHOTO_MEETING: Photo = {
  base: "/media/microsite/why-attend",
  widths: [480, 768, 1280, 1888],
  alt: "Two executives talking one-to-one at a Vostad event",
};
const PHOTO_STAGE: Photo = {
  base: "/media/financial-rails-v2/experience/keynote",
  widths: [480, 768, 1280, 1920],
  alt: "A speaker delivering opening remarks from a Vostad-branded summit stage",
};
const PHOTO_HERO: Photo = {
  base: "/media/microsite/closing-frame",
  widths: [768, 1280, 1920, 2560, 3840],
  alt: "Delegates seated at round tables during a Vostad summit session in Dubai",
};

const FILM = {
  src: "/media/financial-rails-v2-hero.mp4",
  poster: "/media/financial-rails-v2-hero-poster.jpg",
};

function SummitPhoto({
  photo,
  sizes,
  className,
  loading = "lazy",
}: {
  photo: Photo;
  sizes: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const set = (ext: "avif" | "jpg") =>
    photo.widths.map((w) => `${photo.base}-${w}.${ext} ${w}w`).join(", ");
  const mid = photo.widths[Math.min(1, photo.widths.length - 1)];
  return (
    <picture className="contents">
      <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
      <img
        src={`${photo.base}-${mid}.jpg`}
        srcSet={set("jpg")}
        sizes={sizes}
        alt={photo.alt}
        loading={loading}
        decoding="async"
        className={cn(
          "absolute inset-0 h-full w-full object-cover grayscale transition-[filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:grayscale-0 motion-reduce:transition-none",
          className,
        )}
      />
    </picture>
  );
}

/* -------------------------------------------------------------- controls */

function Btn({
  children,
  onClick,
  tone,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  tone: "solidOnDark" | "quietOnDark" | "solidOnLight" | "quietOnLight";
  className?: string;
}) {
  const tones = {
    solidOnDark: "bg-paper text-ink hover:bg-ink hover:text-accent focus-visible:outline-accent",
    quietOnDark:
      "border border-hairline-invert text-paper hover:border-accent hover:text-accent focus-visible:outline-accent",
    solidOnLight: "bg-ink text-paper hover:bg-accent hover:text-ink focus-visible:outline-ink",
    quietOnLight:
      "border border-ink/25 text-ink hover:border-[var(--accord-orange-deep)] hover:text-[var(--accord-orange-deep)] focus-visible:outline-ink",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group label-lg inline-flex items-center gap-4 px-7 py-4 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none",
        tones[tone],
        className,
      )}
    >
      <span>{children}</span>
      <span
        aria-hidden
        className="inline-block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5 motion-reduce:transition-none"
      >
        →
      </span>
    </button>
  );
}

/** Numbered in-canvas eyebrow: the site's rail label is lg-only, and V4
    wants every section's number legible at every width. */
function Eyebrow({ index, label, invert }: { index: string; label: string; invert?: boolean }) {
  return (
    <p className={cn("label-lg lg:hidden", invert ? "accord-signal-invert" : "accord-signal")}>
      {index} — {label}
    </p>
  );
}

/* ------------------------------------------------------------- lead modals */

type ModalKind = "prospectus" | "apply" | null;
const ModalCtx = createContext<(kind: Exclude<ModalKind, null>) => void>(() => {});
const useModals = () => useContext(ModalCtx);

const FIELD =
  "w-full border-0 border-b border-ink/20 bg-transparent py-3 text-base text-ink outline-none transition-colors duration-300 placeholder:text-ink/35 focus:border-ink";

function Field({
  label,
  name,
  type = "text",
  textarea = false,
}: {
  label: string;
  name: string;
  type?: string;
  textarea?: boolean;
}) {
  const id = `summit-${name}`;
  return (
    <label htmlFor={id} className="block">
      <span className="label-lg block opacity-60">{label}</span>
      {textarea ? (
        <textarea id={id} name={name} required rows={3} className={cn(FIELD, "resize-none")} />
      ) : (
        <input id={id} name={name} type={type} required className={FIELD} />
      )}
    </label>
  );
}

function LeadModal({ kind, onClose }: { kind: Exclude<ModalKind, null>; onClose: () => void }) {
  const [done, setDone] = useState(false);
  const isProspectus = kind === "prospectus";
  const heading = isProspectus ? CTA.prospectus : CTA.apply;
  const note = isProspectus
    ? "The prospectus arrives the same day, with the full grid and current availability."
    : "Applications are reviewed within five working days, in order received.";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const v = (k: string) => String(data.get(k) ?? "").trim();
    const payload: LeadPayload = isProspectus
      ? { kind, name: v("name"), company: v("company"), role: v("role"), email: v("email") }
      : {
          kind,
          name: v("name"),
          organisation: v("organisation"),
          title: v("title"),
          email: v("email"),
          evaluating: v("evaluating"),
        };
    await submitLead(payload);
    setDone(true);
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-ink/75" />
        <Dialog.Content
          aria-modal="true"
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[100] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[540px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-ink/15 bg-paper p-8 text-ink outline-none md:p-10"
        >
          <div className="flex items-start justify-between gap-6">
            <Dialog.Title className="display-sm max-w-[16ch]">{heading}</Dialog.Title>
            <Dialog.Close className="label-lg opacity-50 transition-opacity duration-300 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
              Close
            </Dialog.Close>
          </div>

          {done ? (
            <div className="mt-8 border-t border-ink/15 pt-8">
              <p className="display-sm">Received.</p>
              <p className={cn(BODY, "mt-4 opacity-80")}>{note}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <Field label="Name" name="name" />
              {isProspectus ? (
                <>
                  <Field label="Company" name="company" />
                  <Field label="Role" name="role" />
                </>
              ) : (
                <>
                  <Field label="Organisation" name="organisation" />
                  <Field label="Title" name="title" />
                </>
              )}
              <Field label="Work email" name="email" type="email" />
              {isProspectus ? null : (
                <Field label="What you're evaluating" name="evaluating" textarea />
              )}
              <div className="pt-2">
                <SubmitBtn>{heading}</SubmitBtn>
              </div>
              <p className="text-[15px] leading-relaxed opacity-70">{note}</p>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* The submit button must submit; Btn renders a plain button. Wire it via CSS-free
   trick is worse than honesty: swap Btn for a real submit control. */
function SubmitBtn({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="group label-lg inline-flex items-center gap-4 bg-ink px-7 py-4 text-paper transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-accent hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink motion-reduce:transition-none"
    >
      <span>{children}</span>
      <span
        aria-hidden
        className="inline-block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5 motion-reduce:transition-none"
      >
        →
      </span>
    </button>
  );
}

/* ----------------------------------------------------------------- shell */

/**
 * A Summit chapter. The chapter name is passed to Section's LEFT RAIL — the
 * site's own device: a 6rem column with a hairline divider carrying a
 * vertical, sticky label that holds while its section is in view and hands
 * over as the next one arrives. That rail is the chapter indicator, so the
 * in-canvas Eyebrow renders below lg only, where the rail is hidden: one
 * indicator at every width, never two competing.
 */
function SummitSection({
  id,
  chapter,
  tone = "paper",
  className,
  children,
}: {
  id?: string;
  chapter: string;
  tone?: "paper" | "bone" | "ink";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Section
      {...(id ? { id } : {})}
      label={chapter}
      labelClassName="label-lg"
      tone={tone}
      className={cn("scroll-mt-20", className)}
    >
      {children}
    </Section>
  );
}

/* ------------------------------------------------------------------- nav */

function SummitNav() {
  const open = useModals();
  const [menu, setMenu] = useState(false);
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-hairline-invert bg-ink/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-6 px-6 py-4 text-paper md:px-10">
          <a
            href="#top"
            className="flex shrink-0 items-center gap-3"
            onClick={() => setMenu(false)}
          >
            <FinancialRailsIcon className="h-9 w-9" />
            <span className="font-display text-sm font-extrabold uppercase leading-[0.95] tracking-tight">
              Financial
              <br />
              Rails
            </span>
          </a>

          <nav aria-label="Summit" className="hidden items-center gap-7 xl:flex">
            {SUMMIT_NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="label-lg opacity-70 transition-opacity duration-300 hover:opacity-100"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => open("apply")}
              className="group label-lg hidden items-center gap-3 opacity-80 transition-opacity duration-300 hover:opacity-100 md:inline-flex"
            >
              <span>{CTA.apply}</span>
              <span
                aria-hidden
                className="inline-block transition-transform duration-500 group-hover:translate-x-1.5 motion-reduce:transition-none"
              >
                →
              </span>
            </button>
            <Btn
              tone="solidOnDark"
              onClick={() => open("prospectus")}
              className="hidden md:inline-flex px-5 py-3"
            >
              {CTA.prospectus}
            </Btn>
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-expanded={menu}
              aria-label={menu ? "Close menu" : "Open menu"}
              className="label-lg border border-hairline-invert px-4 py-3 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-paper hover:text-ink xl:hidden"
            >
              {menu ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>

      {/* Full-screen mobile navigation; items land at display-md, far above
          the 20px floor. */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink text-paper transition-[opacity,visibility] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] xl:hidden motion-reduce:transition-none",
          menu ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        <nav
          aria-label="Summit sections"
          className="flex h-full flex-col justify-center px-6 md:px-10"
        >
          {SUMMIT_NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => setMenu(false)}
              className="display-md border-b border-hairline-invert py-4 transition-opacity duration-300 hover:opacity-60"
            >
              {item.label}
            </a>
          ))}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Btn
              tone="solidOnDark"
              onClick={() => {
                setMenu(false);
                open("prospectus");
              }}
            >
              {CTA.prospectus}
            </Btn>
            <Btn
              tone="quietOnDark"
              onClick={() => {
                setMenu(false);
                open("apply");
              }}
            >
              {CTA.apply}
            </Btn>
          </div>
        </nav>
      </div>
    </>
  );
}

/** The hero film. `autoplay` only fires at mount, and this element mounts
    display:none below lg — so a viewport that crosses into lg (or a tab
    restored there) would show a frozen first frame. The effect retries
    play() whenever the element is actually visible; reduced-motion never
    sees it (CSS keeps it hidden, and the effect respects the same query). */
function SummitFilm() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const tryPlay = () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced && video.offsetParent !== null && video.paused) {
        video.play().catch(() => {});
      }
    };
    tryPlay();
    const media = window.matchMedia("(min-width: 1024px)");
    media.addEventListener("change", tryPlay);
    const io = new IntersectionObserver(tryPlay, { threshold: 0.1 });
    io.observe(video);
    return () => {
      media.removeEventListener("change", tryPlay);
      io.disconnect();
    };
  }, []);
  return (
    <video
      ref={ref}
      className="absolute inset-0 hidden h-full w-full object-cover lg:motion-safe:block"
      src={FILM.src}
      poster={FILM.poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-label="Highlights from previous Vostad finance events"
    />
  );
}

/* ------------------------------------------------------------- 01 · hero */

/* The masthead — the event name, sized to own the page. Fitted to the
   seven-column track the way the site fits every lockup: "FINANCIAL RAILS"
   is the wide line at 15 characters, so the size tracks the column
   (0.583vw − 158px at lg) divided by that measure rather than guessing
   from the viewport. Below lg the single column carries it at 8.8vw. */
const MASTHEAD_TYPE =
  "font-display text-[clamp(2.15rem,8.8vw,4.5rem)] font-extrabold uppercase leading-[0.86] tracking-[-0.032em] lg:text-[clamp(2.4rem,calc(6.25vw-17px),4.6rem)]";

/* The proposition — substantial, and unmistakably second. Roughly half the
   masthead at every width. */
const PROPOSITION_TYPE =
  "font-display text-[clamp(1.25rem,4.9vw,2.1rem)] font-bold uppercase leading-[1.04] tracking-[-0.022em] lg:text-[clamp(1.35rem,calc(2.7vw-5px),2.2rem)]";

function Hero() {
  const open = useModals();
  return (
    <SummitSection id="top" chapter="01 — Financial Rails" tone="ink">
      <div className="pt-4 lg:pt-8">
        <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-12">
          {/* THE IDENTITY. Reading order is the hierarchy: masthead, rule,
              proposition, date, doors, trust. */}
          <div className="min-w-0 lg:col-span-7 lg:pt-6">
            {/* No opening rule. Tested with the accent bar the site uses to
                close its arguments, and it read as UI chrome above a masthead
                that is already the loudest thing on the page — the name earns
                the top of the composition on its own. The accent is spent
                where it does work: the chapter rail. */}
            <Reveal delay={60}>
              <h1 className={MASTHEAD_TYPE}>
                {SUMMIT.nameLines.map((line) => (
                  <span key={line} className="block whitespace-nowrap">
                    {line}
                  </span>
                ))}
              </h1>
            </Reveal>
            <Reveal delay={130}>
              <p className={cn(PROPOSITION_TYPE, "mt-8 lg:mt-9")}>
                <span className="block">The people who move</span>
                <span className="block">the Gulf's money.</span>
              </p>
            </Reveal>
            {/* THE ACTION AREA. One rule opens it, and the date and the two
                doors sit inside that one block — the rule reads as the top of
                a single group rather than a divider between two. */}
            <Reveal delay={190} className="mt-11 border-t border-hairline-invert pt-7 lg:mt-14">
              <p className="display-sm opacity-95">{SUMMIT.dateline}</p>
            </Reveal>
            {/* One solid door; the second is a quiet text door, related but
                clearly subordinate. */}
            <Reveal delay={240} className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-5">
              <Btn tone="solidOnDark" onClick={() => open("prospectus")}>
                {CTA.prospectus}
              </Btn>
              <button
                type="button"
                onClick={() => open("apply")}
                className="group label-lg inline-flex items-center gap-3 opacity-75 transition-opacity duration-300 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                <span>{CTA.apply}</span>
                <span
                  aria-hidden
                  className="inline-block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5 motion-reduce:transition-none"
                >
                  →
                </span>
              </button>
            </Reveal>
            <Reveal delay={280}>
              <p className="mt-10 max-w-[42ch] text-[17px] leading-relaxed opacity-75">
                {SUMMIT.trustLine}
              </p>
            </Reveal>
          </div>

          {/* THE ROOM. Desktop only, and a landscape frame rather than the
              portrait it was: the tall crop ran the photograph down to the
              film and the two media read as one continuous block. Shorter and
              wider gives the room its own proportion, keeps the delegates and
              the table in shot, and leaves the ground between the two media
              genuinely empty. It still escapes the canvas to the viewport's
              right edge — the bleed is what stops it reading as a card — and
              it sits slightly below the masthead's first line so the two
              columns start on different beats.

              The RATIO is per-breakpoint because the height is what matters:
              a fixed 7:5 collapsed to a 264px strip in the narrower column at
              1024. Square there, landscape from xl, holds the frame at
              370-390px at both — one proportion for the eye, two for the
              grid. */}
          <Reveal delay={150} className="hidden min-w-0 lg:col-span-5 lg:block lg:pt-3">
            <figure className="relative aspect-square w-full overflow-hidden bg-ink lg:-mr-16 lg:w-[calc(100%+4rem)] xl:aspect-[7/5]">
              <SummitPhoto
                photo={PHOTO_HERO}
                sizes="(min-width:1024px) calc(41.6vw - 60px), 100vw"
                loading="eager"
                className="object-[46%_50%]"
              />
            </figure>
          </Reveal>
        </div>

        {/* THE FILM, after a deliberate hold. The gap above it is the point:
            ground the eye crosses before the cinematic frame arrives, so the
            still and the footage are two moments rather than one block. */}
        <Reveal delay={200} className="relative mt-14 lg:mt-20 xl:mt-24">
          <figure className="relative -mx-6 aspect-[16/9] overflow-hidden bg-ink md:-mx-12 lg:mx-0 lg:-mr-16 lg:aspect-[21/8]">
            <SummitFilm />
            <img
              src={FILM.poster}
              alt="Highlights reel poster from previous Vostad finance events"
              className="absolute inset-0 block h-full w-full object-cover lg:motion-safe:hidden"
              loading="lazy"
              decoding="async"
            />
          </figure>
        </Reveal>
      </div>
    </SummitSection>
  );
}

/* 02 · THE MARKET — the composition inverts the hero: photograph LEFT and
   anchored, argument RIGHT and moving. The still holds while the evidence
   scrolls past it, so the room is present for the whole read without ever
   being the thing being read.

   The three figures are not a row of equals. $58B carries the scale on its
   own line at full width; 40% and 61 sit beneath it as a supporting pair on
   one shared rule. That is the hierarchy the market actually has — one
   number is the market's size, the other two describe its shape. */
function TheMarket() {
  return (
    <SummitSection id="the-market" chapter="02 — The Market">
      <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-16">
        {/* THE ROOM, ANCHORED. First in the DOM, so mobile opens on the
            photograph exactly as the desktop eye does. */}
        {/* The Reveal IS the grid item, not a wrapper inside one: a sticky
            child needs a containing block taller than itself, and an
            auto-height wrapper gives it none — the frame simply scrolled
            away. As the stretched column, it gives the figure the whole
            section to travel in.

            SQUARE at lg, not the source's native 4:5: the portrait left only
            188px of slack in the column, so the anchor barely moved before
            releasing. Square keeps both subjects in frame and roughly
            doubles the travel, which is what makes the hold legible. Mobile
            keeps the uncropped 4:5 — there is no sticky there to serve.
            Between them the frame goes landscape: at 768 a full-width 4:5
            stands 840px tall and pushes the entire argument below the fold,
            which is not an anchor, it is a wall. */}
        <Reveal className="min-w-0 lg:col-span-5">
          <figure className="relative aspect-[4/5] w-full overflow-hidden bg-bone sm:aspect-[4/3] lg:sticky lg:top-28 lg:aspect-square">
            <SummitPhoto photo={PHOTO_MARKET} sizes="(min-width:1024px) calc(38vw - 96px), 100vw" />
          </figure>
        </Reveal>

        {/* THE ARGUMENT. */}
        <div className="min-w-0 lg:col-span-7">
          {/* Below lg the rail is hidden, so the eyebrow carries the chapter
              there — the same one-indicator-at-every-width rule the rest of
              the page follows. Above lg the heading opens the column alone. */}
          <Reveal>
            <Eyebrow index="02" label={MARKET.label} />
          </Reveal>
          <Reveal delay={60}>
            <h2 className={cn(SECTION_TYPE, "max-w-[20ch] lg:mt-0", "mt-7")}>{MARKET.headline}</h2>
          </Reveal>

          {/* THE SCALE. One figure, full measure, on its own rules. */}
          <Reveal delay={120}>
            <div className="mt-12 border-y border-hairline py-9 lg:mt-14 lg:py-10">
              <p className="font-display text-[clamp(3.4rem,15vw,4.75rem)] font-extrabold leading-[0.8] tracking-[-0.045em] lg:text-[clamp(4rem,7.6vw,6rem)]">
                {MARKET.primaryStat.value}
              </p>
              <p className="mt-5 text-[17px] leading-relaxed opacity-75 lg:text-lg">
                {MARKET.primaryStat.line}
              </p>
            </div>
          </Reveal>

          {/* THE SHAPE. A supporting pair, set a clear step down. */}
          <Reveal delay={170}>
            <div className="grid grid-cols-1 border-b border-hairline sm:grid-cols-2">
              {MARKET.supportingStats.map((stat) => (
                <div
                  key={stat.value}
                  className="border-b border-hairline py-8 last:border-b-0 sm:border-b-0 sm:pr-8 sm:[&:nth-child(2)]:border-l sm:[&:nth-child(2)]:border-hairline sm:[&:nth-child(2)]:pl-8 lg:py-9"
                >
                  <p className="font-display text-[clamp(2.1rem,8vw,2.8rem)] font-extrabold leading-[0.85] tracking-[-0.04em] lg:text-[clamp(2.25rem,4.2vw,3.4rem)]">
                    {stat.value}
                  </p>
                  <p className="mt-4 max-w-[30ch] text-[17px] leading-relaxed opacity-75 lg:text-lg">
                    {stat.line}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* THE CONCLUSION — momentum, and the hand-off to 03. */}
          <Reveal delay={220}>
            <div className="accord-hairline mt-14 border-t-2 pt-9 lg:mt-16">
              {MARKET.closing.map((line, i) => (
                <p
                  key={line}
                  className={cn(
                    "font-display max-w-[26ch] text-[clamp(1.45rem,5.6vw,1.9rem)] font-extrabold uppercase leading-[1.08] tracking-[-0.025em] lg:text-[clamp(1.6rem,2.5vw,2.3rem)]",
                    i > 0 && "mt-5 opacity-70",
                  )}
                >
                  {line}
                </p>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </SummitSection>
  );
}

/* 03 · THE ROOM — Section 02's grammar, mirrored. Same grid, same gutters,
   same rule language, same sticky logic, same numeral and descriptor
   treatment; the sides swap and the internal hierarchy is re-pointed at this
   section's argument. Content LEFT, room RIGHT.

   The whole argument stays inside the left column so the frame's container
   spans it end to end — an earlier build put the refusals below the spread,
   which ended the photograph before the argument did and left the lower half
   of the section with an empty right side.

   The one deliberate departure from 02's scale: there the lead figure is the
   loudest thing on the page, because the market's size IS that section's
   point. Here the point is the policy, so the refusals hold the voice and
   the figures sit under them. Same language, re-pointed emphasis. */
function TheRoom() {
  return (
    <SummitSection id="the-room" chapter="03 — The Room">
      <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-16">
        {/* THE ARGUMENT — first in the DOM, so mobile opens on the claim. */}
        <div className="min-w-0 lg:col-span-7">
          <Reveal>
            <Eyebrow index="03" label={ROOM.label} />
          </Reveal>
          <Reveal delay={60}>
            {/* Three authored lines. The two-line reading needs "before the
                seats were sold." — 27 characters — on one line, and the
                seven-column track is 403px at 1024: that would demand a 26px
                headline, smaller than the figures beneath it. Broken
                12/15/20 the longest line clears every width, no orphan. */}
            <h2 className="font-display mt-7 text-[clamp(1.75rem,7.2vw,2.2rem)] font-extrabold uppercase leading-[0.96] tracking-[-0.028em] lg:mt-0 lg:text-[clamp(1.9rem,3.2vw,3.2rem)]">
              <span className="block">The room was</span>
              <span className="block">designed before</span>
              <span className="block">the seats were sold.</span>
            </h2>
          </Reveal>

          {/* THE CAP. The lead figure, full measure, on its own rules —
              02's primary-statistic block exactly, one scale step down. */}
          <Reveal delay={120}>
            <div className="mt-12 border-y border-hairline py-9 lg:mt-14 lg:py-10">
              <p className="font-display text-[clamp(3rem,13vw,4rem)] font-extrabold leading-[0.8] tracking-[-0.045em] lg:text-[clamp(3.2rem,4.6vw,4.6rem)]">
                {ROOM.primaryStat.value}
              </p>
              <p className="mt-5 text-[17px] leading-relaxed opacity-75 lg:text-lg">
                {ROOM.primaryStat.line}
              </p>
            </div>
          </Reveal>

          {/* THE COMPOSITION OF IT. 02's supporting pair, verbatim structure:
              one row, two tracks, a rule between them at sm and up. */}
          <Reveal delay={170}>
            <div className="grid grid-cols-1 border-b border-hairline sm:grid-cols-2">
              {ROOM.supportingStats.map((stat) => (
                <div
                  key={stat.value}
                  className="border-b border-hairline py-8 last:border-b-0 sm:border-b-0 sm:pr-8 sm:[&:nth-child(2)]:border-l sm:[&:nth-child(2)]:border-hairline sm:[&:nth-child(2)]:pl-8 lg:py-9"
                >
                  <p className="font-display text-[clamp(1.9rem,7.4vw,2.4rem)] font-extrabold leading-[0.85] tracking-[-0.04em] lg:text-[clamp(2rem,2.7vw,2.8rem)]">
                    {stat.value}
                  </p>
                  <p className="mt-4 max-w-[30ch] text-[17px] leading-relaxed opacity-75 lg:text-lg">
                    {stat.line}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* THE POLICY — 02's closing block: one accent rule, then the
              statement. Three operating principles, generous rhythm. */}
          <Reveal delay={220}>
            <div className="accord-hairline mt-14 border-t-2 pt-9 lg:mt-16 lg:pt-10">
              {ROOM.philosophy.map((line) => (
                <p
                  key={line}
                  className="font-display py-2 text-[clamp(1.5rem,6.2vw,2.3rem)] font-extrabold uppercase leading-[1.06] tracking-[-0.03em] lg:py-2.5 lg:text-[clamp(1.9rem,3.1vw,2.9rem)]"
                >
                  {line}
                </p>
              ))}
            </div>
          </Reveal>
        </div>

        {/* THE ROOM ITSELF. 02's sticky logic exactly — the Reveal is the
            grid item, so the figure has a containing block taller than
            itself. Taller than 02's square because this column is taller:
            3:4 covers the argument rather than stranding above it.

            The min-height is the floor the ratio cannot give: the right
            column is only 296px wide at 1024, where 3:4 collapses to 395px
            against a 764px argument — 52% coverage, the same premature end
            this section was rebuilt to fix. 520px holds it past two-thirds
            at that width and never binds at 1440, where the ratio already
            gives 626px. */}
        <Reveal delay={140} className="min-w-0 lg:col-span-5">
          <figure className="relative aspect-[4/3] w-full overflow-hidden bg-bone sm:aspect-[16/10] lg:sticky lg:top-28 lg:aspect-[3/4] lg:min-h-[520px]">
            <SummitPhoto
              photo={PHOTO_ROOM}
              sizes="(min-width:1024px) calc(38vw - 96px), 100vw"
              className="object-[56%_46%]"
            />
          </figure>
        </Reveal>
      </div>
    </SummitSection>
  );
}

/* 04 · WHO IS IN IT — the strongest buyer-facing band. A numbered
   institutional taxonomy against a tall networking photograph, then the
   qualification bar stated in public, then the one buyer door. */
function WhoIsInIt() {
  const open = useModals();
  return (
    <SummitSection id="who-is-in-it" chapter="04 — The People" tone="ink">
      <Reveal>
        <Eyebrow index="04" label="Who Is in It" invert />
      </Reveal>
      <Reveal delay={70}>
        <h2 className={cn(SECTION_TYPE, "mt-8 max-w-[30ch]")}>{AUDIENCE.headline}</h2>
      </Reveal>

      <div className="mt-14 grid gap-y-12 lg:mt-16 lg:grid-cols-12 lg:gap-x-12">
        {/* The taxonomy: five constituencies as a ledger, not five cards. */}
        <div className="min-w-0 lg:col-span-7">
          <div className="border-t border-hairline-invert">
            {AUDIENCE.groups.map((group, i) => (
              <Reveal key={group.role} delay={100 + i * 40}>
                <div className="grid grid-cols-[2.6rem_1fr] items-baseline gap-x-5 border-b border-hairline-invert py-6 lg:py-7">
                  <p className="label-lg accord-signal-invert">{String(i + 1).padStart(2, "0")}</p>
                  <div className="min-w-0">
                    <h3 className="display-sm">{group.role}</h3>
                    <p className={cn(BODY, "mt-2 max-w-[44ch] opacity-75")}>{group.line}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* The bar, in public — hairline-bordered, as specified. */}
          <Reveal delay={160}>
            <div className="mt-12 border border-hairline-invert p-7 lg:p-9">
              <p className="label-lg accord-signal-invert">{AUDIENCE.qualificationHeading}</p>
              <p className={cn(BODY, "mt-4 opacity-85")}>{AUDIENCE.qualification}</p>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="mt-10">
              <p className="label-lg opacity-60">{AUDIENCE.compositionLabel}</p>
              <p className={cn(BODY, "mt-3 max-w-[56ch] opacity-85")}>{AUDIENCE.composition}</p>
              <p className="mt-2 text-[15px] leading-relaxed opacity-60">
                {AUDIENCE.compositionNote}
              </p>
            </div>
          </Reveal>
        </div>

        {/* The room's people, at column height. */}
        <Reveal delay={140} className="min-w-0 lg:col-span-5">
          <figure className="relative aspect-[4/5] w-full overflow-hidden bg-ink lg:sticky lg:top-28">
            <SummitPhoto
              photo={PHOTO_NETWORKING}
              sizes="(min-width:1024px) calc(41.6vw - 120px), 100vw"
            />
          </figure>
        </Reveal>
      </div>

      {/* The buyer door. */}
      <Reveal delay={220}>
        <div className="accord-hairline mt-16 border-t pt-9 lg:mt-20">
          <p className={cn(STATEMENT_TYPE, "max-w-[24ch]")}>{AUDIENCE.buyerHeadline}</p>
          <p className={cn(BODY, "mt-5 max-w-[44ch] opacity-80")}>{AUDIENCE.buyerLine}</p>
          <div className="mt-8">
            <Btn tone="solidOnDark" onClick={() => open("apply")}>
              {CTA.apply}
            </Btn>
          </div>
          <p className="mt-6 max-w-[62ch] text-[15px] leading-relaxed opacity-65">
            {AUDIENCE.buyerNote}
          </p>
        </div>
      </Reveal>
    </SummitSection>
  );
}

/* 05 · HOW IT WORKS — the machinery: four steps on one rail, numerals and
   hairline connectors, no cards and no icons. The guarantee closes the band
   beside a deliberately small 1:1 meeting frame. */
function HowItWorks() {
  return (
    <SummitSection id="how-it-works" chapter="05 — How It Works">
      <Reveal>
        <Eyebrow index="05" label="How It Works" />
      </Reveal>
      <Reveal delay={70}>
        <h2 className={cn(SECTION_TYPE, "mt-8 max-w-[26ch]")}>{PROCESS.headline}</h2>
      </Reveal>

      <Reveal delay={140}>
        <div className="mt-14 grid grid-cols-1 border-t border-hairline sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {PROCESS.steps.map((step, i) => (
            <div
              key={step.title}
              className="border-b border-hairline px-0 py-8 sm:border-b-0 sm:py-10 sm:pr-8 sm:[&:nth-child(even)]:border-l sm:[&:nth-child(even)]:border-hairline sm:[&:nth-child(even)]:pl-8 lg:border-l lg:border-hairline lg:pl-8 lg:first:border-l-0 lg:first:pl-0"
            >
              <p className="label-lg accord-signal">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="display-sm mt-5 min-h-0 lg:min-h-[3.2em]">{step.title}</h3>
              <p className={cn(BODY, "mt-4 opacity-75")}>{step.body}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="mt-14 grid items-center gap-y-10 border-t border-hairline pt-10 lg:mt-16 lg:grid-cols-12 lg:gap-x-12">
        <Reveal delay={180} className="min-w-0 lg:col-span-7">
          <p className={cn(STATEMENT_TYPE, "accord-signal")}>{PROCESS.guarantee}</p>
          <p className={cn(BODY, "mt-6 max-w-[44ch] opacity-75")}>{PROCESS.footer}</p>
        </Reveal>
        {/* Visibly smaller than 04's photograph, by instruction: a square
            inset, not a column-height frame. */}
        <Reveal delay={220} className="min-w-0 lg:col-span-4 lg:col-start-9">
          <figure className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden bg-bone lg:mx-0">
            <SummitPhoto
              photo={PHOTO_MEETING}
              sizes="(min-width:1024px) 340px, calc(100vw - 48px)"
            />
          </figure>
        </Reveal>
      </div>
    </SummitSection>
  );
}
/* 06 · THE DIFFERENCE — pure comparison, no photograph. Five paired rows;
   the Financial Rails side carries the typographic weight. On mobile each
   pair stacks with its own small column labels, so a row never scrolls. */
function TheDifference() {
  return (
    <SummitSection id="the-difference" chapter="06 — The Difference" tone="ink">
      <Reveal>
        <Eyebrow index="06" label="The Difference" invert />
      </Reveal>
      <Reveal delay={70}>
        <h2 className={cn(SECTION_TYPE, "mt-8")}>
          <span className="block max-w-[30ch]">{DIFFERENCE.headline[0]}</span>
          <span className="block max-w-[30ch] opacity-60">{DIFFERENCE.headline[1]}</span>
        </h2>
      </Reveal>

      <Reveal delay={140}>
        <div className="mt-14 lg:mt-16">
          {/* Column heads, desktop only — mobile rows carry their own. */}
          <div className="hidden border-b border-hairline-invert pb-4 lg:grid lg:grid-cols-2 lg:gap-x-12">
            <p className="label-lg opacity-55">{DIFFERENCE.expoHeading}</p>
            <p className="label-lg accord-signal-invert">{DIFFERENCE.railsHeading}</p>
          </div>
          {DIFFERENCE.rows.map((row) => (
            <div
              key={row.rails}
              className="grid grid-cols-1 gap-y-3 border-b border-hairline-invert py-6 lg:grid-cols-2 lg:items-baseline lg:gap-x-12 lg:py-5"
            >
              <div className="min-w-0">
                <p className="label-lg mb-1 opacity-55 lg:hidden">{DIFFERENCE.expoHeading}</p>
                <p className={cn(BODY, "opacity-60")}>{row.expo}</p>
              </div>
              <div className="min-w-0">
                <p className="label-lg mb-1 accord-signal-invert lg:hidden">
                  {DIFFERENCE.railsHeading}
                </p>
                <p className={cn(BODY, "font-semibold text-paper")}>{row.rails}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={200}>
        <div className="accord-hairline mt-14 border-t pt-9 lg:mt-16">
          {DIFFERENCE.closing.map((line) => (
            <p key={line} className={STATEMENT_TYPE}>
              {line}
            </p>
          ))}
          <p className={cn(BODY, "mt-6 max-w-[48ch] opacity-70")}>{DIFFERENCE.support}</p>
        </div>
      </Reveal>
    </SummitSection>
  );
}

/* 07 · THE AGENDA — six tracks as a ledger against a tall stage photograph;
   the format line runs as a full-width band, and the refusal triplet closes
   the programme's borders. */
function TheAgenda() {
  return (
    <SummitSection id="agenda" chapter="07 — The Agenda">
      <Reveal>
        <Eyebrow index="07" label="The Agenda" />
      </Reveal>
      <Reveal delay={70}>
        <h2 className={cn(SECTION_TYPE, "mt-8 max-w-[28ch]")}>{AGENDA.headline}</h2>
      </Reveal>

      <div className="mt-14 grid gap-y-12 lg:mt-16 lg:grid-cols-12 lg:gap-x-12">
        <div className="min-w-0 lg:col-span-6">
          <div className="border-t border-hairline">
            {AGENDA.tracks.map((track, i) => (
              <Reveal key={track.title} delay={100 + i * 40}>
                <div className="grid grid-cols-[2.6rem_1fr] items-baseline gap-x-5 border-b border-hairline py-6 lg:py-7">
                  <p className="label-lg accord-signal">{String(i + 1).padStart(2, "0")}</p>
                  <div className="min-w-0">
                    <h3 className="display-sm">{track.title}</h3>
                    <p className={cn(BODY, "mt-2 opacity-75")}>{track.line}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={140} className="min-w-0 lg:col-span-6">
          <figure className="relative aspect-[4/5] w-full overflow-hidden bg-bone lg:sticky lg:top-28 lg:h-full lg:max-h-[720px]">
            {/* The master is 16:9 with the speaker at frame-left; a centred 4:5
                crop keeps only the screen. Weight the crop toward the podium
                so the photograph proves a person on a stage, not a logo. */}
            <SummitPhoto
              photo={PHOTO_STAGE}
              sizes="(min-width:1024px) calc(50vw - 136px), 100vw"
              className="object-[18%_center]"
            />
          </figure>
        </Reveal>
      </div>

      {/* The programme's shape, at band scale — structure, not footnote. */}
      <Reveal delay={180}>
        <p className="mt-14 border-y border-hairline py-6 font-display text-[clamp(1rem,2.6vw,1.2rem)] font-bold uppercase leading-[1.4] tracking-[-0.01em] lg:mt-16 lg:text-[clamp(1.05rem,1.5vw,1.4rem)]">
          {AGENDA.format}
        </p>
      </Reveal>

      <Reveal delay={220}>
        <div className="mt-12">
          {AGENDA.refusals.map((line) => (
            <p key={line} className={STATEMENT_TYPE}>
              {line}
            </p>
          ))}
          <p
            className={cn(
              "accord-signal mt-6 font-display text-[clamp(1.05rem,2.6vw,1.3rem)] font-bold uppercase tracking-[-0.01em] lg:text-[clamp(1.1rem,1.6vw,1.5rem)]",
            )}
          >
            {AGENDA.refusalClose}
          </p>
        </div>
      </Reveal>
    </SummitSection>
  );
}
/* 08 · THE VOICES — people first, logos as seasoning. Seven approved
   portraits on a four-column grid whose eighth cell carries the footnote,
   so the roster reads as a designed wall rather than a ten-grid with
   holes. The institutions render as text, never as logos. */
function TheVoices() {
  return (
    <SummitSection id="speakers" chapter="08 — The Voices" tone="ink">
      <Reveal>
        <Eyebrow index="08" label="The Voices" invert />
      </Reveal>
      <Reveal delay={70}>
        <h2 className={cn(SECTION_TYPE, "mt-8 max-w-[26ch]")}>{VOICES.headline}</h2>
      </Reveal>

      <Reveal delay={130} className="mt-14 border-t border-hairline-invert pt-8 lg:mt-16">
        <h3 className="label-lg accord-signal-invert">{VOICES.subhead}</h3>
      </Reveal>

      <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
        {VOICES.speakers.map((person, i) => (
          <Reveal key={person.name} delay={120 + (i % 4) * 50}>
            <figure className="group">
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-ink/60">
                <picture className="contents">
                  <source
                    type="image/avif"
                    srcSet={`${person.image}-400.avif 400w, ${person.image}-800.avif 800w`}
                    sizes="(min-width:1024px) 22vw, (min-width:768px) 30vw, 45vw"
                  />
                  <img
                    src={`${person.image}-400.jpg`}
                    srcSet={`${person.image}-400.jpg 400w, ${person.image}-800.jpg 800w`}
                    sizes="(min-width:1024px) 22vw, (min-width:768px) 30vw, 45vw"
                    alt={`Portrait of ${person.name}`}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover grayscale transition-[filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:grayscale-0 motion-reduce:transition-none"
                  />
                </picture>
              </div>
              <figcaption className="mt-4">
                <p className="display-sm leading-tight">{person.name}</p>
                <p className="mt-1.5 text-[15px] leading-snug opacity-70">{person.title}</p>
                <p className="accord-signal-invert mt-0.5 text-[15px] leading-snug">{person.org}</p>
              </figcaption>
            </figure>
          </Reveal>
        ))}
        {/* The eighth cell: the roster's own footnote, set as part of the
            wall rather than dropped beneath it. */}
        <Reveal delay={320} className="col-span-2 self-end md:col-span-3 lg:col-span-1">
          <p className="border-t border-hairline-invert pt-5 text-[15px] leading-relaxed opacity-65">
            {VOICES.footnote}
          </p>
        </Reveal>
      </div>

      {/* Approved commercial partner logos only — the block does not exist
          until an allowlist does. */}
      {PARTNER_LOGOS.length > 0 ? (
        <Reveal delay={200} className="mt-16 border-t border-hairline-invert pt-8">
          <h3 className="label-lg accord-signal-invert">Partners Across Our Platforms</h3>
          <div className="mt-8 flex flex-wrap items-center gap-10">
            {PARTNER_LOGOS.map((logo) => (
              <img key={logo.name} src={logo.src} alt={logo.name} className="h-8 w-auto" />
            ))}
          </div>
        </Reveal>
      ) : null}

      <Reveal delay={220} className="mt-16 border-t border-hairline-invert pt-8 lg:mt-20">
        <h3 className="label-lg accord-signal-invert">{VOICES.institutionsHeading}</h3>
        <p className="mt-6 max-w-[72ch] text-[17px] leading-[1.9] opacity-85 lg:text-lg">
          {VOICES.institutions.join(" · ")}
        </p>
        <p className="mt-5 max-w-[64ch] text-[15px] leading-relaxed opacity-55">
          {VOICES.institutionsFootnote}
        </p>
      </Reveal>
    </SummitSection>
  );
}

/* 09 · THE WINDOW — editorial two-column: the clock against the city,
   heights deliberately unequal, no photograph. */
function TheWindow() {
  return (
    <SummitSection id="the-window" chapter="09 — The Window">
      <Reveal>
        <Eyebrow index="09" label="The Window" />
      </Reveal>
      <Reveal delay={70}>
        <h2 className={cn(SECTION_TYPE, "mt-8 max-w-[28ch]")}>{WINDOW.headline}</h2>
      </Reveal>

      <div className="mt-14 grid gap-y-14 lg:mt-16 lg:grid-cols-12 lg:gap-x-12">
        <div className="min-w-0 lg:col-span-7">
          <Reveal delay={100}>
            <h3 className="label-lg accord-signal border-b border-hairline pb-4">
              {WINDOW.clockHeading}
            </h3>
          </Reveal>
          {WINDOW.clock.map((item, i) => (
            <Reveal key={item.title} delay={130 + i * 35}>
              <div className="border-b border-hairline py-6">
                <h4 className="display-sm">{item.title}</h4>
                <p className={cn(BODY, "mt-2 max-w-[48ch] opacity-75")}>{item.line}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="min-w-0 lg:col-span-4 lg:col-start-9">
          <Reveal delay={140}>
            <h3 className="label-lg accord-signal border-b border-hairline pb-4">
              {WINDOW.cityHeading}
            </h3>
          </Reveal>
          {WINDOW.city.map((item, i) => (
            <Reveal key={item.title} delay={170 + i * 35}>
              <div className="border-b border-hairline py-6">
                <h4 className="display-sm">{item.title}</h4>
                <p className={cn(BODY, "mt-2 opacity-75")}>{item.line}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal delay={220}>
        <div className="accord-hairline mt-14 border-t pt-9 lg:mt-16">
          {WINDOW.closing.map((line) => (
            <p key={line} className={STATEMENT_TYPE}>
              {line}
            </p>
          ))}
        </div>
      </Reveal>
    </SummitSection>
  );
}
/* 10 · PARTNERSHIP — the architecture, not the rate card. Seven positions
   as a ledger, the public range as a bordered band, the deadline block
   rendered only when real dates exist. */
function Partnership() {
  const open = useModals();
  const deadlines = [
    { label: "Programme locks", date: COMMERCIAL_DEADLINES.programmeLocks },
    { label: "Meeting scheduling opens", date: COMMERCIAL_DEADLINES.schedulingOpens },
    { label: "Final positions close", date: COMMERCIAL_DEADLINES.positionsClose },
  ].filter((d): d is { label: string; date: string } => Boolean(d.date));
  return (
    <SummitSection id="partnership" chapter="10 — Partnership" tone="ink">
      <Reveal>
        <Eyebrow index="10" label="Partnership" invert />
      </Reveal>
      <Reveal delay={70}>
        <h2 className={cn(SECTION_TYPE, "mt-8 max-w-[20ch]")}>{PARTNERSHIP.headline}</h2>
      </Reveal>
      <Reveal delay={120}>
        <p className={cn(BODY, "mt-7 max-w-[58ch] opacity-80")}>{PARTNERSHIP.intro}</p>
      </Reveal>

      <Reveal delay={160}>
        <p className="mt-12 border-y border-hairline-invert py-6 font-display text-[clamp(1.15rem,3.4vw,1.5rem)] font-extrabold uppercase leading-[1.3] tracking-[-0.015em] lg:text-[clamp(1.3rem,1.9vw,1.75rem)]">
          {PARTNERSHIP.range}
        </p>
      </Reveal>
      <Reveal delay={190}>
        <p className={cn(BODY, "mt-7 max-w-[58ch] opacity-75")}>{PARTNERSHIP.rangeNote}</p>
      </Reveal>

      <div className="mt-12 border-t border-hairline-invert">
        {PARTNERSHIP.architecture.map((item, i) => (
          <Reveal key={item.tier} delay={100 + i * 30}>
            <div className="grid grid-cols-1 gap-y-1 border-b border-hairline-invert py-5 lg:grid-cols-12 lg:items-baseline lg:gap-x-12">
              <h3 className="display-sm lg:col-span-4">{item.tier}</h3>
              <p className={cn(BODY, "opacity-75 lg:col-span-8")}>{item.line}</p>
            </div>
          </Reveal>
        ))}
      </div>

      {deadlines.length > 0 ? (
        <Reveal delay={200}>
          <div className="mt-12 border border-hairline-invert p-7 lg:p-9">
            {deadlines.map((d) => (
              <p key={d.label} className="display-sm py-1">
                {d.label} · {d.date}
              </p>
            ))}
          </div>
        </Reveal>
      ) : null}

      <Reveal delay={220}>
        <div className="accord-hairline mt-14 border-t pt-9">
          <p className="display-md max-w-[30ch]">{PARTNERSHIP.proofNote}</p>
          <p className={cn(BODY, "mt-5 max-w-[52ch] opacity-70")}>{PARTNERSHIP.proofDetail}</p>
        </div>
      </Reveal>

      <Reveal delay={250} className="mt-10">
        <Btn tone="solidOnDark" onClick={() => open("prospectus")}>
          {CTA.prospectus}
        </Btn>
        <p className={cn(BODY, "mt-6 max-w-[52ch] opacity-75")}>{PARTNERSHIP.supporting}</p>
      </Reveal>
    </SummitSection>
  );
}

/* 11 · ABOUT + CONTACT — track record, then the closing statement, then
   the one human. The contact block is composed complete without a
   portrait; when one is supplied it takes the reserved column without a
   relayout. */
function AboutContact() {
  const open = useModals();
  const { contact } = ABOUT;
  return (
    <SummitSection id="about" chapter="11 — About">
      <Reveal>
        <Eyebrow index="11" label="About" />
      </Reveal>
      <Reveal delay={70}>
        <h2 className={cn(SECTION_TYPE, "mt-8 max-w-[28ch]")}>{ABOUT.headline}</h2>
      </Reveal>

      {/* Three finance platforms, then the record, one rail each. */}
      <Reveal delay={130}>
        <div className="mt-14 grid grid-cols-1 border-t border-hairline sm:grid-cols-3 lg:mt-16">
          {ABOUT.platforms.map((p) => (
            <div
              key={p.name}
              className="border-b border-hairline py-6 sm:border-b-0 sm:py-8 sm:pr-8 sm:[&:nth-child(n+2)]:border-l sm:[&:nth-child(n+2)]:border-hairline sm:[&:nth-child(n+2)]:pl-8"
            >
              <h3 className="display-sm max-w-[16ch]">{p.name}</h3>
              <p className="label-lg mt-3 opacity-55">{p.years}</p>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={170}>
        <div className="grid grid-cols-1 border-y border-hairline sm:grid-cols-3">
          {ABOUT.trackRecord.map((item) => (
            <div
              key={item.value}
              className="border-b border-hairline py-6 last:border-b-0 sm:border-b-0 sm:py-8 sm:pr-8 sm:[&:nth-child(n+2)]:border-l sm:[&:nth-child(n+2)]:border-hairline sm:[&:nth-child(n+2)]:pl-8"
            >
              <p className="font-display text-[clamp(2rem,6vw,2.6rem)] font-extrabold leading-[0.85] tracking-[-0.035em] lg:text-[clamp(2.2rem,3vw,3rem)]">
                {item.value}
              </p>
              <p className="mt-3 text-base opacity-75">{item.line}</p>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={200}>
        <p className={cn(BODY, "mt-10 max-w-[58ch] opacity-80")}>{ABOUT.body}</p>
      </Reveal>
      <Reveal delay={230}>
        <div className="mt-10">
          <h3 className="label-lg accord-signal">{ABOUT.sponsorsHeading}</h3>
          <p className="mt-4 max-w-[72ch] text-[17px] leading-[1.9] opacity-85 lg:text-lg">
            {ABOUT.sponsors.join(" · ")}
          </p>
        </div>
      </Reveal>

      {/* The closing statement. */}
      <Reveal delay={250}>
        <div className="accord-hairline mt-16 border-t pt-10 lg:mt-20">
          {ABOUT.closing.map((line) => (
            <p key={line} className={cn(STATEMENT_TYPE)}>
              {line}
            </p>
          ))}
          <p className="display-sm mt-8">
            {SUMMIT.dates} · {SUMMIT.city}
          </p>
          <p className="label-lg mt-3 opacity-60">{ABOUT.closingMeta}</p>
        </div>
      </Reveal>

      {/* The human. Portrait column engages the moment an asset exists. */}
      <Reveal delay={280}>
        <div className="mt-14 grid gap-y-8 border border-hairline p-7 lg:mt-16 lg:grid-cols-12 lg:gap-x-12 lg:p-10">
          {contact.portrait ? (
            <figure className="relative aspect-[4/5] w-full max-w-[300px] overflow-hidden bg-bone lg:col-span-4">
              <img
                src={contact.portrait}
                alt={`Portrait of ${contact.name}`}
                className="absolute inset-0 h-full w-full object-cover grayscale"
                loading="lazy"
                decoding="async"
              />
            </figure>
          ) : null}
          <div className={cn("min-w-0", contact.portrait ? "lg:col-span-8" : "lg:col-span-12")}>
            <h3 className="display-md">{contact.name}</h3>
            <p className={cn(BODY, "mt-3 opacity-75")}>{contact.roles.join(" · ")}</p>
            <p className="mt-6 text-[17px] font-medium lg:text-lg">
              <a
                href={`mailto:${contact.email}`}
                className="underline decoration-ink/25 underline-offset-4 transition-opacity duration-300 hover:opacity-70"
              >
                {contact.email}
              </a>
            </p>
            <p className="mt-2 text-[17px] font-medium lg:text-lg">
              <a
                href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                className="underline decoration-ink/25 underline-offset-4 transition-opacity duration-300 hover:opacity-70"
              >
                {contact.phone}
              </a>
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Btn tone="solidOnLight" onClick={() => open("prospectus")}>
                {CTA.prospectus}
              </Btn>
              <Btn tone="quietOnLight" onClick={() => open("apply")}>
                {CTA.apply}
              </Btn>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={300}>
        <p className="mt-10 border-t border-hairline pt-6 font-mono text-[15px] uppercase tracking-[0.14em] opacity-60">
          {ABOUT.evidenceLine}
        </p>
      </Reveal>
    </SummitSection>
  );
}

/* FINAL CTA BAND — a closing plate, not a content section. */
function FinalBand() {
  const open = useModals();
  return (
    <Section tone="ink" className="border-t-2">
      <div className="flex flex-col gap-y-8 py-2 lg:flex-row lg:items-center lg:justify-between lg:gap-x-12">
        <Reveal>
          <p className="font-display max-w-[30ch] text-[clamp(1.15rem,3.4vw,1.5rem)] font-extrabold uppercase leading-[1.25] tracking-[-0.015em] lg:text-[clamp(1.25rem,1.8vw,1.65rem)]">
            {FINAL_BAND}
          </p>
        </Reveal>
        <Reveal delay={90} className="flex shrink-0 flex-wrap items-center gap-4">
          <Btn tone="solidOnDark" onClick={() => open("prospectus")}>
            {CTA.prospectus}
          </Btn>
          <Btn tone="quietOnDark" onClick={() => open("apply")}>
            {CTA.apply}
          </Btn>
        </Reveal>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- footer */

function SummitFooter() {
  return (
    <footer className="border-t border-hairline-invert bg-ink text-paper">
      <div className="px-6 py-16 md:px-10 lg:px-16">
        <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              <FinancialRailsIcon className="h-9 w-9" />
              <span className="font-display text-sm font-extrabold uppercase leading-[0.95] tracking-tight">
                Financial
                <br />
                Rails
              </span>
            </div>
            <p className="mt-6 max-w-[38ch] text-base leading-relaxed opacity-75">{FOOTER.line}</p>
          </div>
          <div className="lg:col-span-7">
            <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-3">
              {SUMMIT_NAV.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="font-mono text-[14px] uppercase tracking-[0.16em] opacity-70 transition-opacity duration-300 hover:opacity-100"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <p className="mt-8 text-base opacity-75">
              <a
                href={`mailto:${FOOTER.email}`}
                className="transition-opacity duration-300 hover:opacity-70"
              >
                {FOOTER.email}
              </a>
              {" · "}
              {FOOTER.location}
            </p>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-hairline-invert pt-7 md:flex-row md:items-center md:justify-between">
          {/* Privacy and Terms have no routes yet, so they are inert text —
              a link that 404s would be worse than a word that waits. */}
          <p className="text-sm opacity-60">Privacy · Terms · {FOOTER.legal}</p>
          <p className="font-mono text-[14px] uppercase tracking-[0.16em] opacity-60">
            {FOOTER.evidence}
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ page */

export function FinancialRailsSummit() {
  const [modal, setModal] = useState<ModalKind>(null);
  const openRef = useRef<(k: Exclude<ModalKind, null>) => void>(() => {});
  openRef.current = (k) => setModal(k);

  return (
    <ModalCtx.Provider value={(k) => openRef.current(k)}>
      <div className="summit-scope">
        <SummitNav />
        <main>
          <Hero />
          <TheMarket />
          <TheRoom />
          <WhoIsInIt />
          <HowItWorks />
          <TheDifference />
          <TheAgenda />
          <TheVoices />
          <TheWindow />
          <Partnership />
          <AboutContact />
          <FinalBand />
        </main>
        <SummitFooter />
        {modal ? <LeadModal kind={modal} onClose={() => setModal(null)} /> : null}
      </div>
    </ModalCtx.Provider>
  );
}
