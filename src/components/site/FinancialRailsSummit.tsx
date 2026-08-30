import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  AGENDA,
  VOICES,
  PARTNER_LOGOS,
  WINDOW,
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

/**
 * THE CASE RULE, which is this page's whole readability strategy.
 *
 * Uppercase survives in exactly two roles: the DISPLAY VOICE — masthead,
 * section headlines, statement stacks — and the MONO MARKERS that are read
 * as position rather than as language: the chapter rail, section numerals,
 * nav links and button labels, all set at 13px with 0.18em tracking.
 *
 * Everything a reader parses as a sentence is sentence case. Names, track
 * titles, block subheads, descriptors, footnotes, captions, the whole of
 * the body. Nothing else changes: same Archivo, same IBM Plex, same weights,
 * same ink/paper/bone tokens, same hairlines, same periwinkle accent.
 */

/* Every section headline sits one confident step below the hero. */
const SECTION_TYPE =
  "font-display text-[clamp(1.5rem,5.4vw,2.1rem)] font-extrabold uppercase leading-[0.94] tracking-[-0.028em] lg:text-[clamp(1.8rem,2.9vw,2.6rem)]";

/* Statement stacks — the page's loudest device after the hero. */
const STATEMENT_TYPE =
  "font-display text-[clamp(1.55rem,5.8vw,2.2rem)] font-extrabold uppercase leading-[1.06] tracking-[-0.028em] lg:text-[clamp(1.9rem,3.1vw,2.9rem)]";

/* Sentence-case display: the site's own Archivo at display weight with
   `uppercase` withheld. Replaces `display-sm`/`display-md` everywhere those
   were carrying language — a person's name, a track title, a block subhead.
   Page-scoped constants, so the shared utilities are untouched and every
   other page renders exactly as before. */
const SUBHEAD =
  "font-display text-[1.25rem] font-bold leading-[1.3] tracking-[-0.012em] lg:text-[1.35rem]";
const SUBHEAD_LG =
  "font-display text-[1.4rem] font-bold leading-[1.25] tracking-[-0.015em] lg:text-[1.65rem]";

/* The mono block-label, one case down: introduces a block without shouting
   at it. Same family, same 13px+ floor, tracking relaxed for sentence case. */
const SUBLABEL = "font-mono text-[0.9375rem] font-medium tracking-[0.08em]";

/* Body copy: 17px floor, 1.7 leading — comfortably past the brief's 16px
   and 1.7 minimums at every width. */
const BODY = "text-[17px] leading-[1.7] lg:text-lg";

/* Secondary prose: footnotes, captions, meta. Never below the 16px floor. */
const BODY_SM = "text-base leading-[1.7]";

/* The measure: 60–70 actual characters per line, the band where the eye
   finds the next line without hunting for it.

   NOT `max-w-[66ch]`. The `ch` unit is the advance of "0", roughly 0.6em in
   IBM Plex Sans, while an average lowercase character is nearer 0.5em — so
   66ch sets about 79 characters, a fifth past the target. 56ch measures out
   at 64–67, verified in the rendered DOM rather than assumed. */
const MEASURE = "max-w-[56ch]";

/* The page's vertical rhythm. 112px of padding at the narrowest width and
   160px from lg, top and bottom, so no two sections are ever closer than
   224px and every boundary is a genuine pause. */
const SECTION_PAD = "px-6 py-28 md:px-14 md:py-32 lg:px-20 lg:py-40";

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

/* -------------------------------------------------------------- count-up */

/* useLayoutEffect warns when React runs it on the server, and this one must
   run before the browser paints. Same hook, chosen per environment. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A figure that counts up once, the first time it enters the viewport.
 *
 * The authored string is the source of truth — "$58B", "~220", "1,200+" —
 * so the prefix and suffix are preserved verbatim and only the numeral
 * moves. Grouping is re-applied every frame when the authored value carried
 * a comma, so 1,200 never briefly reads as 1200.
 *
 * The FINAL value is what renders on the server and sits in the HTML, so the
 * number is right with JavaScript off and right for a crawler. The zeroing
 * happens in a layout effect — after hydration, before the first paint — so
 * the reader never sees the answer flash before the count.
 */
