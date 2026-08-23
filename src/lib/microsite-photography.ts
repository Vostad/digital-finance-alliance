/**
 * THE SHARED NEUTRAL EVENT PHOTOGRAPHY SET.
 *
 * One set of Financial Rails event photographs, deliberately common to every forum
 * micro-site. This is the ONLY imagery that is shared: each forum still owns
 * its own EVENT, ROOM, THEMES, WHY_ATTEND, EXPERIENCE copy, DESTINATION notes
 * and metadata in its own file. Changing a photograph here is meant to change
 * all eight at once; nothing else here can reach event data.
 *
 * DERIVATIVES, NOT ORIGINALS. The masters in original-media are 1.7–4.2 MB
 * each, 22 MB for the set, and are never served. Each entry below points at a
 * ladder of AVIF derivatives with a JPEG ladder behind it for browsers without
 * AVIF. A visit downloads exactly one file per slot — about 335 KB for the
 * whole page at 1440, 210 KB on a phone.
 *
 * THE LADDER IS DERIVED FROM THE MASTER TEMPLATE'S MEASURED GEOMETRY, not from
 * round numbers. The widest any grid image ever renders is 943 CSS px — which
 * happens at 1023px, just below the lg breakpoint, where the columns collapse
 * to full width, and NOT on desktop where the shell caps them at 616/508/400.
 * 1888 covers that at 2× device pixel ratio. The two full-bleed frames track
 * the viewport, so they run to 3840.
 *
 * `sizes` mirrors the real layout maths rather than approximating it. The shell
 * is max-w-[86rem] (1376px) with px-14 at lg, so content caps at 1264px; a
 * 12-column grid with 32px gutters then gives col-span-6 = 616, col-span-5 =
 * 508, col-span-4 = 400. Below 1024 every figure is full-bleed inside the
 * shell's padding. Getting this wrong is invisible in review and expensive in
 * bytes, so the expressions below are the arithmetic, not an estimate.
 */

export type MicrositePhoto = {
  /** Path stem; widths and extensions are appended. */
  base: string;
  widths: number[];
  /** Intrinsic size of the master, used for the aspect-ratio hint. */
  intrinsic: { width: number; height: number };
  /** What is actually in the photograph — not what the section is about. */
  alt: string;
  sizes: string;
};

/* Column widths resolve to 616 / 508 / 400 once the shell caps at 86rem. */
const COL_6 =
  "(min-width: 1376px) 616px, (min-width: 1024px) calc(50vw - 72px), (min-width: 768px) calc(100vw - 80px), calc(100vw - 48px)";
const COL_5 =
  "(min-width: 1376px) 508px, (min-width: 1024px) calc(41.67vw - 65px), (min-width: 768px) calc(100vw - 80px), calc(100vw - 48px)";
const COL_4 =
  "(min-width: 1376px) 400px, (min-width: 1024px) calc(33.33vw - 59px), (min-width: 768px) calc(100vw - 80px), calc(100vw - 48px)";
const FULL_BLEED = "100vw";

const GRID_WIDTHS = [480, 768, 1280, 1888];
const BLEED_WIDTHS = [768, 1280, 1920, 2560, 3840];

export const MICROSITE_PHOTOS = {
  whyNow: {
    base: "/media/microsite/why-now",
    widths: GRID_WIDTHS,
    intrinsic: { width: 2000, height: 1500 },
    alt: "A speaker addressing a summit audience from the stage",
    sizes: COL_6,
  },
  whoInRoom: {
    base: "/media/microsite/who-in-room",
    widths: GRID_WIDTHS,
    intrinsic: { width: 2000, height: 2500 },
    alt: "Two delegates in conversation during a conference",
    sizes: COL_5,
  },
  whyAttend: {
    base: "/media/microsite/why-attend",
    widths: GRID_WIDTHS,
    intrinsic: { width: 2000, height: 2500 },
    alt: "Delegates talking together at a conference",
    sizes: COL_5,
  },
  attend: {
    base: "/media/microsite/attend",
    widths: GRID_WIDTHS,
    intrinsic: { width: 2400, height: 1800 },
    alt: "Delegates seated in a conference audience",
    sizes: COL_4,
  },
  speak: {
    base: "/media/microsite/speak",
    widths: GRID_WIDTHS,
    intrinsic: { width: 2400, height: 1800 },
    alt: "A speaker addressing the room from a lectern",
    sizes: COL_4,
  },
  partner: {
    base: "/media/microsite/partner",
    widths: GRID_WIDTHS,
    intrinsic: { width: 2400, height: 1800 },
    alt: "Visitors at an interactive exhibition display",
    sizes: COL_4,
  },
  destination: {
    base: "/media/microsite/destination",
    widths: BLEED_WIDTHS,
    intrinsic: { width: 3840, height: 2160 },
    alt: "A summit ballroom during a plenary session",
    sizes: FULL_BLEED,
  },
  closing: {
    base: "/media/microsite/closing-frame",
    widths: BLEED_WIDTHS,
    intrinsic: { width: 3840, height: 2160 },
    alt: "Delegates seated at round tables during a conference session",
    sizes: FULL_BLEED,
  },
} satisfies Record<string, MicrositePhoto>;

/** `<source srcSet>` / `<img srcSet>` for one format. */
export function srcSetFor(photo: MicrositePhoto, ext: "avif" | "jpg") {
  return photo.widths.map((w) => `${photo.base}-${w}.${ext} ${w}w`).join(", ");
}

/** The `src` a browser without srcset support falls back to: a mid-ladder JPEG. */
export function fallbackSrc(photo: MicrositePhoto) {
  const mid = photo.widths[Math.min(1, photo.widths.length - 1)];
  return `${photo.base}-${mid}.jpg`;
}
