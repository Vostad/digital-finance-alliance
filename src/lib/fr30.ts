/**
 * FR30 — the editorial property's content and media manifest.
 *
 * The complete copy and imagery for /df30, and for that page only. Nothing
 * here is imported by the homepage, the event micro-site or the partner page,
 * and this module mutates nothing it imports, so FR30 can be recast by editing
 * this one file.
 *
 * THE NAME IS FR30. Never FR-30, never Financial Rails 30, never DF30 — the
 * franchise name is written out here once so no surface can drift from it.
 * It reads as "the thirty people shaping the infrastructure of the next
 * financial system", and that sentence is the whole editorial remit.
 *
 * REAL PHOTOGRAPHY ONLY. Both frames are the platform's own event record,
 * re-encoded from masters that already lived in /public/forums but were served
 * to no page. The 1600×1000 masters are 779 KB and 889 KB and are never
 * served; the ladders below are AVIF with a JPEG fallback, 27 KB and 23 KB at
 * the width this page actually renders. The masters are untouched.
 *
 * NO REGIONAL PHOTOGRAPHY EXISTS. The forthcoming editions are Asia, Africa
 * and the Gulf, and the library holds no photograph made in Asia or in Africa.
 * Labelling an existing UAE frame as either would be a false claim about where
 * the picture was taken, so the regional cards are typographic and carry no
 * image at all rather than an invented one.
 */

export type Fr30Photo = {
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
export const FR30_HERO_PHOTO: Fr30Photo = {
  base: "/media/df30/df30-hero",
  widths: LADDER,
  intrinsic: { width: 1600, height: 1000 },
  alt: "A speaker delivering opening remarks at a lectern before a seated conference audience",
  sizes: HALF_COLUMN,
};

/** 02 — the Global edition's frame. */
export const FR30_GLOBAL_PHOTO: Fr30Photo = {
  base: "/media/df30/df30-global",
  widths: LADDER,
  intrinsic: { width: 1600, height: 1000 },
  alt: "A speaker addressing a summit audience with a microphone",
  sizes: HALF_COLUMN,
};

/** 01 — the hero, locked. */
export const FR30_HERO = {
  label: "FR30",
  headline: ["The 30 people", "building the rails"],
  lede: "An editorial index of the people building the infrastructure money moves through.",
  meta: "Money · Markets · Infrastructure · Rules",
};

/** 02 — the Global edition, locked. */
export const FR30_FEATURED = {
  label: "Featured FR30",
  title: "Global FR30 — 2026",
  line: "The 30 people building the rails",
  published: "Published 15 August 2026",
  body: "The inaugural Global FR30 recognises thirty people whose work is materially shaping the payment networks, settlement systems, market infrastructure and rules that money moves through.",
  cta: "Explore Global FR30",
  to: "/fr30-global-list",
};

/**
 * 03 — the forthcoming editions. `status` is carried as data rather than
 * hard-coded in the layout, so a future edition ships by adding an object here
 * — GCC, Southeast Asia, Europe, Latin America — and an edition goes live by
 * giving it a `to`. None has a route yet, so none is a link.
 */
export type Fr30Edition = {
  index: string;
  title: string;
  status: string;
  body: string;
  /** Absent until that edition has a page; the card is then not a link. */
  to?: string;
};

export const FR30_EDITIONS: Fr30Edition[] = [
  {
    index: "01",
    title: "FR30 — Asia",
    status: "Coming Soon",
    body: "The people operating the instant payment schemes, settlement systems and digital banks that already run at national scale.",
  },
  {
    index: "02",
    title: "FR30 — Africa",
    status: "Coming Soon",
    body: "The people building mobile money, instant payments and the cross-border infrastructure the continent still lacks.",
  },
  {
    index: "03",
    title: "FR30 — Gulf",
    status: "Coming Soon",
    body: "The people building the settlement, tokenization and regulatory infrastructure of the Gulf's financial centres.",
  },
];

/** 04 — the methodology, locked. */
export const FR30_METHOD = {
  heading: "How the FR30 is built",
  statement:
    "The FR30 is an editorial selection, not a popularity contest or a quantitative ranking. Each edition recognises people on demonstrable contribution to financial infrastructure, institutional influence, current relevance, and the significance of their work to how money is moved, settled and governed.",
  close: "Each edition is independently reviewed and published with a defined editorial date.",
};

export const FR30_PRINCIPLES = [
  {
    index: "01",
    title: "Contribution",
    body: "Demonstrable impact on the systems money actually moves through.",
  },
  {
    index: "02",
    title: "Influence",
    body: "Meaningful influence beyond an individual's organisation.",
  },
  {
    index: "03",
    title: "Relevance",
    body: "Work that is live now, not a reputation earned elsewhere.",
  },
  {
    index: "04",
    title: "Verification",
    body: "Roles and material claims independently reviewed before publication.",
  },
];

/** 05 — the close, locked. */
export const FR30_CLOSE = {
  headline: ["The financial system", "is being rebuilt."],
  line: "FR30 recognises the people doing the rebuilding.",
  signature: "Financial Rails",
};
