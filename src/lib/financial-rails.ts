import { type MicrositePhoto } from "@/lib/microsite-photography";

/**
 * FINANCIAL RAILS — THE SHARED EDITION LIBRARY.
 *
 * One institution, four editions. Everything an edition inherits rather than
 * authors lives here: the brand constants, the hero film, the photography, the
 * speaker roster, the partner marks, the four Experience frames and the
 * Agenda index. An edition file supplies only what is genuinely regional.
 *
 * SHARED MEDIA IS A FEATURE. The archive being shown belongs to the platform,
 * not to any single edition, so the film and the frames are the same objects
 * across Asia, Africa and MENA. Swap a path here and every edition follows.
 *
 * REAL PROOF ONLY. The speakers are real people photographed at the platform's
 * own programmes — names, titles and organisations verbatim from the
 * photographed record. The partner marks are the historical client set.
 * Nothing here is invented and nothing points outside /public.
 *
 * ASSET PATHS ARE HISTORICAL. Files under /media/financial-rails-v2/ keep the
 * directory name they were encoded into; renaming them on disk would buy
 * nothing and break every cached URL.
 */

/** The institution, stated once so no surface can drift from it. */
export const FINANCIAL_RAILS = {
  name: "Financial Rails",
  positioning: "The infrastructure of the next financial system.",
  descriptor: "The infrastructure of the next financial system",
  summitBrand: "Financial Rails Summit",
  operator: "Vostad",
  domain: "financialrails.org",
  origin: "https://financialrails.org",
  /**
   * The institution in one sentence, for machines: the meta description the
   * root document carries and the `description` on both the Organization and
   * the WebSite node. Stated here so the three can never disagree.
   */
  seoDescription:
    "Financial Rails is the institutional platform for the infrastructure through which money is created, moved, settled, secured and governed — convening institutions, regulators and builders through executive forums, the FR30, the Council and original intelligence.",
};

/** The Agenda — the four chapters every edition works through. */
export const FINANCIAL_RAILS_AGENDA = ["Money", "Markets", "Infrastructure", "Rules"];

export const FR_NAV = [
  { label: "The Room", id: "the-room" },
  { label: "The People", id: "the-people" },
  { label: "The Experience", id: "the-experience" },
];

/**
 * 01 — the hero film, shared by every edition. One asset, one encode: the
 * institution has one archive and every edition draws the same frame from it.
 *
 * Encoded from original-media/video-digital-accord.mp4 (1920×1080, 60fps,
 * 26.7 MB, no audio) at native resolution, 30fps, H.264 crf 34, faststart:
 * 3.30 MB, an 8.1× reduction that measures visually indistinguishable from
 * the source at the hero's rendered width. The poster is the encoded film's
 * own first frame, so there is no tonal step when playback starts, and it is
 * stored in native colour — the grayscale is a CSS filter over both video and
 * poster, which keeps the two identical in every state including hover.
 */
export const FR_HERO_FILM = {
  src: "/media/financial-rails-v2-hero.mp4",
  poster: "/media/financial-rails-v2-hero-poster.jpg",
};

/**
 * 01 — the hero's editorial proof. One isolated asset reference: change
 * `base` and the hero follows, with no other edit anywhere.
 *
 * DESKTOP ONLY. The frame is rendered above lg and nowhere else, and its
 * `<source>` elements are media-gated to the same breakpoint so a phone never
 * requests the file at all — see the micro-site's hero photo component. `sizes` therefore describes
 * only the desktop track: a six-column slot measuring (50vw − 136px).
 *
 * The source is 16:9 and the frame is 16:9, so nothing is cropped — the room's
 * full depth survives, which is the whole point of the picture.
 */
export const FR_HERO_IMAGE = {
  base: "/media/microsite/closing-frame",
  widths: [768, 1280, 1920, 2560, 3840],
  intrinsic: { width: 3840, height: 2160 },
  alt: "Delegates seated at round tables during a conference session",
  sizes: "calc(50vw - 136px)",
};

/**
 * 02 — the spread's photograph. One isolated asset reference: change `base`
 * and the section follows, with no other edit anywhere.
 *
 * It carries its own `sizes` rather than the shared library's. That library
 * describes each frame for the master layout's five-column slot and caps at a
 * flat 508px above 1376px wide; this spread runs the picture in a six-column
 * slot that reaches 824px at 1920, so the shared value would under-declare by
 * a third and fetch a 1280 file where 1648 device pixels are needed. The
 * measured track is (50vw − 136px) at lg and up.
 */
export const FR_WHY_IMAGE = {
  base: "/media/microsite/why-attend",
  widths: [480, 768, 1280, 1888],
  intrinsic: { width: 2000, height: 2500 },
  alt: "Delegates talking together at a conference",
  sizes:
    "(min-width: 1024px) calc(50vw - 136px), (min-width: 768px) calc(100vw - 96px), calc(100vw - 48px)",
};

