/**
 * FINANCIAL RAILS SUMMIT MENA — /forum/dubai-summit.
 *
 * The NEW Dubai Summit microsite's single source of content. This module is
 * deliberately independent of financial-rails-summit.ts: the two routes are
 * separate implementations and must never drift into each other through a
 * shared import. Every sentence the page speaks lives here; the component in
 * DubaiSummit.tsx carries composition and nothing else.
 *
 * CONSISTENCY LOCKS. The commercial numbers — 400 seats capped, ~220
 * institutional decision-makers, 370+ pre-scheduled meetings, 9 Vostad
 * finance editions, 33 partner positions at $7,000–$85,000 — are stated once
 * each here and read from here everywhere. Never introduce a variant.
 * (The approved content architecture for THIS page says NINTH edition; the
 * legacy /forums/financial-rails-mena page says 14th. The two pages disagree
 * by design of their own briefs — reconcile before both are live.)
 *
 * CLOSED ALLOWLISTS. The seven speakers below are the complete set this page
 * may show — Mario Nawfal has a portrait in the repo and is deliberately
 * absent. The ten media logos are the ten files supplied in
 * /media/publications, each visually identified before being listed here.
 *
 * MISSING BEATS INVENTED. The sponsor section shows exactly the three
 * verified past-sponsor logos supplied for it — no aggregate count, no
 * padding of the roster. Institutional LOGOS still have no verifiable files
 * (network-logos-trimmed is 80 numbered files with no identity), so the
 * attended-by strip renders the approved NAMES as wordmarks over an empty
 * logo allowlist. Testimonials: none exist anywhere in the repo, so the
 * section is architecture-only and hides itself while the list is empty.
 */

/* ------------------------------------------------------------------ event */

export const EVENT = {
  brand: "Financial Rails",
  name: "Financial Rails Summit MENA",
  nameLines: ["Financial Rails", "Summit MENA"],
  proposition: "The people who move the Gulf's money.",
  dateline: "Dubai · 18–19 November 2026",
  dates: "18–19 November 2026",
  city: "Dubai, UAE",
  trustLine: "Vostad's ninth finance edition in the series. The first Financial Rails.",
  startDateISO: "2026-11-18",
  endDateISO: "2026-11-19",
} as const;

/* The exactly-two CTA phrasings that exist anywhere on this page. */
export const CTA = {
  prospectus: "Request the Prospectus",
  apply: "Apply to Attend",
} as const;

/**
 * The chapter map — the rail is the page's index, so this list IS the page.
 * Testimonials carries `gated: true`: the chapter (and its rail entry, and
 * its menu row) exists only once verified quotes are supplied below.
 */
export const CHAPTERS = [
  { index: "01", label: "Financial Rails", id: "top" },
  { index: "02", label: "Sponsors", id: "sponsors" },
  { index: "03", label: "The Summit", id: "the-summit" },
  { index: "04", label: "The Market", id: "the-market" },
  { index: "05", label: "Event in Numbers", id: "in-numbers" },
  { index: "06", label: "Featured Speakers", id: "speakers" },
  { index: "07", label: "Who Will You Meet", id: "who-will-you-meet" },
  { index: "08", label: "The Agenda", id: "agenda" },
  { index: "09", label: "Attended By", id: "attended-by" },
  { index: "10", label: "The Experience", id: "experience" },
  { index: "11", label: "Partner With Us", id: "partnership" },
  { index: "12", label: "Media", id: "media" },
  { index: "13", label: "Testimonials", id: "testimonials", gated: true },
] as const;

export type Chapter = (typeof CHAPTERS)[number];

/* -------------------------------------------------------------- 02 sponsors */

/**
 * CLOSED ALLOWLIST — exactly these three, as supplied. The heading's word
 * PAST is deliberate and load-bearing: these organisations have sponsored
 * Vostad's finance platforms, and this section must never read as a current
 * Financial Rails Summit MENA sponsor roster. No aggregate count exists for
 * this section, so none is shown.
 */
export const SPONSORS = {
  label: "Sponsors",
  heading: "Featured past sponsors",
  line: "Selected organisations that have sponsored Vostad's finance platforms.",
  logos: [
    { name: "Temenos", src: "/logos/temenos.png", alt: "Temenos — past sponsor" },
    { name: "Mashreq", src: "/logos/mashreq.png", alt: "Mashreq — past sponsor" },
    {
      name: "Qatar Financial Centre",
      src: "/logos/qatar-financial-centre.png",
      alt: "Qatar Financial Centre — past sponsor",
    },
  ],
} as const;

/* ------------------------------------------------------------ 03 the summit */

export const THE_SUMMIT = {
  label: "The Summit",
  headline: "The systems moving money across the Gulf",
  body: "Organised by Vostad, Financial Rails Summit MENA brings together the banks, payment institutions, treasury leaders and infrastructure operators building the rails behind cross-border payments, instant payments, open finance and digital settlement.",
  closing: "Nine finance editions. One room focused on what moves money next.",
} as const;

