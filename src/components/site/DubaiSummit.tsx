import {
  createContext,
  useCallback,
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
  EVENT,
  CTA,
  CHAPTERS,
  SPONSORS,
  THE_SUMMIT,
  MARKET,
  IN_NUMBERS,
  SPEAKERS,
  MEET,
  AGENDA,
  ATTENDED_BY,
  ATTENDED_BY_MARKS,
  EXPERIENCE,
  PARTNER,
  MEDIA,
  TESTIMONIALS,
  TESTIMONIALS_COPY,
  speakerById,
  FINAL_CTA,
  FOOTER,
  submitLead,
  type LeadPayload,
} from "@/lib/dubai-summit";

/**
 * FINANCIAL RAILS SUMMIT MENA — the NEW Dubai Summit microsite, page-scoped.
 * /forum/dubai-summit. A ground-up implementation: it shares the platform's
 * identity (Archivo display, IBM Plex body and mono, paper/bone/ink, hairline
 * rules, the periwinkle accent pair, the left chapter rail) and nothing of
 * the legacy MENA page's layouts.
 *
 * The page's two governing rules, from the brief:
 *
 * NO WASTED REAL ESTATE — section padding is roughly two-thirds of the
 * legacy page's, proof strips run thin, and every section is composed to be
 * as short as it can be without cramping.
 *
 * NO MUTED CONTENT — no opacity tricks anywhere in the running text.
 * Hierarchy is carried by size, weight, family (display vs sans vs mono) and
 * the accent, never by fading words out. The only sub-100% text on the page
 * is the chapter rail itself, which is the platform's own device.
 */

/* ------------------------------------------------------------ type scale */

/* The masthead and proposition — the approved hero lockup, carried over. */
const MASTHEAD_TYPE =
  "font-display text-[clamp(2.15rem,8.8vw,4.5rem)] font-extrabold uppercase leading-[0.86] tracking-[-0.032em] lg:text-[clamp(2.4rem,calc(6.25vw-17px),4.6rem)]";
const PROPOSITION_TYPE =
  "font-display text-[clamp(1.25rem,4.9vw,2.1rem)] font-bold uppercase leading-[1.04] tracking-[-0.022em] lg:text-[clamp(1.35rem,calc(2.7vw-5px),2.2rem)]";

/* Every section headline sits one confident step below the hero. */
const SECTION_TYPE =
  "font-display text-[clamp(1.5rem,5.4vw,2.1rem)] font-extrabold uppercase leading-[0.94] tracking-[-0.028em] lg:text-[clamp(1.8rem,2.9vw,2.6rem)]";

/* Card and row titles: the display voice at working scale. */
const CARD_TITLE =
  "font-display text-[17px] font-bold uppercase leading-[1.15] tracking-[-0.012em] lg:text-[19px]";

/* Body 17px mobile / 18px desktop; support never below 16px. Full ink. */
const BODY = "text-[17px] leading-[1.6] lg:text-lg";
const SUPPORT = "text-base leading-[1.55]";

/* The page rhythm: compact by rule. Content sections, thin proof strips,
   and the hero (which owes the fixed header its top clearance). */
const PAD = "px-6 py-16 md:px-12 md:py-20 lg:px-16 lg:py-24";
const PAD_STRIP = "px-6 py-10 md:px-12 lg:px-16 lg:py-12";
const PAD_HERO = "px-6 pt-28 pb-14 md:px-12 md:pt-32 md:pb-16 lg:px-16 lg:pt-36 lg:pb-20";

/* ------------------------------------------------------------ photography */

type Photo = { base: string; widths: number[]; alt: string };

const PHOTO_HERO: Photo = {
  base: "/media/microsite/closing-frame",
  widths: [768, 1280, 1920, 2560, 3840],
  alt: "Delegates seated at round tables during a Vostad summit session in Dubai",
};
const PHOTO_SUMMIT: Photo = {
  base: "/media/microsite/who-in-room",
  widths: [480, 768, 1280, 1888],
  alt: "Two senior delegates in conversation at a Vostad finance event",
};
const PHOTO_STAGE: Photo = {
  base: "/media/financial-rails-v2/experience/keynote",
  widths: [480, 768, 1280, 1920],
  alt: "A speaker delivering opening remarks from a Vostad-branded summit stage",
};
const PHOTO_MEETINGS: Photo = {
  base: "/media/microsite/attend",
  widths: [480, 768, 1280, 1888],
  alt: "A senior delegate seated at a working table during a Vostad event session",
};
const PHOTO_NETWORKING: Photo = {
  base: "/media/financial-rails-v2/experience/networking",
  widths: [480, 768, 1280, 1920],
  alt: "Two senior delegates in conversation between sessions at a Vostad event",
};
const PHOTO_DINNER: Photo = {
  base: "/media/microsite/destination",
  widths: [768, 1280, 1920, 2560, 3840],
  alt: "A summit ballroom set with round tables during an evening session",
};
const PHOTO_ROOM: Photo = {
  base: "/media/financial-rails-v2/experience/panel",
  widths: [480, 768, 1280, 1920],
  alt: "A panel on stage in front of a full seated audience at a Vostad finance event",
};
const PHOTO_PARTNER: Photo = {
  base: "/media/microsite/partner",
  widths: [480, 768, 1280, 1888],
  alt: "Visitors at an interactive exhibition display at a Vostad event",
};

const FILM = {
  src: "/media/financial-rails-v2-hero.mp4",
  poster: "/media/financial-rails-v2-hero-poster.jpg",
};

const EXPERIENCE_PHOTOS = [PHOTO_STAGE, PHOTO_MEETINGS, PHOTO_NETWORKING, PHOTO_DINNER];

function DSPhoto({
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
        fetchPriority={loading === "eager" ? "high" : undefined}
        decoding="async"
        className={cn(
          "absolute inset-0 h-full w-full object-cover grayscale transition-[filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:grayscale-0 motion-reduce:transition-none",
          className,
        )}
      />
    </picture>
  );
}

/* The one event film, used twice with different frames. `autoplay` only
   fires at mount, and both instances can mount hidden (below lg, or under
   reduced motion) — the hook retries play() whenever the element is actually
   visible, and never plays for reduced-motion readers. */
function useFilmPlayback(ref: React.RefObject<HTMLVideoElement | null>) {
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
  }, [ref]);
}

function EventFilm({ className, label }: { className?: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useFilmPlayback(ref);
  return (
    <video
      ref={ref}
      className={cn("absolute inset-0 h-full w-full object-cover", className)}
      src={FILM.src}
      poster={FILM.poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={label}
    />
  );
}

/* -------------------------------------------------------------- count-up */

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A figure that counts up once, the first time it enters the viewport. The
 * authored string is the source of truth — "$58B", "~220", "370+" — so the
 * prefix and suffix are preserved verbatim and only the numeral moves. The
 * FINAL value is what renders on the server; the zeroing happens after
 * hydration and before first paint, so the answer never flashes early.
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
    const DURATION = 1100;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / DURATION);
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
      <span className="whitespace-nowrap">{children}</span>
      <span
        aria-hidden
        className="inline-block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5 motion-reduce:transition-none"
      >
        →
      </span>
    </button>
  );
}