/**
 * 03 — the room's photograph: the same frame the hero's desktop-only proof
 * uses, because it IS the section's subject — a closed room of senior
 * delegates at round tables, receding into depth. The only unused archive
 * frame is a single speaker at a lectern, which this slot excludes. Shown at
 * 16:9, the source's own ratio, so nothing is cropped. Six-column slot:
 * (50vw − 136px) at lg and up.
 */
export const FR_ROOM_IMAGE = {
  base: "/media/microsite/closing-frame",
  widths: [768, 1280, 1920, 2560, 3840],
  intrinsic: { width: 3840, height: 2160 },
  alt: "Delegates seated at round tables during a conference session",
  sizes:
    "(min-width: 1024px) calc(50vw - 136px), (min-width: 768px) calc(100vw - 96px), calc(100vw - 48px)",
};

/* The roster: the shared Financial Rails leaders, the same list and the same
   order as the homepage, re-exported so an edition keeps its own name for it
   while every surface stays in step. */
export { FINANCIAL_RAILS_LEADERS as FR_SPEAKERS } from "@/lib/financial-rails-leaders";

export const FR_ROOM_FILTERS = ["No mass audience.", "No exhibition floor.", "No press."];

export const FR_PARTNERS_STATEMENT =
  "The institutions below have already shaped this conversation.";

/**
 * 05 — THE EXPERIENCE's own photography.
 *
 * These four frames belong to this chapter alone and are NOT part of the
 * shared microsite set: the homepage, /partners and the FR30 pages all read
 * MICROSITE_PHOTOS, so recasting the Experience chapter through that library
 * would have moved images on three other pages. They live here instead, and
 * the shared library is untouched.
 *
 * Encoded from original-media/experience/*.jpg — four uniform 1920×1080
 * masters, 146–256 KB each — into AVIF with a JPEG fallback at 480/768/1280/
 * 1920. The ceiling is the native 1920 because the widest slot the chapter
 * ever renders is 824 CSS px, which needs 1648 device pixels at 2× DPR; the
 * masters themselves are never served.
 *
 * THE CARDS CROP, THE MASTERS DO NOT. The band is a fixed height with a fluid
 * width, so its ratio runs from 1.44:1 in the two-column range to 2.90:1 at
 * 1920 — the same file is cropped horizontally at phone widths and vertically
 * on a wide desktop. Every frame is therefore delivered whole at 16:9 and
 * placed by the per-card `object-position` in EXPERIENCE_CARDS, which is where
 * the art direction lives.
 */
const EXPERIENCE_WIDTHS = [480, 768, 1280, 1920];

/** Overridden at render by the card's own CARD_SIZES; kept honest here. */
const EXPERIENCE_SIZES =
  "(min-width: 1024px) calc(50vw - 136px), (min-width: 768px) calc(50vw - 68px), calc(100vw - 48px)";

const experienceFrame = (name: string, alt: string): MicrositePhoto => ({
  base: `/media/financial-rails-v2/experience/${name}`,
  widths: EXPERIENCE_WIDTHS,
  intrinsic: { width: 1920, height: 1080 },
  alt,
  sizes: EXPERIENCE_SIZES,
});

/** 05 — the four experiences, locked, each with its own composition note. */
export type FrExperience = {
  index: string;
  title: string;
  body: string;
  /** The chapter's own frame — null renders the typographic panel. */
  photo: MicrositePhoto | null;
};

/**
 * The four frames, exported so sibling editions share the exact same media
 * rather than duplicating the files or choosing their own.
 */
export const FR_EXPERIENCE_FRAMES = {
  keynote: experienceFrame(
    "keynote",
    "A speaker delivering opening remarks at a lectern beside a large presentation screen",
  ),
  networking: experienceFrame("networking", "Two delegates talking together during a break"),
  panel: experienceFrame(
    "panel",
    "A panel of speakers seated on stage in front of a seated audience",
  ),
  agenda: experienceFrame("agenda", "Delegates working with documents at tables during a session"),
};

/**
 * The edition object the template renders. It composes the exports above —
 * nothing here is new content, it is the same data assembled into the shape
 * EventMicrosite consumes.
 *
 * The lockup's fitted size: "Rails Summit" is the wide line at a measured
 * 7.23em, so it sets the ceiling, not "FINANCIAL". Below lg it runs against
 * (100vw − 48px) and 11vw holds from 320px up; at lg the six-column track
 * binds — 376px at 1024 is its tightest, where 4.7vw leaves 8% of margin.
 * These are the master's own values, unchanged.
 */