/* ------------------------------------------------------------ 04 the market */

export const MARKET = {
  label: "The Market",
  headline: "$58 billion leaves the UAE every year.",
  stats: [
    { value: "$58B", line: "Outbound remittances" },
    { value: "40%", line: "Growth in the UAE's licensed payment-institution register" },
    { value: "61", line: "Licensed banks" },
  ],
} as const;

/* ------------------------------------------------------- 05 event in numbers */

export const IN_NUMBERS = {
  label: "Event in Numbers",
  headline: "Built for the people moving the market.",
  stats: [
    { value: "400", line: "Seats, capped" },
    { value: "~220", line: "Institutional decision-makers" },
    { value: "370+", line: "Pre-scheduled meetings" },
    { value: "9", line: "Vostad finance editions" },
  ],
} as const;

/* -------------------------------------------------------------- 06 speakers */

/**
 * CLOSED ALLOWLIST — these seven, only. Titles are the approved strings.
 * Mario Nawfal is deliberately absent despite a portrait existing.
 */
export const SPEAKERS = {
  label: "Featured Speakers",
  headline: "People who have shaped the conversation.",
  intro: "Previous speakers from Vostad finance-sector events · 2018–2025",
  roster: [
    {
      name: "Dr. Marwan Alzarouni",
      title: "Chief Executive Officer",
      org: "Dubai Blockchain Center",
      image: "/leaders/marwan-alzarouni",
    },
    {
      name: "Dr. Ayesha Bin Lootah",
      title: "Assistant Vice President",
      org: "VARA",
      image: "/leaders/ayesha-bin-lootah",
    },
    {
      name: "Henk J. Hoogendoorn",
      title: "Chief, Financial Sector Office",
      org: "Qatar Financial Centre",
      image: "/leaders/henk-hoogendoorn",
    },
    {
      name: "Paul Kayrouz",
      title: "Chief Fintech Officer",
      org: "Central Bank of the UAE",
      image: "/leaders/paul-kayrouz",
    },
    {
      name: "Ibrahim Almheiri",
      title: "Chief Executive Officer",
      org: "Mashreq Al Islami",
      image: "/leaders/ibrahim-almheiri",
    },
    {
      name: "Giovanni Miano",
      title: "Chief Technology Officer",
      org: "Zodia Markets",
      image: "/leaders/giovanni-miano",
    },
    {
      name: "Daniel Coheur",
      title: "Co-Founder, Tokeny",
      org: "Apex Group",
      image: "/leaders/daniel-coheur",
    },
  ],
} as const;

/* ------------------------------------------------------ 07 who will you meet */

export const MEET = {
  label: "Who Will You Meet",
  headline: "The people who move it.",
  groups: [
    {
      role: "Heads of Payments & Transaction Banking",
      line: "From the UAE's 61 licensed banks and their GCC peers.",
    },
    { role: "Group Treasurers", line: "The region's flagship corporates." },
    {
      role: "CEOs of Licensed Payment Institutions",
      line: "30+ PSPs, 60+ exchange houses and stored-value licensees.",
    },
    {
      role: "Infrastructure Fintech Founders",
      line: "Scaling out of DIFC and ADGM — 1,900+ firms.",
    },
    { role: "Scheme & FMI Leadership", line: "The operators of the rails themselves." },
  ],
  closingHeadline: "Qualify to join the room.",
  closingLine: "Qualified delegates attend as our guest.",
} as const;

/* ---------------------------------------------------------------- 08 agenda */

export const AGENDA = {
  label: "The Agenda",
  headline: "The rails are moving.",
  tracks: [
    { title: "Cross-Border & Corridors", topics: "Corridors · settlement" },
    { title: "Instant & National Rails", topics: "Aani · Jaywan · Buna · UPI" },
    { title: "The Correspondent Stack", topics: "ISO 20022 · Swift" },
    { title: "Corporate Treasury", topics: "Cash · liquidity · FX" },
    { title: "Open Finance & Embedded Rails", topics: "A2A · embedded finance" },
    { title: "Regulated Digital Money", topics: "Stablecoins · tokenised settlement" },
  ],
  format: "22 curated sessions · 6 closed-door roundtables · 2 private dinners",
  closing: "If it doesn't move money, it isn't on the agenda.",
} as const;

/* ----------------------------------------------------------- 09 attended by */

export const ATTENDED_BY = {
  kicker: "Attended by leaders across finance · 2018–present",
  /* Approved institution names — attendance evidence, never partnership. */
  names: [
    "JPMorgan Chase",
    "QNB",
    "ADCB",
    "Al Rajhi Bank",
    "Emirates Islamic",
    "HSBC",
    "Visa",
    "Mastercard",
    "Swift",
    "Citi",
    "Standard Chartered",
    "Temenos",
    "Stripe",
  ],
  logos: [] as { name: string; src: string }[],
  disclaimer:
    "Institutional names indicate participation across Vostad events. No endorsement or affiliation is implied.",
} as const;