/** Numbered in-canvas chapter marker. The rail carries the chapter at lg+,
    so this renders below lg only — one indicator at every width, never two. */
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
  const id = `dubai-${name}`;
  return (
    <label htmlFor={id} className="block">
      <span className="label-lg accord-signal block">{label}</span>
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
            <Dialog.Title className="font-display max-w-[16ch] text-[1.35rem] font-bold uppercase leading-[1.1] tracking-[-0.015em]">
              {heading}
            </Dialog.Title>
            <Dialog.Close className="label-lg transition-colors duration-300 hover:text-[var(--accord-orange-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
              Close
            </Dialog.Close>
          </div>

          {done ? (
            <div className="mt-8 border-t border-ink/15 pt-8">
              <p className="font-display text-[1.35rem] font-bold uppercase tracking-[-0.015em]">
                Received.
              </p>
              <p className={cn(BODY, "mt-4 max-w-[46ch]")}>{note}</p>
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
                <button
                  type="submit"
                  className="group label-lg inline-flex items-center gap-4 bg-ink px-7 py-4 text-paper transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-accent hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink motion-reduce:transition-none"
                >
                  <span>{heading}</span>
                  <span
                    aria-hidden
                    className="inline-block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5 motion-reduce:transition-none"
                  >
                    →
                  </span>
                </button>
              </div>
              <p className={cn(SUPPORT, "max-w-[46ch]")}>{note}</p>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ----------------------------------------------------------------- shell */

/** The chapters that actually render: gated ones (Testimonials) join the
    rail, the menu and the page only once their data exists. */
/* Every chapter renders now that Testimonials has content. */
const LIVE_CHAPTERS = CHAPTERS;

function DSSection({
  chapter,
  tone = "paper",
  pad = PAD,
  eyebrow = true,
  className,
  children,
}: {
  chapter: (typeof CHAPTERS)[number]["index"];
  tone?: "paper" | "bone" | "ink";
  pad?: string;
  eyebrow?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const c = CHAPTERS.find((x) => x.index === chapter)!;
  return (
    <Section
      id={c.id}
      label={`${c.index} — ${c.label}`}
      labelClassName="label-lg"
      contentClassName={pad}
      tone={tone}
      className={cn("scroll-mt-16", className)}
    >
      {eyebrow ? <Eyebrow index={c.index} label={c.label} invert={tone === "ink"} /> : null}
      {children}
    </Section>
  );
}

/* ------------------------------------------------------------------- nav */

function DSNav() {
  const open = useModals();
  const [menu, setMenu] = useState(false);
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-hairline-invert bg-ink/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-6 px-6 py-4 text-paper md:px-8 lg:px-10">
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

          <div className="flex items-center gap-4 md:gap-5">
            <button
              type="button"
              onClick={() => open("apply")}
              className="group label-lg hidden items-center gap-3 whitespace-nowrap transition-colors duration-300 hover:text-accent lg:inline-flex"
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
              className="hidden px-5 py-3 md:inline-flex"
            >
              {CTA.prospectus}
            </Btn>
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-expanded={menu}
              aria-label={menu ? "Close menu" : "Open menu"}
              className="label-lg border border-hairline-invert px-4 py-3 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-paper hover:text-ink"
            >
              {menu ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>

      {/* The chapter index, full screen. Two columns from md so thirteen
          destinations stay one glance, not one scroll. */}
      <div
        className={cn(
          "fixed inset-0 z-40 overflow-y-auto bg-ink text-paper transition-[opacity,visibility] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          menu ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        <nav
          aria-label="Summit chapters"
          className="flex min-h-full flex-col justify-center px-6 pb-12 pt-24 md:px-10"
        >
          <div className="grid gap-x-12 md:grid-cols-2">
            {LIVE_CHAPTERS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setMenu(false)}
                className="group flex items-baseline gap-4 border-b border-hairline-invert py-3.5 transition-colors duration-300 hover:text-accent"
              >
                <span className="label-lg accord-signal-invert">{item.index}</span>
                <span className="font-display text-[1.15rem] font-bold uppercase leading-none tracking-[-0.015em] md:text-[1.3rem]">
                  {item.label}
                </span>
              </a>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-5">
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

/* ------------------------------------------------------------- 01 · hero */

function Hero() {
  const open = useModals();
  return (
    <DSSection chapter="01" tone="ink" pad={PAD_HERO} eyebrow={false}>
      <div>
        <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="min-w-0 lg:col-span-7 lg:pt-4">
            <Reveal delay={60}>
              <h1 className={MASTHEAD_TYPE}>
                {EVENT.nameLines.map((line) => (
                  <span key={line} className="block whitespace-nowrap">
                    {line}
                  </span>
                ))}
              </h1>
            </Reveal>
            <Reveal delay={130}>
              <p className={cn(PROPOSITION_TYPE, "mt-6 lg:mt-7")}>
                <span className="block">The people who move</span>
                <span className="block">the Gulf's money.</span>
              </p>
            </Reveal>
            <Reveal delay={190} className="mt-9 border-t border-hairline-invert pt-6 lg:mt-11">
              <p className="font-display text-[1.15rem] font-bold uppercase tracking-[-0.01em] lg:text-[1.3rem]">
                {EVENT.dateline}
              </p>
            </Reveal>
            <Reveal delay={240} className="mt-6 flex flex-wrap items-center gap-5">
              <Btn tone="solidOnDark" onClick={() => open("prospectus")}>
                {CTA.prospectus}
              </Btn>
              <Btn tone="quietOnDark" onClick={() => open("apply")}>
                {CTA.apply}
              </Btn>
            </Reveal>
            <Reveal delay={280}>
              <p className={cn(BODY, "mt-8 max-w-[44ch]")}>{EVENT.trustLine}</p>
            </Reveal>
          </div>

          {/* The room. Desktop only; bleeds to the viewport's right edge so
              it reads as environment, not card. */}
          <Reveal delay={150} className="hidden min-w-0 lg:col-span-5 lg:block lg:pt-2">
            <figure className="relative aspect-square w-full overflow-hidden bg-ink lg:-mr-16 lg:w-[calc(100%+4rem)] xl:aspect-[7/5]">
              <DSPhoto
                photo={PHOTO_HERO}
                sizes="(min-width:1024px) calc(41.6vw - 60px), 100vw"
                loading="eager"
                className="object-[46%_50%]"
              />
            </figure>
          </Reveal>
        </div>

        {/* The film — the wide cinematic band. Poster below lg keeps the
            first paint light where bandwidth is scarcest. */}
        <Reveal delay={200} className="relative mt-10 lg:mt-14">
          <figure className="relative -mx-6 aspect-[16/9] overflow-hidden bg-ink md:-mx-12 lg:mx-0 lg:-mr-16 lg:aspect-[21/8]">
            <EventFilm
              className="hidden lg:motion-safe:block"
              label="Highlights from previous Vostad finance events"
            />
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
    </DSSection>
  );
}

/* --------------------------------------------------- wordmark proof strips */

/* 02 · SPONSORS — left message, right proof.
   ------------------------------------------------------------------------
   Three verified past sponsors, still: no slider, no marquee, no cards, no
   aggregate count. What changes is the composition. Centred, the section
   read as a separate module dropped into the page; it now opens on the same
   left content edge as every other section and the eye crosses it as
   MESSAGE -> PROOF, along the spread rather than down it.

   OPTICAL BALANCE BY WIDTH, NOT HEIGHT. The three marks run 6.2:1, 3.9:1
   and 3.3:1, so matched heights would let the flat Temenos wordmark dwarf
   the group while crushing QFC's English line. In the row states each takes
   a share of the column — 27/29/34 — which lands all three at comparable
   visual mass; in the stacked states they take matched-mass heights.

   THE GROUP SITS LEFT INSIDE ITS COLUMN, not pinned to the page's right
   edge. Spread edge to edge it read as a separate band with a long empty
   run between it and the sentence; capped at 86% of the column it keeps the
   even distribution but its centre moves ~60px toward the text, while the
   56px gutter still holds the two apart.

   THE ROW BREAKS ONLY AT lg. Everywhere else the three marks share one
   line. Once the two-column composition engages the logos keep just ~42% of
   the content width, and three marks across a 433px column would put QFC's
   "Qatar Financial Centre" line near 6px — so they stack for that one range
   and no logo is shrunk to prove a point.

   THE MOBILE SHARES ARE SET BY LEGIBILITY, NOT BY VISUAL MASS. Measured off
   the files, the smallest line inside each mark is 61px of Temenos's 378
   (the wordmark itself), 43px of Mashreq's 347, and just 22px of QFC's 377
   — its English sub-line. Rendering each at 13px therefore needs 81, 105
   and 223px of width: 408px before a single pixel of gap, against the 342px
   a 390 viewport leaves inside the content edge. One row cannot carry all
   three at 13px, so the shares equalise the shortfall rather than hiding it
   in one mark — 19/24/51 puts every logo at the SAME rendered ~10.3px
   instead of 14.2/11.8/7.9. QFC's sub-line gains 29%, and from roughly a
   494px viewport up the 51% share clears 13px outright. */
const SPONSOR_SHARE: Record<string, string> = {
  Temenos: "w-[19%] md:w-[27%] lg:w-auto xl:w-[26%]",
  Mashreq: "w-[24%] md:w-[29%] lg:w-auto xl:w-[28%]",
  "Qatar Financial Centre": "w-[51%] md:w-[34%] lg:w-auto xl:w-[32%]",
};

/* Matched-mass heights for the one stacked state (lg), where a share of the
   column means nothing because each mark owns a row of its own. */
const SPONSOR_HEIGHT: Record<string, string> = {
  Temenos: "h-auto w-full lg:h-7 lg:w-auto xl:h-auto xl:w-full",
  Mashreq: "h-auto w-full lg:h-12 lg:w-auto xl:h-auto xl:w-full",
  "Qatar Financial Centre": "h-auto w-full lg:h-[4.25rem] lg:w-auto xl:h-auto xl:w-full",
};

function Sponsors() {
  return (
    <DSSection chapter="02" pad={PAD_STRIP}>
      <div className="grid gap-y-9 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] lg:items-center lg:gap-x-14">
        <Reveal className="min-w-0">
          <h2 className="mt-5 font-display text-[clamp(1.35rem,4.6vw,1.75rem)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] lg:mt-0 lg:text-[clamp(1.6rem,2.2vw,2rem)]">
            {SPONSORS.heading}
          </h2>
          <p className={cn(BODY, "mt-4 max-w-[42ch]")}>{SPONSORS.line}</p>
        </Reveal>

        {/* The proof. `justify-between` in the row states, so the group
            spans its column edge to edge rather than clustering; the gap is
            a floor, not the spacing. */}
        <Reveal delay={90} className="min-w-0">
          <ul className="flex items-center justify-between gap-x-2 md:gap-x-8 lg:flex-col lg:items-start lg:justify-start lg:gap-x-0 lg:gap-y-8 xl:max-w-[86%] xl:flex-row xl:items-center xl:justify-between xl:gap-x-8">
            {SPONSORS.logos.map((logo) => (
              <li key={logo.name} className={cn("flex items-center", SPONSOR_SHARE[logo.name])}>
                <img
                  src={logo.src}
                  alt={logo.alt}
                  loading="lazy"
                  decoding="async"
                  className={cn(
                    /* Single ink. Plain grayscale left three different greys
                       — Temenos near-black, QFC pale — which reads as a
                       collection rather than a system; the site's own hover
                       language releases the true brand colour. */
                    "brightness-0 grayscale transition-[filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:brightness-100 hover:grayscale-0 motion-reduce:transition-none",
                    SPONSOR_HEIGHT[logo.name],
                  )}
                />
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </DSSection>
  );
}

/* ---------------------------------------------------------- 03 the summit */

/* Section 03's own headline scale — a page-scoped constant, NOT a change to
   the shared SECTION_TYPE, which every other section reads. This section
   has to win the first glance against a substantial photograph, so it runs
   ~52px at 1440 where the shared scale runs 41.6px, and stays at the shared
   scale from 1024 down where the column is too narrow to carry more. Still
   comfortably below the hero masthead's 73px. */
const SUMMIT_HEAD =
  "font-display text-[clamp(1.9rem,7vw,2.4rem)] font-extrabold uppercase leading-[1.02] tracking-[-0.03em] lg:text-[clamp(2.6rem,3.6vw,3.4rem)]";

/* 03 · THE SUMMIT — text left, image right; Section 02's mirror.
   ------------------------------------------------------------------------
   THE PHOTOGRAPH SPANS THE WHOLE ARGUMENT. Two earlier passes tied its
   height to the headline-and-body row alone, which made it a 2.12 letterbox
   at 1440 and left the ground beside the closing statement empty. It now
   sits in a two-row grid and spans BOTH rows from xl — headline to closing,
   the gutter between them included — so it reads as a photograph rather
   than a strip, gains about a third in area, and fills the column's whole
   height instead of stranding space under itself.

   THE TEXT STILL WINS, by composition rather than by weakening the image:
   60/40 of the usable width, a headline a full scale step above the shared
   section scale, and the reading order headline -> body -> closing all held
   in the left column. Nothing is dimmed to achieve it.

   THE VIEWPORT CAP SURVIVES BELOW xl and is load-bearing there. At 1024 the
   narrower column makes the copy taller AND the image column thinner, so a
   full-height frame returns a portrait — measured at 298x341. `max-h-[26vw]`
   tracks the column's own width (both scale with the viewport) and holds
   the crop landscape; the closing spans the full width there so the only
   space left over sits beside the body, not beside the statement. From xl
   the geometry stops fighting and the cap is released. */
function TheSummit() {
  return (
    <DSSection chapter="03">
      {/* Explicit placement, so the DOM order can serve mobile — label,
          headline, body, closing, image — while the desktop grid puts the
          photograph up in column two regardless. */}
      <div className="grid gap-y-9 lg:grid-cols-[minmax(0,1.38fr)_minmax(0,1fr)] lg:gap-x-14">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Reveal>
            <h2 className={cn(SUMMIT_HEAD, "mt-5 max-w-[16ch] lg:mt-0")}>{THE_SUMMIT.headline}</h2>
          </Reveal>
          <Reveal delay={80}>
            {/* 20px desktop / 18px mobile at 1.55. Arbitrary font sizes carry
                no implicit line-height, so the leading survives the class
                merge. Full ink — never faded to manufacture hierarchy. */}
            <p className="mt-7 max-w-[56ch] text-[18px] leading-[1.55] lg:text-[20px]">
              {THE_SUMMIT.body}
            </p>
          </Reveal>
        </div>

        {/* The closing. Stronger by weight, spacing and position — never by
            size; it stays less than half the headline. The periwinkle rule
            above it is the approved device and is unchanged. */}
        <Reveal
          delay={140}
          className="min-w-0 lg:row-start-2 lg:max-[1339px]:col-span-2 lg:max-[1339px]:col-start-1 min-[1340px]:col-start-1"
        >
          <p className="accord-hairline max-w-[34ch] border-t-2 pt-6 font-display text-[1.2rem] font-extrabold uppercase leading-[1.2] tracking-[-0.018em] lg:text-[1.5rem]">
            {THE_SUMMIT.closing}
          </p>
        </Reveal>

        <Reveal
          delay={120}
          className="min-w-0 lg:col-start-2 lg:row-start-1 min-[1340px]:row-end-3"
        >
          <figure className="relative aspect-[4/3] w-full overflow-hidden bg-bone sm:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[220px] lg:max-[1339px]:max-h-[30vw]">
            <DSPhoto
              photo={PHOTO_SUMMIT}
              sizes="(min-width:1024px) calc(42vw - 84px), 100vw"
              className="object-[50%_36%]"
            />
          </figure>
        </Reveal>
      </div>
    </DSSection>
  );
}

/* ---------------------------------------------------------- 04 the market */

/* The numbers ARE the visual: one headline, one ruled row of three figures,
   nothing else. */
function TheMarket() {
  return (
    <DSSection chapter="04" tone="ink">
      <Reveal>
        <h2 className={cn(SECTION_TYPE, "mt-6 max-w-[22ch] lg:mt-0")}>{MARKET.headline}</h2>
      </Reveal>
      <Reveal delay={100}>
        <div className="mt-10 grid grid-cols-1 border-y border-hairline-invert sm:grid-cols-3 lg:mt-12">
          {MARKET.stats.map((stat, i) => (
            <div
              key={stat.value}
              className={cn(
                "border-b border-hairline-invert py-8 last:border-b-0 sm:border-b-0 sm:py-10 sm:pr-8",
                i > 0 && "sm:border-l sm:border-hairline-invert sm:pl-8",
              )}
            >
              <p className="font-display text-[clamp(2.8rem,11vw,3.6rem)] font-extrabold leading-[0.82] tracking-[-0.045em] lg:text-[clamp(3.2rem,4.8vw,4.6rem)]">
                <CountUp value={stat.value} />
              </p>
              <p className={cn(BODY, "mt-4 max-w-[24ch]")}>{stat.line}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </DSSection>
  );
}

/* ----------------------------------------------------- 05 event in numbers */

/* 05 · EVENT IN NUMBERS — the room, then the figures that describe it.
   ------------------------------------------------------------------------
   THE FILM IS GONE. This section makes a claim about scale, and the one
   event film is already the hero's cinematic moment; running it again here
   spent the page's loudest asset on a supporting beat and left the numbers
   competing with motion. A still of a full house — panel on stage, every
   seat taken — makes the same argument and lets the figures be the only
   thing moving.

   THREE FIGURES, LOUDER. The fourth row (nine editions) was track record,
   not room, and it diluted the three numbers that actually describe this
   one. What is left goes up a full scale step — 54px against 41.6px — so
   the column reads as figures with labels rather than a list.

   THE IMAGE TAKES ITS HEIGHT FROM THE TEXT. `lg:h-full` against a stretched
   grid item, so the frame can never dictate the section's height or strand
   space beneath itself; the figures set the row and the photograph fills
   exactly that. */
function InNumbers() {
  return (
    <DSSection chapter="05">
      <div className="grid gap-y-8 lg:grid-cols-2 lg:gap-x-14">
        <Reveal className="min-w-0">
          {/* 16:9 below lg is the master's native ratio — no crop at all,
              and the shallowest the frame can be, which keeps the stacked
              order compact. */}
          <figure className="relative aspect-[16/9] w-full overflow-hidden bg-ink lg:aspect-auto lg:h-full lg:min-h-[300px]">
            <DSPhoto
              photo={PHOTO_ROOM}
              sizes="(min-width:1024px) calc(50vw - 108px), 100vw"
              className="object-[50%_46%]"
            />
          </figure>
        </Reveal>

        <div className="min-w-0">
          <Reveal>
            <h2 className={cn(SECTION_TYPE, "mt-2 max-w-[16ch] lg:mt-0")}>{IN_NUMBERS.headline}</h2>
          </Reveal>
          <Reveal delay={90}>
            <div className="mt-7 border-t border-hairline lg:mt-8">
              {IN_NUMBERS.stats.map((stat) => (
                <div
                  key={stat.line}
                  className="flex items-baseline gap-5 border-b border-hairline py-4 lg:gap-6 lg:py-5"
                >
                  <p className="w-[7rem] shrink-0 font-display text-[2.6rem] font-extrabold leading-[0.85] tracking-[-0.045em] lg:w-[8.5rem] lg:text-[3.4rem]">
                    <CountUp value={stat.value} />
                  </p>
                  <p className={BODY}>{stat.line}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </DSSection>
  );
}

/* -------------------------------------------------------------- 06 speakers */

function SpeakerCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const inView = useRef(false);

  const step = useCallback((dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track || track.children.length < 2) return;
    const first = track.children[0] as HTMLElement;
    const second = track.children[1] as HTMLElement;
    const stride = second.offsetLeft - first.offsetLeft;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduced ? "auto" : "smooth";
    const max = track.scrollWidth - track.clientWidth;
    if (dir === 1 && track.scrollLeft >= max - 8) track.scrollTo({ left: 0, behavior });
    else if (dir === -1 && track.scrollLeft <= 8) track.scrollTo({ left: max, behavior });
    else track.scrollBy({ left: dir * stride, behavior });
  }, []);

  /* Auto-advance: one card roughly every 3.5s, pausing on hover, focus,
     hidden tabs and off-screen positions; never running under reduced
     motion. Manual navigation is always live. */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        inView.current = entries[0]?.isIntersecting ?? false;
      },
      { threshold: 0.3 },
    );
    io.observe(track);
    const timer = window.setInterval(() => {
      if (paused.current || !inView.current || document.hidden) return;
      step(1);
    }, 3500);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [step]);

  const arrow =
    "label-lg border border-hairline-invert px-4 py-3 transition-colors duration-300 hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Previous speakers"
      onPointerEnter={() => (paused.current = true)}
      onPointerLeave={() => (paused.current = false)}
      onFocusCapture={() => (paused.current = true)}
      onBlurCapture={() => (paused.current = false)}
    >
      <div className="flex items-end justify-between gap-6">
        <Reveal>
          <h2 className={cn(SECTION_TYPE, "mt-6 max-w-[20ch] lg:mt-0")}>{SPEAKERS.headline}</h2>
          <p className={cn(SUPPORT, "mt-4")}>{SPEAKERS.intro}</p>
        </Reveal>
        <Reveal delay={80} className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous speakers"
            className={arrow}
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next speakers"
            className={arrow}
          >
            →
          </button>
        </Reveal>
      </div>

      <Reveal delay={120}>
        <div
          ref={trackRef}
          className="mt-9 flex snap-x snap-mandatory gap-6 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SPEAKERS.roster.map((person) => (
            <figure
              key={person.name}
              className="w-[76%] shrink-0 snap-start sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]"
            >
              <div className="summit-portrait-fade relative aspect-[4/5] w-full overflow-hidden">
                <picture className="contents">
                  <source
                    type="image/avif"
                    srcSet={`${person.image}-400.avif 400w, ${person.image}-800.avif 800w`}
                    sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 76vw"
                  />
                  <img
                    src={`${person.image}-400.jpg`}
                    srcSet={`${person.image}-400.jpg 400w, ${person.image}-800.jpg 800w`}
                    sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 76vw"
                    alt={`Portrait of ${person.name}`}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover grayscale transition-[filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:grayscale-0 motion-reduce:transition-none"
                  />
                </picture>
              </div>
              <figcaption className="mt-4">
                <p className="font-display text-[1.1rem] font-bold leading-[1.2] tracking-[-0.01em] lg:text-[1.2rem]">
                  {person.name}
                </p>
                <p className={cn(SUPPORT, "mt-1.5")}>{person.title}</p>
                <p className="label-lg accord-signal-invert mt-1.5 normal-case tracking-[0.04em]">
                  {person.org}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function FeaturedSpeakers() {
  return (
    <DSSection chapter="06" tone="ink">
      <SpeakerCarousel />
    </DSSection>
  );
}

/* ----------------------------------------------------- 07 who will you meet */

/* Section 07's own row type — page-scoped constants, NOT edits to the
   shared CARD_TITLE and SUPPORT, which Sections 08 and 10 read. */
const MEET_ROLE =
  "font-display text-[19px] font-bold uppercase leading-[1.15] tracking-[-0.012em] lg:text-[23px]";
const MEET_LINE = "text-[17px] leading-[1.5] lg:text-[18px]";

/* The fifth constituency carries the bridge into the qualification block, so
   it is set a step above the four above it — extrabold at 26px against bold
   at 23px, on deeper padding. Weight and scale, not a new device. */
const MEET_ROLE_LEAD =
  "font-display text-[21px] font-extrabold uppercase leading-[1.1] tracking-[-0.02em] lg:text-[26px]";

/* 07 · WHO WILL YOU MEET — 01|02, 03|04, then 05 across the full measure.
   ------------------------------------------------------------------------
   The five constituencies run as one ledger: a two-column register for the
   first four, then the fifth spanning both tracks. Because it spans, there
   is no half-empty row at the end of an odd list — the shape of the content
   closes the grid instead of a blank cell — and the widening itself is what
   hands the eye down into the invitation.

   The vertical rule lives on the even cells only, so it draws through the
   two-column register and stops exactly where that register ends. The
   container draws the top edge and each row its own bottom.

   THE INVITATION IS ITS OWN ROW, text left and photograph right, the two
   centred against each other. The photograph is held to a fixed 240px at lg
   — secondary by construction, since it cannot grow with the column — and
   the copy sits centred beside it rather than stranding space beneath. */
function WhoWillYouMeet() {
  const open = useModals();
  return (
    <DSSection chapter="07">
      <Reveal>
        <h2 className={cn(SECTION_TYPE, "mt-6 lg:mt-0")}>{MEET.headline}</h2>
      </Reveal>

      <Reveal delay={80}>
        {/* ONE LEDGER, SIX CELLS. The qualification block is the sixth cell of
            the same grid rather than a separate row beneath it, which is what
            makes 2 + 2 + 1 + CTA a composition instead of an odd list with a
            gap: the fifth constituency keeps the left track, the invitation
            takes the right, and no cell is left empty.

            The nth-child rules count the qualification cell too — 05 lands on
            an odd child and keeps the right gutter, the invitation lands on an
            even one and takes the vertical rule — so the ledger's own
            arithmetic places it. And because only 05 carries a bottom border
            in that row, its divider runs the left half alone, exactly where
            the numbered register ends. */}
        <div className="mt-8 grid border-t border-hairline sm:grid-cols-2 lg:mt-10">
          {MEET.groups.map((group, i) => {
            const lead = i === 4;
            return (
              <div
                key={group.role}
                className={cn(
                  "grid grid-cols-[2.6rem_1fr] items-baseline gap-x-4 border-b border-hairline",
                  lead ? "py-6 sm:content-center lg:py-7" : "py-4 lg:py-5",
                  "sm:[&:nth-child(odd)]:pr-8 sm:[&:nth-child(even)]:border-l sm:[&:nth-child(even)]:border-hairline sm:[&:nth-child(even)]:pl-8",
                )}
              >
                <p className="label-lg accord-signal">{String(i + 1).padStart(2, "0")}</p>
                <div className="min-w-0">
                  <h3 className={lead ? MEET_ROLE_LEAD : MEET_ROLE}>{group.role}</h3>
                  <p className={cn(MEET_LINE, "mt-2 max-w-[52ch]")}>{group.line}</p>
                </div>
              </div>
            );
          })}

          {/* The invitation. Right-aligned from sm, where it sits opposite 05;
              left-aligned below that, where the column is single and ranging
              it right would strand it against nothing. No bottom border — the
              ledger closes on 05's divider, and the CTA sits outside it. */}
          <div className="flex flex-col items-start justify-center border-hairline py-6 sm:items-end sm:border-l sm:pl-8 sm:text-right lg:py-7">
            <p className="font-display text-[clamp(1.3rem,4.4vw,1.6rem)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] lg:text-[clamp(1.4rem,2vw,1.8rem)]">
              {MEET.closingLine}
            </p>
            <div className="mt-6">
              <Btn tone="solidOnLight" onClick={() => open("apply")}>
                {CTA.apply}
              </Btn>
            </div>
          </div>
        </div>
      </Reveal>
    </DSSection>
  );
}

/* ---------------------------------------------------------------- 08 agenda */

/* Section 08's own row type — page-scoped, NOT edits to the shared
   CARD_TITLE, which Section 10 reads. The track is the thing being scanned,
   so it carries the display voice at 26px; the topics under it sit in the
   sans at 18px, full ink. Two families, two cases and an 8px size gap do
   the hierarchy — nothing is faded to achieve it. */
const TRACK_TITLE =
  "font-display text-[19px] font-extrabold uppercase leading-[1.12] tracking-[-0.022em] md:text-[22px] lg:text-[23px] xl:text-[26px]";
const TRACK_TOPICS = "text-[17px] leading-[1.45] lg:text-[18px]";

/* 08 · THE AGENDA — a two-column ledger, not a card wall.
   ------------------------------------------------------------------------
   The 3x2 grid of bordered cells gave every track four edges and a hover
   fill, which made six equal boxes out of what is really an index: an
   ordered list you scan for your own subject. The boxes are gone. What is
   left is the ledger the page already speaks in — a rule under each row, one
   rule down the middle, the numeral carrying the accent inline ahead of its
   track, and every title landing on the same left edge in its column.

   Row-major, so reading order, DOM order and the numerals all agree: 01|02
   across, then 03|04, then 05|06. Column-major would read down one side and
   back up the other, which only works in print where the eye is not also
   the tab order.

   The container draws the top edge, each row its own bottom, and the right
   column its own left — so the ledger closes correctly at one column and at
   two, with no rule left hanging. */
function TheAgenda() {
  return (
    <DSSection chapter="08" tone="bone">
      <Reveal>
        <h2 className={cn(SECTION_TYPE, "mt-6 lg:mt-0")}>{AGENDA.headline}</h2>
      </Reveal>

      <Reveal delay={90}>
        <div className="mt-8 grid border-t border-hairline md:grid-cols-2 lg:mt-10">
          {AGENDA.tracks.map((track, i) => (
            <div
              key={track.title}
              className={cn(
                "min-w-0 border-b border-hairline py-5 lg:py-6",
                "md:[&:nth-child(odd)]:pr-8 md:[&:nth-child(even)]:border-l md:[&:nth-child(even)]:border-hairline md:[&:nth-child(even)]:pl-8 lg:[&:nth-child(odd)]:pr-12 lg:[&:nth-child(even)]:pl-12",
              )}
            >
              <h3 className={TRACK_TITLE}>
                <span className="accord-signal">{`${String(i + 1).padStart(2, "0")} · `}</span>
                {track.title}
              </h3>
              <p className={cn(TRACK_TOPICS, "mt-2")}>{track.topics}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* The refusal. Large and certain, on a held measure so it breaks where
          the sentence turns — but a clear step under the section heading,
          because it closes the argument rather than opening one. */}
      <Reveal delay={150}>
        <p className="mt-9 max-w-[26ch] font-display text-[clamp(1.35rem,4.8vw,1.8rem)] font-extrabold uppercase leading-[1.08] tracking-[-0.022em] lg:mt-10 lg:text-[clamp(1.5rem,2.3vw,2rem)]">
          {AGENDA.closing}
        </p>
      </Reveal>
    </DSSection>
  );
}

/* ------------------------------------------------------------ 10 attended by */

/* Alternating, not split down the middle: the folder runs roughly banks
   first, infrastructure through the middle, media last, so halving it would
   have stacked one category per rail. Taking every other file gives both
   rails the same mix. */
const MARK_RAILS = [
  ATTENDED_BY_MARKS.filter((_, i) => i % 2 === 0),
  ATTENDED_BY_MARKS.filter((_, i) => i % 2 === 1),
];

const RAIL_FADE = {
  maskImage: "linear-gradient(to right, transparent, #000 5%, #000 95%, transparent)",
  WebkitMaskImage: "linear-gradient(to right, transparent, #000 5%, #000 95%, transparent)",
} as const;

/**
 * One rail. The track is the mark list rendered twice, so the -50% travel in
 * the site's own `marquee-track` keyframe lands exactly on the seam; the
 * second copy is what makes the loop invisible. `animation-direction: reverse`
 * is what turns the site's right-to-left drift into a left-to-right one —
 * one keyframe, two directions, rather than a second set of keyframes.
 *
 * aria-hidden, and every mark alt="": these are 79 numbered files. Naming
 * them would mean asserting identities from a visual reading, and a wrong
 * alt is a false claim about a real institution. The kicker and the
 * disclaimer carry the section for a screen reader instead.
 *
 * THE CELL IS A FIXED WIDTH, and that is load-bearing rather than cosmetic.
 * Sized by their own artwork, the marks are lazy images of 79 different
 * intrinsic widths, so the track grew as they arrived — the geometry drifted
 * under the animation and the -50% seam stopped landing on the join. A fixed
 * cell makes the track deterministic from the first frame, whatever order
 * the files load in, and gives the rail an even rhythm besides; each mark is
 * then fitted inside its cell by height and width together, so a wide
 * wordmark and a square emblem both sit at comparable optical weight.
 */
function MarkRail({
  marks,
  reverse = false,
  seconds,
}: {
  marks: readonly string[];
  reverse?: boolean;
  seconds: number;
}) {
  return (
    <div className="overflow-hidden" style={RAIL_FADE} aria-hidden>
      <ul
        className={cn(
          "marquee-track flex w-max items-center",
          reverse && "[animation-direction:reverse]",
        )}
        style={{ animationDuration: `${seconds}s` }}
      >
        {[...marks, ...marks].map((src, i) => (
          <li
            key={`${src}-${i}`}
            className="flex w-[150px] shrink-0 items-center justify-center px-4 lg:w-[190px] lg:px-5"
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              className="max-h-8 w-auto max-w-full invert lg:max-h-10"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 10 · ATTENDED BY — two rails, counter-running.
   ------------------------------------------------------------------------
   The wordmark strip is replaced by the marks themselves. Two rows drifting
   against each other, the upper one left-to-right and the lower one
   right-to-left: the opposition is what stops a logo wall reading as a
   single scrolling banner, and it is the only motion idea borrowed — the
   type, rules, spacing and monochrome treatment are the page's own.

   Slow on purpose. Each rail carries ~40 marks over a track of several
   thousand pixels and takes three minutes to complete a pass, so the drift
   is something noticed rather than watched, and the two speeds differ so the
   rows never lock into step.

   The marks are white artwork drawn for dark grounds; the section stays on
   paper and inverts them, which keeps the lockups that carry a light box
   legible instead of flattening them into solid blocks. Edges are masked so
   marks enter and leave rather than being cut.

   THE PAD IS SPELLED OUT rather than reusing PAD_STRIP, which declares no
   `md:` vertical padding — so Section's own `md:py-28` survived the merge
   and inflated this strip to 112px top and bottom at tablet, 224px of
   padding around 146px of content. Closed here for this section only;
   Sponsors reads the same constant and is deliberately left untouched. */
function AttendedBy() {
  return (
    <DSSection chapter="10" pad="px-6 py-10 md:px-12 md:py-10 lg:px-16 lg:py-12" eyebrow={false}>
      <div className="grid gap-y-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] lg:items-center lg:gap-x-14">
        <Reveal className="min-w-0">
          <p className="label-lg accord-signal lg:hidden">10 — Attended By</p>
          <h2 className="mt-5 font-display text-[clamp(1.35rem,4.6vw,1.75rem)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] lg:mt-0 lg:text-[clamp(1.6rem,2.2vw,2rem)]">
            {ATTENDED_BY.kicker}
          </h2>
          <p className={cn(BODY, "mt-4 max-w-[42ch]")}>{ATTENDED_BY.disclaimer}</p>
        </Reveal>

        <Reveal delay={90} className="min-w-0">
          <div className="space-y-7 lg:space-y-9">
            <MarkRail marks={MARK_RAILS[0]!} reverse seconds={220} />
            <MarkRail marks={MARK_RAILS[1]!} seconds={250} />
          </div>
        </Reveal>
      </div>
    </DSSection>
  );
}

/* ------------------------------------------------------------ 09 experience */

/* Section 10's own card title — page-scoped, a half-step above the shared
   CARD_TITLE so the four names are what the section IS at first glance. */
const EXP_TITLE =
  "font-display text-[19px] font-extrabold uppercase leading-[1.1] tracking-[-0.018em] lg:text-[22px]";

/* Per-card square crops: each master is re-centred for a 1:1 frame so the
   subject survives the tight cut — the keynote speaker stands at frame
   left, the ballroom's tables sit low. */
const EXP_CROPS = ["object-[24%_40%]", "object-[56%_46%]", "object-[50%_40%]", "object-[50%_62%]"];

/* 09 · THE EXPERIENCE — four compact cards on one ruled 2x2 grid.
   ------------------------------------------------------------------------
   The mosaic inverted the section's own hierarchy: 1,400px of photography
   with the four names hanging under the frames as captions. But the section
   exists so a visitor can scan STAGE / MEETINGS / NETWORKING / DINNER — the
   words are the content and the images are the proof, so the composition
   now says exactly that.

   Each card is a media object: a square photograph at fixed compact size,
   the title beside it carrying the display voice, the line under the title
   in full-ink sans. The image cannot outgrow its 10rem, so it can never
   dominate the card — and the whole section drops from ~1,400px to roughly
   half that.

   CELLS, NOT FLOATING CARDS. The container draws the top and left edges and
   every cell draws its own bottom and right — the same shared-rule ledger
   the rest of the page speaks, which reads as four deliberate plates rather
   than four boxes with shadows. */
function TheExperience() {
  return (
    <DSSection chapter="09" tone="ink">
      <Reveal>
        <h2 className={cn(SECTION_TYPE, "mt-6 max-w-[24ch] lg:mt-0")}>{EXPERIENCE.headline}</h2>
      </Reveal>
      <Reveal delay={80}>
        <div className="mt-8 grid border-l border-t border-hairline-invert md:grid-cols-2 lg:mt-10">
          {EXPERIENCE.moments.map((moment, i) => (
            <div
              key={moment.title}
              className="flex min-w-0 items-center gap-5 border-b border-r border-hairline-invert p-5 md:gap-6 lg:p-6"
            >
              <figure className="relative aspect-square w-28 shrink-0 overflow-hidden bg-ink md:w-32 lg:w-40">
                <DSPhoto
                  photo={EXPERIENCE_PHOTOS[i]!}
                  sizes="(min-width:1024px) 160px, 128px"
                  className={EXP_CROPS[i]!}
                />
              </figure>
              <div className="min-w-0">
                <h3 className={EXP_TITLE}>{moment.title}</h3>
                <p className={cn(SUPPORT, "mt-2 max-w-[36ch]")}>{moment.line}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </DSSection>
  );
}

/* ----------------------------------------------------------- 11 partnership */

function Partnership() {
  const open = useModals();
  return (
    <DSSection chapter="12">
      <div className="grid gap-y-9 lg:grid-cols-12 lg:gap-x-14">
        <Reveal delay={120} className="min-w-0 lg:order-1 lg:col-span-5">
          <figure className="relative aspect-[4/3] w-full overflow-hidden bg-bone lg:h-full lg:max-h-[560px]">
            <DSPhoto photo={PHOTO_PARTNER} sizes="(min-width:1024px) calc(38vw - 88px), 100vw" />
          </figure>
        </Reveal>
        <div className="min-w-0 lg:order-2 lg:col-span-7">
          <Reveal>
            <h2 className={cn(SECTION_TYPE, "mt-6 lg:mt-0")}>{PARTNER.headline}</h2>
          </Reveal>
          <Reveal delay={80}>
            <p className={cn(BODY, "mt-6 max-w-[56ch]")}>{PARTNER.body}</p>
            <p className={cn(BODY, "mt-5 max-w-[56ch]")}>{PARTNER.proposition}</p>
          </Reveal>
          {/* The scarcity line: ruled, uppercase and in the display voice so
              it registers immediately, at roughly half the headline so it can
              never be mistaken for one. Full ink — the urgency is carried by
              the rules and the case, not by shouting or by colour. */}
          <Reveal delay={130}>
            <p className="mt-8 border-y border-hairline py-4 font-display text-[1.1rem] font-bold uppercase tracking-[-0.008em] lg:text-[1.25rem]">
              {PARTNER.urgency}
            </p>
          </Reveal>
          <Reveal delay={170}>
            <div className="mt-7">
              <Btn tone="solidOnLight" onClick={() => open("prospectus")}>
                {CTA.prospectus}
              </Btn>
            </div>
          </Reveal>
        </div>
      </div>
    </DSSection>
  );
}

/* ----------------------------------------------------------------- 13 media */

/* One rail, one direction. The marks here are dark artwork on transparency,
   so they take the page's grayscale treatment rather than Section 10's
   invert — these need no flipping to sit on paper.

   Named alts on the first pass and empty ones on the duplicate: unlike the
   numbered institutional files, every publication here is verified by name
   in MEDIA.logos, so a screen reader gets the roster once rather than
   twenty times or not at all. */
function MediaRail() {
  const items = MEDIA.logos;
  return (
    <div className="overflow-hidden" style={RAIL_FADE}>
      <ul
        aria-label="Media and publications represented"
        className="marquee-track flex w-max items-center"
        style={{ animationDuration: "72s" }}
      >
        {[...items, ...items].map((logo, i) => {
          const duplicate = i >= items.length;
          return (
            <li
              key={`${logo.src}-${i}`}
              aria-hidden={duplicate}
              className="flex w-[150px] shrink-0 items-center justify-center px-4 lg:w-[190px] lg:px-5"
            >
              <img
                src={logo.src}
                alt={duplicate ? "" : logo.name}
                loading="lazy"
                decoding="async"
                className="max-h-8 w-auto max-w-full grayscale lg:max-h-10"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* 13 · MEDIA — Section 02's composition, one continuous rail.
   ------------------------------------------------------------------------
   The five-column grid packed ten marks into a static block under the
   heading, which read as a contact sheet rather than as proof. Message left,
   proof right, centred against each other on the same 43/57 split the
   sponsor band and Attended By use, so the page's three logo sections now
   share one grammar and one left content edge.

   ONE RAIL, ONE DIRECTION — the counter-running pair belongs to Attended By,
   where it distinguishes 71 marks; ten publications need only a single
   unhurried pass. Cells are wide enough that each mark carries its own space
   instead of sharing a gutter, and the edges are masked so marks enter and
   leave rather than being cut. */
function Media() {
  return (
    <DSSection chapter="13" pad="px-6 py-10 md:px-12 md:py-10 lg:px-16 lg:py-12">
      <div className="grid gap-y-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] lg:items-center lg:gap-x-14">
        <Reveal className="min-w-0">
          <h2 className="mt-5 font-display text-[clamp(1.35rem,4.6vw,1.75rem)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] lg:mt-0 lg:text-[clamp(1.6rem,2.2vw,2rem)]">
            {MEDIA.headline}
          </h2>
          <p className={cn(BODY, "mt-4 max-w-[42ch]")}>{MEDIA.kicker}</p>
        </Reveal>

        <Reveal delay={90} className="min-w-0">
          <MediaRail />
        </Reveal>
      </div>
    </DSSection>
  );
}

/* ---------------------------------------------------------- 11 testimonials */

/* The quote is the focus of its column. Three-up it runs at 24px against a
   19px name and 17px title — dominant by a clear step, without needing the
   38px it had when one testimonial held the whole measure. */
const QUOTE_TYPE =
  "font-display text-[clamp(1.3rem,4.6vw,1.6rem)] font-extrabold uppercase leading-[1.16] tracking-[-0.018em] lg:text-[22px] xl:text-[26px]";

/* Attribution at the page's body floor — 17px mobile, 18px desktop, full
   ink. Nothing is faded or shrunk to make the quote dominant; the quote is
   dominant because it is set larger. */
const ATTR_TEXT = "text-[17px] leading-[1.45] lg:text-[18px]";

/* 11 · TESTIMONIALS — three sponsor voices at once, on one ruled track.
   ------------------------------------------------------------------------
   Five quotes, three columns, one row. The columns are separated by
   hairlines rather than boxed as cards, so the three read as one composed
   section — the same shared-rule language the Agenda and The Experience
   speak — and no quote is ever wrapped in a border of its own.
   
   MANUAL ONLY: no autoplay, no marquee. Executive proof reads as proof when
   the visitor sets the pace, and a quote that moves before it is finished is
   worse than no quote. The arrows step the track by exactly one column and
   wrap at both ends, so the visible SET slides rather than swapping.

   The leading rule is suppressed on the first column only. Once the track
   has scrolled, the column at the left edge keeps its rule — which is
   correct: it says the row continues off-screen to the left.

   Every name, title, organisation and portrait resolves through
   `speakerById` into SPEAKERS.roster, so the five people who also appear in
   Section 06 cannot drift into a second title or a second portrait asset. */
function Testimonials() {
  const trackRef = useRef<HTMLDivElement>(null);

  const step = useCallback((dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track || track.children.length < 2) return;
    const first = track.children[0] as HTMLElement;
    const second = track.children[1] as HTMLElement;
    const stride = second.offsetLeft - first.offsetLeft;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduced ? "auto" : "smooth";
    const max = track.scrollWidth - track.clientWidth;
    if (dir === 1 && track.scrollLeft >= max - 8) track.scrollTo({ left: 0, behavior });
    else if (dir === -1 && track.scrollLeft <= 8) track.scrollTo({ left: max, behavior });
    else track.scrollBy({ left: dir * stride, behavior });
  }, []);

  if (TESTIMONIALS.length === 0) return null;
  const arrow =
    "label-lg border border-hairline-invert px-4 py-3 transition-colors duration-300 hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none";

  return (
    <DSSection chapter="11" tone="ink">
      <div className="flex items-end justify-between gap-6">
        <Reveal>
          <h2 className={cn(SECTION_TYPE, "mt-6 max-w-[20ch] lg:mt-0")}>
            {TESTIMONIALS_COPY.headline}
          </h2>
        </Reveal>
        <Reveal delay={70} className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            aria-label="Previous testimonials"
            className={arrow}
            onClick={() => step(-1)}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next testimonials"
            className={arrow}
            onClick={() => step(1)}
          >
            →
          </button>
        </Reveal>
      </div>

      <Reveal delay={110}>
        <div
          ref={trackRef}
          aria-roledescription="carousel"
          aria-label="Sponsor testimonials"
          className="mt-9 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain lg:mt-11 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TESTIMONIALS.map((t, i) => {
            const person = speakerById(t.speakerId);
            if (!person) return null;
            return (
              <figure
                key={t.speakerId}
                className={cn(
                  /* One per view below md needs no separator and no indent —
                     a rule at the left edge of a single slide reads as
                     decoration, and it left slide 01 flush while 02–05 sat
                     24px in. The hairlines appear only once columns actually
                     share the view. */
                  "flex w-full shrink-0 snap-start flex-col border-hairline-invert md:w-1/2 md:px-6 lg:w-1/3 lg:px-5 xl:px-8",
                  i === 0 ? "md:border-l-0 md:pl-0" : "md:border-l",
                )}
              >
                <blockquote className={QUOTE_TYPE}>{`\u201C${t.quote}\u201D`}</blockquote>
                <figcaption className="mt-auto pt-8 lg:pt-10">
                  <span className="relative block aspect-[4/5] w-16 overflow-hidden bg-ink lg:w-[4.5rem]">
                    <picture className="contents">
                      <source type="image/avif" srcSet={`${person.image}-400.avif`} />
                      <img
                        src={`${person.image}-400.jpg`}
                        alt={`Portrait of ${person.name}`}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover grayscale"
                      />
                    </picture>
                  </span>
                  <span className="mt-4 block font-display text-[19px] font-bold leading-tight tracking-[-0.01em]">
                    {person.name}
                  </span>
                  <span className={cn(ATTR_TEXT, "mt-1.5 block")}>
                    {person.title} · {person.org}
                  </span>
                  <span className={cn(ATTR_TEXT, "accord-signal-invert mt-1.5 block")}>
                    {t.sponsorLine}
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </Reveal>
    </DSSection>
  );
}

/* --------------------------------------------------------------- final cta */

function FinalCta() {
  const open = useModals();
  return (
    <DSSection chapter="14" tone="ink" eyebrow={false} className="accord-hairline border-t-2">
      <div className="grid gap-y-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-x-14">
        <div>
          <Reveal>
            <p className="font-display text-[clamp(2rem,8vw,2.9rem)] font-extrabold uppercase leading-[0.92] tracking-[-0.03em] lg:text-[clamp(2.8rem,4.2vw,4rem)]">
              {FINAL_CTA.lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
          </Reveal>
        </div>
        <div>
          <Reveal delay={90}>
            <p className="font-display text-[1.1rem] font-bold uppercase leading-[1.3] tracking-[-0.008em] lg:text-[1.2rem]">
              {FINAL_CTA.dateLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
            <div className="mt-7 flex flex-col items-start gap-5">
              <Btn tone="solidOnDark" onClick={() => open("prospectus")}>
                {CTA.prospectus}
              </Btn>
              <Btn tone="quietOnDark" onClick={() => open("apply")}>
                {CTA.apply}
              </Btn>
            </div>
          </Reveal>
        </div>
      </div>
    </DSSection>
  );
}

/* ---------------------------------------------------------------- footer */

function DSFooter() {
  return (
    <footer className="border-t border-hairline-invert bg-ink text-paper">
      <div className="px-6 py-14 md:px-12 lg:px-16">
        <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-14">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              <FinancialRailsIcon className="h-9 w-9" />
              <span className="font-display text-sm font-extrabold uppercase leading-[0.95] tracking-tight">
                Financial
                <br />
                Rails
              </span>
            </div>
            <p className={cn(SUPPORT, "mt-6 max-w-[40ch]")}>{FOOTER.line}</p>
          </div>
          <div className="lg:col-span-7">
            <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-3">
              {FOOTER.nav.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="label-lg transition-colors duration-300 hover:text-accent"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <p className={cn(SUPPORT, "mt-7")}>
              <a
                href={`mailto:${FOOTER.email}`}
                className="underline decoration-paper/30 underline-offset-4 transition-colors duration-300 hover:text-accent"
              >
                {FOOTER.email}
              </a>
              {" · "}
              {FOOTER.location}
            </p>
            <p className={cn(SUPPORT, "mt-4 max-w-[52ch]")}>{FOOTER.evidence}</p>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-hairline-invert pt-6 md:flex-row md:items-center md:justify-between">
          {/* Privacy and Terms have no routes yet, so they stay inert text —
              a link that 404s would be worse than a word that waits. */}
          <p className="text-sm leading-relaxed">Privacy · Terms · {FOOTER.legal}</p>
          <p className="font-mono text-sm uppercase tracking-[0.14em]">{FOOTER.tagline}</p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ page */

export function DubaiSummit() {
  const [modal, setModal] = useState<ModalKind>(null);
  const openRef = useRef<(k: Exclude<ModalKind, null>) => void>(() => {});
  openRef.current = (k) => setModal(k);

  return (
    <ModalCtx.Provider value={(k) => openRef.current(k)}>
      <div className="summit-scope">
        <DSNav />
        <main>
          <Hero />
          <Sponsors />
          <TheSummit />
          <TheMarket />
          <InNumbers />
          <FeaturedSpeakers />
          <WhoWillYouMeet />
          <TheAgenda />
          <TheExperience />
          <AttendedBy />
          <Testimonials />
          <Partnership />
          <Media />
          <FinalCta />
        </main>
        <DSFooter />
        {modal ? <LeadModal kind={modal} onClose={() => setModal(null)} /> : null}
      </div>
    </ModalCtx.Provider>
  );
}
