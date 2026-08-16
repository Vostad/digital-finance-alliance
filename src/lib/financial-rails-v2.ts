import { type MicrositePhoto } from "@/lib/microsite-photography";
import { DIGITAL_ASSET_ACCORD_LEADERS } from "@/lib/digital-asset-accord-leaders";
import type { EventMicrositeData } from "@/lib/event-microsite";

/**
 * FINANCIAL RAILS SUMMIT — V2 DATA.
 *
 * The complete content and media manifest for /forums/financial-rails-v2, and
 * for that page only. Nothing here is imported by V1, the homepage, or any
 * other micro-site, and this module mutates nothing it imports — it reads the
 * shared photo library and re-exports its own selection, so V2's media can be
 * recast by editing this one file.
 *
 * REAL PROOF ONLY. The speakers are real people photographed at the
 * platform's own programmes — names, titles and organisations verbatim from
 * the photographed record. The partner marks are the historical client set.
 * The copy is locked editorial content, reproduced exactly.
 *
 * All media points at assets that already live in /public — nothing external,
 * nothing invented. Swap a path here and the page follows.
 */

export const V2_EVENT = {
  name: "Financial Rails Summit",
  descriptor: "The infrastructure of the next financial system",
  footerLine: "The infrastructure of the next financial system.",
  positioning: "The institutions building the rails are already moving.",
  dates: "4–5 November 2026",
  city: "Dubai, UAE",
  capacity: "250 curated decision-makers. Invitation only.",
};

export const V2_NAV = [
  { label: "The Room", id: "the-room" },
  { label: "The People", id: "the-people" },
  { label: "The Experience", id: "the-experience" },
];

/**
 * 01 — the hero film. V2's own asset, not the shared `/media/hero-events.mp4`
 * that V1 and the other micro-sites play, so replacing it here cannot reach
 * another page.
 *
 * Encoded from original-media/video-digital-accord.mp4 (1920×1080, 60fps,
 * 26.7 MB, no audio) at native resolution, 30fps, H.264 crf 34, faststart:
 * 3.30 MB, an 8.1× reduction that measures visually indistinguishable from
 * the source at the hero's rendered width. The poster is the encoded film's
 * own first frame, so there is no tonal step when playback starts, and it is
 * stored in native colour — the grayscale is a CSS filter over both video and
 * poster, which keeps the two identical in every state including hover.
 */
export const V2_HERO_FILM = {
  src: "/media/financial-rails-v2-hero.mp4",
  poster: "/media/financial-rails-v2-hero-poster.jpg",
};

/**
 * 01 — the hero's editorial proof. One isolated asset reference: change
 * `base` and the hero follows, with no other edit anywhere.
 *
 * DESKTOP ONLY. The frame is rendered above lg and nowhere else, and its
 * `<source>` elements are media-gated to the same breakpoint so a phone never
 * requests the file at all — see V2HeroPhoto. `sizes` therefore describes
 * only the desktop track: a six-column slot measuring (50vw − 136px).
 *
 * The source is 16:9 and the frame is 16:9, so nothing is cropped — the room's
 * full depth survives, which is the whole point of the picture.
 */
export const V2_HERO_IMAGE = {
  base: "/media/microsite/closing-frame",
  widths: [768, 1280, 1920, 2560, 3840],
  intrinsic: { width: 3840, height: 2160 },
  alt: "Delegates seated at round tables during a conference session",
  sizes: "calc(50vw - 136px)",
};