function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const match = value.match(/\d[\d,]*/);
    if (!match) return;
    const digits = match[0];
    const at = match.index ?? 0;
    const target = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(target) || target === 0) return;

    const prefix = value.slice(0, at);
    const suffix = value.slice(at + digits.length);
    const grouped = digits.includes(",");
    const render = (n: number) =>
      `${prefix}${grouped ? n.toLocaleString("en-US") : String(n)}${suffix}`;

    setShown(render(0));

    let frame = 0;
    let start = 0;
    const DURATION = 1400;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / DURATION);
      /* easeOutExpo: most of the distance early, then a long settle, so the
         final figure is legible well before the motion actually stops. */
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setShown(render(Math.round(target * eased)));
      if (t < 1) frame = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            frame = requestAnimationFrame(step);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.2 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  /* tabular-nums: proportional digits change width as they climb, and a
     figure this large would visibly jitter for the whole 1.4 seconds. */
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {shown}
    </span>
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
            <Dialog.Title className={cn(SUBHEAD_LG, "max-w-[16ch]")}>{heading}</Dialog.Title>
            <Dialog.Close className="label-lg opacity-50 transition-opacity duration-300 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
              Close
            </Dialog.Close>
          </div>

          {done ? (
            <div className="mt-8 border-t border-ink/15 pt-8">
              <p className={SUBHEAD_LG}>Received.</p>
              <p className={cn(BODY, MEASURE, "mt-5 opacity-80")}>{note}</p>
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
              <p className={cn(BODY_SM, MEASURE, "opacity-70")}>{note}</p>
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
      contentClassName={SECTION_PAD}
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

          {/* Seven destinations, not six: at the old xl breakpoint and 28px
              gaps, four of the labels broke onto two lines. The links no
              longer wrap and the inline nav appears only where all seven
              actually fit; below that the existing menu button carries them,
              unchanged. */}
          <nav aria-label="Summit" className="hidden items-center gap-6 min-[1400px]:flex">
            {SUMMIT_NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="label-lg whitespace-nowrap opacity-70 transition-opacity duration-300 hover:opacity-100"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => open("apply")}
              className="group label-lg hidden items-center gap-3 whitespace-nowrap opacity-80 transition-opacity duration-300 hover:opacity-100 md:inline-flex"
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
              className="label-lg border border-hairline-invert px-4 py-3 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-paper hover:text-ink min-[1400px]:hidden"
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
          "fixed inset-0 z-40 bg-ink text-paper transition-[opacity,visibility] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] min-[1400px]:hidden motion-reduce:transition-none",
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
            <Reveal delay={190} className="mt-14 border-t border-hairline-invert pt-9 lg:mt-16">
              <p className={cn(SUBHEAD_LG, "opacity-95")}>{SUMMIT.dateline}</p>
            </Reveal>
            {/* One solid door; the second is a quiet text door, related but
                clearly subordinate. */}
            <Reveal delay={240} className="mt-8 flex flex-wrap items-center gap-5">
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
              <p className={cn(BODY, "mt-12 max-w-[46ch] opacity-75")}>{SUMMIT.trustLine}</p>
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
                className="summit-zoom object-[46%_50%]"
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
            <div className="mt-16 border-y border-hairline py-14 lg:mt-20 lg:py-16">
              <p className="font-display text-[clamp(3.4rem,15vw,4.75rem)] font-extrabold leading-[0.8] tracking-[-0.045em] lg:text-[clamp(4rem,7.6vw,6rem)]">
                <CountUp value={MARKET.primaryStat.value} />
              </p>
              <p className={cn(BODY, MEASURE, "mt-7 opacity-70")}>{MARKET.primaryStat.line}</p>
            </div>
          </Reveal>

          {/* THE SHAPE. A supporting pair, set a clear step down. */}
          <Reveal delay={170}>
            <div className="grid grid-cols-1 border-b border-hairline sm:grid-cols-2">
              {MARKET.supportingStats.map((stat) => (
                <div
                  key={stat.value}
                  className="border-b border-hairline py-12 last:border-b-0 sm:border-b-0 sm:pr-12 sm:[&:nth-child(2)]:border-l sm:[&:nth-child(2)]:border-hairline sm:[&:nth-child(2)]:pl-12 lg:py-14"
                >
                  <p className="font-display text-[clamp(2.1rem,8vw,2.8rem)] font-extrabold leading-[0.85] tracking-[-0.04em] lg:text-[clamp(2.25rem,4.2vw,3.4rem)]">
                    <CountUp value={stat.value} />
                  </p>
                  <p className={cn(BODY, "mt-6 max-w-[34ch] opacity-70")}>{stat.line}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* THE CONCLUSION — momentum, and the hand-off to 03. */}
          <Reveal delay={220}>
            <div className="accord-hairline mt-20 border-t-2 pt-12 lg:mt-24 lg:pt-14">
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
            <div className="mt-16 border-y border-hairline py-14 lg:mt-20 lg:py-16">
              <p className="font-display text-[clamp(3rem,13vw,4rem)] font-extrabold leading-[0.8] tracking-[-0.045em] lg:text-[clamp(3.2rem,4.6vw,4.6rem)]">
                <CountUp value={ROOM.primaryStat.value} />
              </p>
              <p className={cn(BODY, MEASURE, "mt-7 opacity-70")}>{ROOM.primaryStat.line}</p>
            </div>
          </Reveal>

          {/* THE COMPOSITION OF IT. 02's supporting pair, verbatim structure:
              one row, two tracks, a rule between them at sm and up. */}
          <Reveal delay={170}>
            <div className="grid grid-cols-1 border-b border-hairline sm:grid-cols-2">
              {ROOM.supportingStats.map((stat) => (
                <div
                  key={stat.value}
                  className="border-b border-hairline py-12 last:border-b-0 sm:border-b-0 sm:pr-12 sm:[&:nth-child(2)]:border-l sm:[&:nth-child(2)]:border-hairline sm:[&:nth-child(2)]:pl-12 lg:py-14"
                >
                  <p className="font-display text-[clamp(1.9rem,7.4vw,2.4rem)] font-extrabold leading-[0.85] tracking-[-0.04em] lg:text-[clamp(2rem,2.7vw,2.8rem)]">
                    <CountUp value={stat.value} />
                  </p>
                  <p className={cn(BODY, "mt-6 max-w-[34ch] opacity-70")}>{stat.line}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* THE POLICY — 02's closing block: one accent rule, then the
              statement. Three operating principles, generous rhythm. */}
          <Reveal delay={220}>
            <div className="accord-hairline mt-20 border-t-2 pt-12 lg:mt-24 lg:pt-14">
              {ROOM.philosophy.map((line) => (
                <p
                  key={line}
                  className="font-display py-3 text-[clamp(1.5rem,6.2vw,2.3rem)] font-extrabold uppercase leading-[1.06] tracking-[-0.03em] lg:py-4 lg:text-[clamp(1.9rem,3.1vw,2.9rem)]"
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

/* 04 · THE PEOPLE — a third photographic mode, deliberately. 02 anchors a
   sticky frame beside the argument; 03 mirrors it. Here the photograph is
   the section's own moment: full content width, between the claim and the
   index, so the room is met as people before it is read as a taxonomy.

   The five constituencies are an editorial index, not cards — a number, a
   title and one line, on hairlines. Four run as a two-column register; the
   fifth takes the full width, which reads as the closing item rather than a
   leftover in an empty second column. */
function ThePeople() {
  const open = useModals();
  return (
    <SummitSection id="the-people" chapter="04 — The People" tone="ink">
      <Reveal>
        <Eyebrow index="04" label={AUDIENCE.label} invert />
      </Reveal>
      <Reveal delay={60}>
        {/* Authored at the comma: the conditional gets its own line, which
            is where the sentence turns. */}
        <h2 className={cn(SECTION_TYPE, "mt-7 lg:mt-0")}>
          <span className="block">The audience you'd build by hand,</span>
          <span className="block">if you had six months and a licence register.</span>
        </h2>
      </Reveal>

      {/* THE ROOM, AS PEOPLE. The section's major visual moment: full
          content width, 16/9 at its native ratio so the two figures are
          uncropped, tightening toward the subjects on narrower screens. */}
      <Reveal delay={120}>
        <figure className="relative mt-16 aspect-[4/3] w-full overflow-hidden bg-ink sm:aspect-[16/10] lg:mt-20 lg:aspect-[16/9]">
          <SummitPhoto
            photo={PHOTO_NETWORKING}
            sizes="(min-width:1024px) calc(100vw - 224px), 100vw"
          />
        </figure>
      </Reveal>

      {/* THE INDEX. */}
      <Reveal delay={170}>
        <div className="mt-16 grid grid-cols-1 border-t border-hairline-invert sm:grid-cols-2 lg:mt-20">
          {AUDIENCE.groups.map((group, i) => (
            <div
              key={group.role}
              className={cn(
                /* The five constituencies breathe: 48px of air above and
                   below each entry at lg, against the 32px they had. A list
                   this short can afford to be read slowly. */
                "min-w-0 border-b border-hairline-invert py-10 lg:py-14",
                /* The vertical rule falls between the two columns only, and
                   the fifth item spans both so it closes the register. */
                "sm:[&:nth-child(even)]:border-l sm:[&:nth-child(even)]:border-hairline-invert sm:[&:nth-child(even)]:pl-12 sm:[&:nth-child(odd)]:pr-12 lg:[&:nth-child(even)]:pl-16 lg:[&:nth-child(odd)]:pr-16",
                i === 4 && "sm:col-span-2 sm:pr-0 lg:pr-0",
              )}
            >
              <p className="label-lg accord-signal-invert">{String(i + 1).padStart(2, "0")}</p>
              <h3 className={cn(SUBHEAD, "mt-6 max-w-[30ch]")}>{group.role}</h3>
              <p className={cn(BODY, MEASURE, "mt-4 opacity-70")}>{group.line}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* THE INVITATION — a door, not a form. */}
      <Reveal delay={220}>
        <div className="mt-20 lg:mt-24">
          <p className={cn(STATEMENT_TYPE, "max-w-[22ch]")}>{AUDIENCE.closingHeadline}</p>
          <p className={cn(BODY, MEASURE, "mt-6 opacity-80")}>{AUDIENCE.closingLine}</p>
          <div className="mt-10">
            <Btn tone="solidOnDark" onClick={() => open("apply")}>
              {CTA.apply}
            </Btn>
          </div>
        </div>
      </Reveal>
    </SummitSection>
  );
}

/* 05 · THE AGENDA — the programme as one vertical list.
   ------------------------------------------------------------------------
   It ran as a six-item column beside a sticky stage photograph, which is
   two dense things fighting for the same band: the tracks got half the
   measure, and every title-plus-line landed in a 24px row. The list now
   takes the full width, one item per row, a hairline between and nothing
   else — and the photograph moves BELOW it, where it reads as a held breath
   between the programme and the terms it runs on rather than as a wall
   beside the text. Titles go up a step so the hierarchy inside a row is
   legible without a rule to enforce it. */
function TheAgenda() {
  return (
    <SummitSection id="agenda" chapter="05 — The Agenda">
      <Reveal>
        <Eyebrow index="05" label="The Agenda" />
      </Reveal>
      <Reveal delay={70}>
        <h2 className={cn(SECTION_TYPE, "mt-8 max-w-[24ch]")}>{AGENDA.headline}</h2>
      </Reveal>

      <div className="mt-16 border-t border-hairline lg:mt-20">
        {AGENDA.tracks.map((track, i) => (
          <Reveal key={track.title} delay={80 + i * 45}>
            {/* The numeral holds its own track from sm, so the titles align
                on a single edge down the whole list. Below that it stacks —
                a 4rem gutter on a 340px screen is a third of the measure. */}
            <div className="grid grid-cols-1 gap-y-3 border-b border-hairline py-10 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-x-8 lg:grid-cols-[6rem_minmax(0,1fr)] lg:gap-x-12 lg:py-14">
              <p className="label-lg accord-signal sm:pt-2">{String(i + 1).padStart(2, "0")}</p>
              <div className="min-w-0">
                <h3 className={SUBHEAD_LG}>{track.title}</h3>
                <p className={cn(BODY, MEASURE, "mt-4 opacity-70")}>{track.line}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={140}>
        {/* Full width and shallow: a band, not a block. The master is 16:9
            with the speaker at frame-left, so a 21:9 crop only takes from
            the top and bottom — the vertical bias keeps the podium and the
            heads in shot rather than the ceiling. */}
        <figure className="relative mt-16 aspect-[4/3] w-full overflow-hidden bg-bone sm:aspect-[16/10] lg:mt-20 lg:aspect-[21/9]">
          <SummitPhoto
            photo={PHOTO_STAGE}
            sizes="(min-width:1024px) calc(100vw - 224px), 100vw"
            className="object-[22%_38%]"
          />
        </figure>
      </Reveal>

      {/* The programme's shape. Sentence case at subhead scale: it is a
          description of the format, and it was being shouted. */}
      <Reveal delay={180}>
        <p
          className={cn(
            SUBHEAD,
            "mt-16 max-w-[54ch] border-y border-hairline py-10 leading-[1.5] lg:mt-20 lg:py-12",
          )}
        >
          {AGENDA.format}
        </p>
      </Reveal>

      <Reveal delay={220}>
        <div className="mt-16 lg:mt-20">
          {AGENDA.refusals.map((line) => (
            <p key={line} className={cn(STATEMENT_TYPE, "py-1.5")}>
              {line}
            </p>
          ))}
          <p className={cn(BODY, MEASURE, "accord-signal mt-8 text-lg lg:text-xl leading-[1.6]")}>
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
    <SummitSection id="speakers" chapter="06 — The Voices" tone="ink">
      <Reveal>
        <Eyebrow index="06" label="The Voices" invert />
      </Reveal>
      <Reveal delay={70}>
        <h2 className={cn(SECTION_TYPE, "mt-8 max-w-[26ch]")}>{VOICES.headline}</h2>
      </Reveal>

      <Reveal delay={130} className="mt-16 border-t border-hairline-invert pt-10 lg:mt-20">
        <h3 className={cn(SUBLABEL, "accord-signal-invert")}>{VOICES.subhead}</h3>
      </Reveal>

      <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-16 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-10">
        {VOICES.speakers.map((person, i) => (
          <Reveal key={person.name} delay={120 + (i % 4) * 50}>
            <figure className="group">
              <div className="summit-portrait-fade relative aspect-[4/5] w-full overflow-hidden">
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
              {/* The name is a name, not a headline: sentence case, and a
                  real gap before the title so the two stop reading as one
                  four-line block. */}
              <figcaption className="mt-5">
                <p className={SUBHEAD}>{person.name}</p>
                <p className={cn(BODY_SM, "mt-4 opacity-70")}>{person.title}</p>
                <p className={cn(BODY_SM, "accord-signal-invert mt-1.5")}>{person.org}</p>
              </figcaption>
            </figure>
          </Reveal>
        ))}
        {/* The eighth cell: the roster's own footnote, set as part of the
            wall rather than dropped beneath it. */}
        <Reveal delay={320} className="col-span-2 self-end md:col-span-3 lg:col-span-1">
          <p className={cn(BODY_SM, "border-t border-hairline-invert pt-6 opacity-65")}>
            {VOICES.footnote}
          </p>
        </Reveal>
      </div>

      {/* Approved commercial partner logos only — the block does not exist
          until an allowlist does. */}
      {PARTNER_LOGOS.length > 0 ? (
        <Reveal delay={200} className="mt-20 border-t border-hairline-invert pt-10">
          <h3 className={cn(SUBLABEL, "accord-signal-invert")}>Partners across our platforms</h3>
          <div className="mt-10 flex flex-wrap items-center gap-10">
            {PARTNER_LOGOS.map((logo) => (
              <img key={logo.name} src={logo.src} alt={logo.name} className="h-8 w-auto" />
            ))}
          </div>
        </Reveal>
      ) : null}

      <Reveal delay={220} className="mt-20 border-t border-hairline-invert pt-10 lg:mt-24">
        <h3 className={cn(SUBLABEL, "accord-signal-invert")}>{VOICES.institutionsHeading}</h3>
        <p className={cn(BODY, MEASURE, "mt-8 leading-[1.9] opacity-85")}>
          {VOICES.institutions.join(" · ")}
        </p>
        <p className={cn(BODY_SM, MEASURE, "mt-6 opacity-55")}>{VOICES.institutionsFootnote}</p>
      </Reveal>
    </SummitSection>
  );
}

/* 07 · THE WINDOW — two dense text columns, rebuilt as a vertical timeline.
   ------------------------------------------------------------------------
   The clock and the city were set side by side at 7 and 4 columns, which
   made two narrow measures the eye had to choose between and gave neither
   any air. They now run as one column, stacked, both hung off a single
   hairline rail: the entries descend, which is what a timeline is, and each
   one gets its own band of silence. */

/** One run of the timeline: a heading, a rail, and entries hung off it. */
function TimelineRun({
  heading,
  items,
  delay,
}: {
  heading: string;
  items: readonly { title: string; line: string }[];
  delay: number;
}) {
  return (
    <div>
      <Reveal delay={delay}>
        <h3 className={cn(SUBLABEL, "accord-signal")}>{heading}</h3>
      </Reveal>

      {/* THE RAIL. A single hairline running the height of the run, with
          each entry hung off it by a short connector — the same hairline
          language the rest of the page is built from, turned ninety
          degrees. No dots, no markers, no icons: the rule IS the device.
          The connector widths match the padding exactly at each breakpoint,
          so it meets the rail on one side and the type on the other. */}
      <div className="mt-10 border-l border-hairline pl-8 md:pl-12 lg:pl-16">
        {items.map((item, i) => (
          <Reveal key={item.title} delay={delay + 40 + i * 45}>
            <div className="relative py-9 lg:py-12">
              <span
                aria-hidden
                className="absolute top-[1.1rem] right-full h-px w-8 bg-current opacity-20 md:w-12 lg:w-16"
              />
              <h4 className={SUBHEAD}>{item.title}</h4>
              <p className={cn(BODY, MEASURE, "mt-4 opacity-70")}>{item.line}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function TheWindow() {
  return (
    <SummitSection id="the-window" chapter="07 — The Window">
      <Reveal>
        <Eyebrow index="07" label="The Window" />
      </Reveal>
      <Reveal delay={70}>
        <h2 className={cn(SECTION_TYPE, "mt-8 max-w-[24ch]")}>{WINDOW.headline}</h2>
      </Reveal>

      <div className="mt-16 space-y-20 lg:mt-20 lg:space-y-28">
        <TimelineRun heading={WINDOW.clockHeading} items={WINDOW.clock} delay={100} />
        <TimelineRun heading={WINDOW.cityHeading} items={WINDOW.city} delay={140} />
      </div>

      <Reveal delay={200}>
        <div className="accord-hairline mt-20 border-t pt-12 lg:mt-24 lg:pt-14">
          {WINDOW.closing.map((line) => (
            <p key={line} className={cn(STATEMENT_TYPE, "py-1.5")}>
              {line}
            </p>
          ))}
        </div>
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
    <SummitSection id="about" chapter="08 — About">
      <Reveal>
        <Eyebrow index="08" label="About" />
      </Reveal>
      <Reveal delay={70}>
        <h2 className={cn(SECTION_TYPE, "mt-8 max-w-[28ch]")}>{ABOUT.headline}</h2>
      </Reveal>

      {/* Three finance platforms, then the record, one rail each. */}
      <Reveal delay={130}>
        <div className="mt-16 grid grid-cols-1 border-t border-hairline sm:grid-cols-3 lg:mt-20">
          {ABOUT.platforms.map((p) => (
            <div
              key={p.name}
              className="border-b border-hairline py-10 sm:border-b-0 sm:py-12 sm:pr-10 sm:[&:nth-child(n+2)]:border-l sm:[&:nth-child(n+2)]:border-hairline sm:[&:nth-child(n+2)]:pl-10 lg:py-14"
            >
              <h3 className={cn(SUBHEAD, "max-w-[18ch]")}>{p.name}</h3>
              <p className="label-lg mt-4 opacity-55">{p.years}</p>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={170}>
        <div className="grid grid-cols-1 border-y border-hairline sm:grid-cols-3">
          {ABOUT.trackRecord.map((item) => (
            <div
              key={item.value}
              className="border-b border-hairline py-12 last:border-b-0 sm:border-b-0 sm:py-14 sm:pr-10 sm:[&:nth-child(n+2)]:border-l sm:[&:nth-child(n+2)]:border-hairline sm:[&:nth-child(n+2)]:pl-10 lg:py-16 lg:pr-16 lg:[&:nth-child(n+2)]:pl-16"
            >
              <p className="font-display text-[clamp(2rem,6vw,2.6rem)] font-extrabold leading-[0.85] tracking-[-0.035em] lg:text-[clamp(2.2rem,3vw,3rem)]">
                <CountUp value={item.value} />
              </p>
              <p className={cn(BODY, "mt-5 opacity-70")}>{item.line}</p>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={200}>
        <p className={cn(BODY, MEASURE, "mt-14 opacity-80")}>{ABOUT.body}</p>
      </Reveal>
      <Reveal delay={230}>
        <div className="mt-14">
          <h3 className={cn(SUBLABEL, "accord-signal")}>{ABOUT.sponsorsHeading}</h3>
          <p className={cn(BODY, MEASURE, "mt-6 leading-[1.9] opacity-85")}>
            {ABOUT.sponsors.join(" · ")}
          </p>
        </div>
      </Reveal>

      {/* The closing statement. */}
      <Reveal delay={250}>
        <div className="accord-hairline mt-20 border-t pt-12 lg:mt-24 lg:pt-14">
          {ABOUT.closing.map((line) => (
            <p key={line} className={cn(STATEMENT_TYPE, "py-1.5")}>
              {line}
            </p>
          ))}
          <p className={cn(SUBHEAD_LG, "mt-10")}>
            {SUMMIT.dates} · {SUMMIT.city}
          </p>
          <p className={cn(BODY_SM, "mt-4 opacity-60")}>{ABOUT.closingMeta}</p>
        </div>
      </Reveal>

      {/* The human. Portrait column engages the moment an asset exists. */}
      <Reveal delay={280}>
        <div className="mt-20 grid gap-y-10 border border-hairline p-8 lg:mt-24 lg:grid-cols-12 lg:gap-x-16 lg:p-14">
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
            <h3 className={SUBHEAD_LG}>{contact.name}</h3>
            <p className={cn(BODY, "mt-4 opacity-70")}>{contact.roles.join(" · ")}</p>
            <p className={cn(BODY, "mt-8 font-medium")}>
              <a
                href={`mailto:${contact.email}`}
                className="underline decoration-ink/25 underline-offset-4 transition-opacity duration-300 hover:opacity-70"
              >
                {contact.email}
              </a>
            </p>
            <p className={cn(BODY, "mt-3 font-medium")}>
              <a
                href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                className="underline decoration-ink/25 underline-offset-4 transition-opacity duration-300 hover:opacity-70"
              >
                {contact.phone}
              </a>
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-5">
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
    </SummitSection>
  );
}

/* FINAL CTA BAND — a closing plate, not a content section. */
function FinalBand() {
  const open = useModals();
  return (
    <Section tone="ink" className="border-t-2" contentClassName={SECTION_PAD}>
      <div className="flex flex-col gap-y-10 lg:flex-row lg:items-center lg:justify-between lg:gap-x-16">
        <Reveal>
          <p className="font-display max-w-[30ch] text-[clamp(1.15rem,3.4vw,1.5rem)] font-extrabold uppercase leading-[1.25] tracking-[-0.015em] lg:text-[clamp(1.25rem,1.8vw,1.65rem)]">
            {FINAL_BAND}
          </p>
        </Reveal>
        <Reveal delay={90} className="flex shrink-0 flex-wrap items-center gap-5">
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

/* THE EVIDENCE — its own plate, immediately above the footer.
   ------------------------------------------------------------------------
   This sentence spent the build as a 15px mono line tucked under the
   contact card, which is where a caveat goes. It is not a caveat; it is the
   page's standing offer, and the whole argument above it is made of
   numbers. So it gets a band of its own, a tonal shift the eye cannot miss
   between the two ink plates around it, and display type at statement
   scale — sentence case, because it is a sentence. */
function EvidenceBand() {
  return (
    <Section tone="bone" contentClassName={SECTION_PAD}>
      <Reveal>
        <p className="font-display max-w-[22ch] text-[clamp(1.5rem,5.6vw,2.1rem)] font-bold leading-[1.22] tracking-[-0.02em] lg:max-w-[28ch] lg:text-[clamp(1.8rem,2.9vw,2.7rem)]">
          {ABOUT.evidenceLine}
        </p>
      </Reveal>
    </Section>
  );
}

/* ---------------------------------------------------------------- footer */

function SummitFooter() {
  return (
    <footer className="border-t border-hairline-invert bg-ink text-paper">
      <div className="px-6 py-24 md:px-14 lg:px-20 lg:py-28">
        <div className="grid gap-y-14 lg:grid-cols-12 lg:gap-x-16">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              <FinancialRailsIcon className="h-9 w-9" />
              <span className="font-display text-sm font-extrabold uppercase leading-[0.95] tracking-tight">
                Financial
                <br />
                Rails
              </span>
            </div>
            <p className={cn(BODY_SM, "mt-8 max-w-[42ch] opacity-75")}>{FOOTER.line}</p>
          </div>
          <div className="lg:col-span-7">
            <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-4">
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
            <p className={cn(BODY_SM, "mt-10 opacity-75")}>
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
        <div className="mt-16 flex flex-col gap-4 border-t border-hairline-invert pt-10 md:flex-row md:items-center md:justify-between">
          {/* Privacy and Terms have no routes yet, so they are inert text —
              a link that 404s would be worse than a word that waits. */}
          <p className={cn(BODY_SM, "opacity-60")}>Privacy · Terms · {FOOTER.legal}</p>
          <p className={cn(BODY_SM, "opacity-60")}>{FOOTER.evidence}</p>
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
          <ThePeople />
          <TheAgenda />
          <TheVoices />
          <TheWindow />
          <AboutContact />
          <FinalBand />
          <EvidenceBand />
        </main>
        <SummitFooter />
        {modal ? <LeadModal kind={modal} onClose={() => setModal(null)} /> : null}
      </div>
    </ModalCtx.Provider>
  );
}
