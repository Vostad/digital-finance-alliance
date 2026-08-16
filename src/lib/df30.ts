/**
 * DIGITAL FINANCE DF30 — the editorial property's content and media manifest.
 *
 * The complete copy and imagery for /df30, and for that page only. Nothing
 * here is imported by the homepage, the event micro-site or the partner page,
 * and this module mutates nothing it imports, so DF30 can be recast by editing
 * this one file.
 *
 * THE NAME IS DIGITAL FINANCE DF30, short form DF30. Never D30, never Digital
 * Finance 30 — the franchise name is written out here once so no surface can
 * drift from it.
 *
 * REAL PHOTOGRAPHY ONLY. Both frames are the platform's own event record,
 * re-encoded from masters that already lived in /public/forums but were served
 * to no page. The 1600×1000 masters are 779 KB and 889 KB and are never
 * served; the ladders below are AVIF with a JPEG fallback, 27 KB and 23 KB at
 * the width this page actually renders. The masters are untouched.
 *
 * NO REGIONAL PHOTOGRAPHY EXISTS. The three forthcoming editions are Middle
 * East, India and Africa, and the library holds no photograph made in India or
 * in Africa. Labelling an existing UAE frame as either would be a false claim
 * about where the picture was taken, so the regional cards are typographic and
 * carry no image at all rather than an invented one.
 */

export type Df30Photo = {
  /** Path stem; widths and extensions are appended. */
  base: string;
  widths: number[];
  /** Intrinsic size of the encoded master, for the aspect-ratio hint. */
  intrinsic: { width: number; height: number };
  /** What is actually in the photograph — not what the section is about. */
  alt: string;
  sizes: string;
};

const LADDER = [480, 768, 1280, 1600];

/**
 * Both frames render in a six-column half of the content column, which sits
 * inside the shared Section's 96px rail and lg:px-16 padding: six of twelve
 * columns with 48px gutters resolves to 50vw − 136px. Below lg the halves
 * stack and the frame is the full content width inside the shell's padding.
 */
const HALF_COLUMN =
  "(min-width: 1024px) calc(50vw - 136px), (min-width: 768px) calc(100vw - 96px), calc(100vw - 48px)";

/** 01 — the hero frame: the room the index is drawn from. */
export const DF30_HERO_PHOTO: Df30Photo = {
  base: "/media/df30/df30-hero",
  widths: LADDER,
  intrinsic: { width: 1600, height: 1000 },
  alt: "A speaker delivering opening remarks at a lectern before a seated conference audience",
  sizes: HALF_COLUMN,
};

/** 02 — the Global edition's frame. */
export const DF30_GLOBAL_PHOTO: Df30Photo = {
  base: "/media/df30/df30-global",
  widths: LADDER,
  intrinsic: { width: 1600, height: 1000 },
  alt: "A speaker addressing a summit audience with a microphone",
  sizes: HALF_COLUMN,
};

/** 01 — the hero, locked. */
export const DF30_HERO = {
  label: "Digital Finance DF30",
  headline: ["30 Leaders Shaping", "the Future of Finance"],
  lede: "An editorial index recognising the people building, transforming and governing the next financial system.",
  meta: "Global · Regional · Sector",
};

/** 02 — the Global edition, locked. */
export const DF30_FEATURED = {
  label: "Featured DF30",
  title: "Global DF30 — 2026",
  line: "30 Leaders Shaping the Future of Finance",
  published: "Published 15 August 2026",
  body: "The inaugural Global DF30 recognises 30 leaders whose work is materially shaping the infrastructure, institutions, markets and technologies of the next financial system.",
  cta: "Explore Global DF30",
  to: "/df30-global-list",
};

/**
 * 03 — the forthcoming editions. `status` is carried as data rather than
 * hard-coded in the layout, so a future edition ships by adding an object here
 * — GCC, Southeast Asia, Europe, Latin America — and an edition goes live by
 * giving it a `to`. None has a route yet, so none is a link.
 */
export type Df30Edition = {
  index: string;
  title: string;
  status: string;
  body: string;
  /** Absent until that edition has a page; the card is then not a link. */
  to?: string;
};

export const DF30_EDITIONS: Df30Edition[] = [
  {
    index: "01",
    title: "DF30 — Middle East",
    status: "Coming Soon",
    body: "Leaders shaping the future of digital finance across the Middle East.",
  },
  {
    index: "02",
    title: "DF30 — India",
    status: "Coming Soon",
    body: "Leaders transforming India's rapidly evolving financial ecosystem.",
  },
  {
    index: "03",
    title: "DF30 — Africa",
    status: "Coming Soon",
    body: "Leaders building the next generation of African financial infrastructure.",
  },
];

/** 04 — the methodology, locked. */
export const DF30_METHOD = {
  heading: "How the DF30 is built",
  statement:
    "The DF30 is an editorial selection, not a popularity contest or quantitative ranking. Each edition recognises leaders based on demonstrable contribution, institutional influence, current relevance and the significance of their work to the evolution of finance.",
  close: "Each edition is independently reviewed and published with a defined editorial date.",
};

export const DF30_PRINCIPLES = [
  {
    index: "01",
    title: "Contribution",
    body: "Demonstrable impact on financial systems, institutions or infrastructure.",
  },
  {
    index: "02",
    title: "Influence",
    body: "Meaningful influence beyond an individual's organisation.",
  },
  {
    index: "03",
    title: "Relevance",
    body: "Current contribution to the evolution of finance.",
  },
  {
    index: "04",
    title: "Verification",
    body: "Roles and material claims independently reviewed before publication.",
  },
];

/** 05 — the close, locked. */
export const DF30_CLOSE = {
  headline: ["The financial system", "is being rebuilt."],
  line: "DF30 recognises the people shaping what comes next.",
  signature: "Digital Finance Alliance",
};