/* ------------------------------------------------------------ 10 experience */

export const EXPERIENCE = {
  label: "The Experience",
  headline: "Two days built around the conversations that matter.",
  moments: [
    { title: "The Stage", line: "Ideas and perspectives shaping what moves money next." },
    { title: "The Meetings", line: "Relevant conversations with the people you came to meet." },
    {
      title: "The Networking",
      line: "The conversations between sessions that become relationships.",
    },
    { title: "The Dinner", line: "Connections that continue beyond the stage." },
  ],
} as const;

/* ----------------------------------------------------------- 11 partnership */

export const PARTNER = {
  label: "Partner With Us",
  headline: "Put your brand in the room.",
  body: "Financial Rails brings together the institutions, decision-makers and infrastructure companies shaping the next generation of financial rails across the Gulf.",
  positions: "33 partner positions · $7,000–$85,000",
  footnote:
    "Full partnership architecture, availability and contract terms are provided in the prospectus.",
} as const;

/* ----------------------------------------------------------------- 12 media */

/**
 * The ten supplied files in /media/publications, each opened and visually
 * identified before being named here. All ten are media brands; none is a
 * regulator, central bank or exchange.
 */
export const MEDIA = {
  label: "Media",
  headline: "Seen across the industry.",
  kicker: "Media & publications represented · 2018–present",
  logos: [
    { name: "CNN", src: "/media/publications/media-1.png" },
    { name: "Forbes Middle East", src: "/media/publications/media-2.png" },
    { name: "Reuters", src: "/media/publications/media-3.png" },
    { name: "CNBC", src: "/media/publications/media-4.png" },
    { name: "Gulf News", src: "/media/publications/media-5.png" },
    { name: "The Guardian", src: "/media/publications/media-6.png" },
    { name: "Fox News", src: "/media/publications/media-7.png" },
    { name: "Bloomberg", src: "/media/publications/media-8.png" },
    { name: "The Times of India", src: "/media/publications/media-9.png" },
    { name: "Entrepreneur Middle East", src: "/media/publications/media-10.png" },
  ],
} as const;

/* ---------------------------------------------------------- 13 testimonials */

export type Testimonial = {
  quote: string;
  name: string;
  title: string;
  org: string;
  /** Portrait path stem, when supplied. */
  image?: string;
};

/**
 * EMPTY BY REQUIREMENT, not by accident: no verified testimonial exists
 * anywhere in this repository, and inventing one would put words in a real
 * person's mouth. The section, its rail chapter and its menu entry all hide
 * while this list is empty; adding verified quotes here lights the whole
 * chapter up without redesign.
 */
export const TESTIMONIALS: Testimonial[] = [];

export const TESTIMONIALS_COPY = {
  label: "Testimonials",
  headline: "What the room feels like.",
} as const;

/* ------------------------------------------------------- final band + footer */

export const FINAL_CTA = {
  lines: ["Be in the room.", "When the rails move."],
  dateLines: ["18–19 November 2026", "Dubai, UAE"],
} as const;

export const FOOTER = {
  brand: "Financial Rails",
  line: "The Gulf's meeting place for the people who move money. A Vostad platform.",
  /* The brief's footer nav names an About destination; this page has no
     About chapter, so the six real sections render and About is omitted
     rather than pointed at a dead anchor. */
  nav: [
    { label: "The Summit", id: "the-summit" },
    { label: "Speakers", id: "speakers" },
    { label: "Who You'll Meet", id: "who-will-you-meet" },
    { label: "Agenda", id: "agenda" },
    { label: "Experience", id: "experience" },
    { label: "Partnership", id: "partnership" },
  ],
  email: "partners@financialrails.org",
  location: "Dubai, UAE",
  evidence: "Ask us for the evidence behind any claim on this site. We'll show you the source.",
  legal: "© 2026 Vostad",
  tagline: "Built on evidence. Verified seat by seat.",
} as const;

/* ------------------------------------------------------------ lead capture */

export type LeadPayload =
  | { kind: "prospectus"; name: string; company: string; role: string; email: string }
  | {
      kind: "apply";
      name: string;
      organisation: string;
      title: string;
      email: string;
      evaluating: string;
    };

/**
 * THE ONE DELIVERY SEAM. The repo has no form backend; when the hosted
 * endpoint is supplied, implement this function and both modals ship without
 * another change. Until then it resolves successfully so the UI's success
 * state is honest about what the page can do locally.
 */
export async function submitLead(payload: LeadPayload): Promise<void> {
  // TODO(endpoint): POST `payload` to the hosted form endpoint when supplied.
  void payload;
}