/** 02 — locked, in reading order. */
export const V2_WHY = {
  heading: "This is where the next financial system gets built.",
  couplet: ["You won't be told what might happen.", "You'll meet the people making it happen."],
  close: "That is the only reason to be here.",
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
export const V2_WHY_IMAGE = {
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
export const V2_ROOM_IMAGE = {
  base: "/media/microsite/closing-frame",
  widths: [768, 1280, 1920, 2560, 3840],
  intrinsic: { width: 3840, height: 2160 },
  alt: "Delegates seated at round tables during a conference session",
  sizes:
    "(min-width: 1024px) calc(50vw - 136px), (min-width: 768px) calc(100vw - 96px), calc(100vw - 48px)",
};

/** 03 — the four figures, locked. */
export const V2_ROOM_FIGURES = [
  { value: "200+", line: "C-level executives from banking, payments, markets, and technology" },
  { value: "40+", line: "Speakers and contributors already building the rails" },
  { value: "20+", line: "Selected partners with real infrastructure to show" },
  { value: "2", line: "Days of closed-door working sessions" },
];

export const V2_ROOM_FILTERS = ["No mass audience.", "No exhibition floor.", "No press."];

export const V2_ROOM_CLOSE =
  "A deliberately limited room for the institutions funding, building, regulating, and operating the next financial system.";

/* 04 — the roster: the shared Digital Finance Alliance leaders, same list and
   same order as the homepage, re-exported so this page keeps its own name for
   it while both surfaces stay in step. */
export { DIGITAL_ASSET_ACCORD_LEADERS as V2_SPEAKERS } from "@/lib/digital-asset-accord-leaders";

export const V2_PARTNERS_STATEMENT =
  "The institutions below have already shaped this conversation.";

/**
 * 05 — THE EXPERIENCE's own photography.
 *
 * These four frames belong to this chapter alone and are NOT part of the
 * shared microsite set: the homepage, /partners and the DF30 pages all read
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
export type V2Experience = {
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
export const V2_EXPERIENCE_FRAMES = {
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

export const V2_EXPERIENCE: V2Experience[] = [
  {
    index: "01",
    title: "Keynotes from people who move money",
    body: "The leaders running the biggest payment networks, settlement systems, and digital asset platforms share what they are building—and what they need from the room.",
    photo: V2_EXPERIENCE_FRAMES.keynote,
  },
  {
    index: "02",
    title: "Private 1:1 meetings",
    body: "Pre-arranged meetings built around your strategic priorities. The right person in the right conversation. No wasted time.",
    photo: V2_EXPERIENCE_FRAMES.networking,
  },
  {
    index: "03",
    title: "Panels that talk about solutions",
    body: "No theory. No slideware. Closed-door sessions where operators and regulators break down what is working, what is broken, and what must change next.",
    photo: V2_EXPERIENCE_FRAMES.panel,
  },
  {
    index: "04",
    title: "The Financial Rails Agenda",
    body: "Leave with the annual institutional agenda capturing what is ready to scale, what remains unresolved, and what to build next.",
    /* The forthcoming annual output, represented by a real frame — delegates
       working at the table — not an invented report cover. */
    photo: V2_EXPERIENCE_FRAMES.agenda,
  },
];

/** 05 · the Output strip's horizontal editorial index. */
export const V2_OUTPUT_INDEX = ["Money", "Markets", "Infrastructure", "Rules"];

/** 06 — the close, locked. */
export const V2_INVITATION = {
  heading: "The rails are being built now.",
  line: "Be in the room where they are defined.",
  body: "A closed-door gathering of 250 curated decision-makers shaping the infrastructure of the next financial system.",
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
export const FINANCIAL_RAILS_EVENT: EventMicrositeData = {
  event: V2_EVENT,
  heroLabel: "Financial Rails",
  heroTitle: ["Financial", "Rails Summit"],
  heroTitleClass: "text-[clamp(2.2rem,11vw,6rem)] lg:text-[clamp(2.6rem,4.7vw,7.5rem)]",
  nav: V2_NAV,
  heroFilm: V2_HERO_FILM,
  heroImage: V2_HERO_IMAGE,
  why: V2_WHY,
  whyImage: V2_WHY_IMAGE,
  roomHeading: "250 decision-makers. No spectators.",
  roomFigures: V2_ROOM_FIGURES,
  roomImage: V2_ROOM_IMAGE,
  roomFilters: V2_ROOM_FILTERS,
  roomClose: V2_ROOM_CLOSE,
  peopleHeading: "You will be in the room with the people who matter.",
  speakers: DIGITAL_ASSET_ACCORD_LEADERS,
  partnersStatement: V2_PARTNERS_STATEMENT,
  experienceHeading: "This is not a conference. This is a working room.",
  experience: V2_EXPERIENCE,
  outputIndex: V2_OUTPUT_INDEX,
  invitation: V2_INVITATION,
};
