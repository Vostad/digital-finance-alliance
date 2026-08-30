/**
 * FINANCIAL RAILS SUMMIT — Dubai · 18–19 November 2026.
 *
 * The V4 microsite's single source of content. Every sentence the page speaks
 * lives here; the component in FinancialRailsSummit.tsx carries composition
 * and nothing else. Three rules govern this file:
 *
 * CONSISTENCY LOCKS. The commercial numbers — 400 seats capped, ~220
 * institutional decision-makers, 370+ pre-scheduled meetings, 14 Vostad
 * finance events since 2018, up to 20 contracted meetings, 33 partner
 * positions at $7,000–$85,000 — are stated once each here and read from here
 * everywhere. Never introduce a variant.
 *
 * CLOSED ALLOWLISTS. The speaker roster below is the complete set of people
 * this page may show. It is not the shared FINANCIAL_RAILS_LEADERS roster —
 * that file feeds other pages and includes people this page must not render.
 * Do not add a name because a portrait exists; a portrait is not permission.
 *
 * MISSING BEATS INVENTED. Commercial deadlines and approved partner logos are
 * architecture-only: their config defaults to empty, and the page hides the
 * entire block while it is empty. No placeholders, no TBA.
 */

/* ------------------------------------------------------------------ event */

export const SUMMIT = {
  brand: "Financial Rails",
  name: "Financial Rails Summit",
  /** The masthead, authored as its two lines. */
  nameLines: ["Financial Rails", "Summit MENA"],
  proposition: "The people who move the Gulf's money.",
  dateline: "Dubai · 18–19 November 2026",
  dates: "18–19 November 2026",
  city: "Dubai, UAE",
  trustLine: "Vostad's 14th finance event. The first Financial Rails.",
  startDateISO: "2026-11-18",
  endDateISO: "2026-11-19",
} as const;

/* The exactly-two CTA phrasings that exist anywhere on this page. */
export const CTA = {
  prospectus: "Request the Prospectus",
  apply: "Apply to Attend",
} as const;

export const SUMMIT_NAV = [
  { label: "The Room", id: "the-room" },
  { label: "How It Works", id: "how-it-works" },
  { label: "Agenda", id: "agenda" },
  { label: "Speakers", id: "speakers" },
  { label: "Partnership", id: "partnership" },
  { label: "About", id: "about" },
] as const;

/* ---------------------------------------------------------- 02 the market */

/**
 * The market, stated as evidence. The section argues scale and momentum —
 * it does NOT argue absence. Earlier drafts closed on the room being missing
 * ("the buyers exist… the room doesn't"); that framing is retired. The
 * market is moving and its operators are already in it; section 03 answers
 * how the room is built around that.
 */
export const MARKET = {
  label: "The Market",
  headline: "$58 billion leaves the UAE every year.",
  /* One primary figure carrying the scale, two supporting it. */
  primaryStat: { value: "$58B", line: "Outbound remittances" },
  supportingStats: [
    { value: "40%", line: "Growth in the UAE's licensed payment-institution register" },
    { value: "61", line: "Licensed banks" },
  ],
  closing: ["The rails are moving.", "The people moving them are already in the market."],
} as const;

/* ------------------------------------------------------------ 03 the room */

export const ROOM = {
  label: "The Room",
  headline: "The room was designed before the seats were sold.",
  /* The room's specification, and only that. The fourteen-event track
     record is Vostad's, not this room's — it lives in the hero trust line
     and in section 11, and mixing it in here made a specification read as a
     CV. Three figures, deliberately. */
  proofRail: [
    { value: "400", line: "Seats, capped" },
    { value: "~220", line: "Institutional decision-makers" },
    { value: "370+", line: "Pre-scheduled meetings" },
  ],
  philosophy: ["No mass audience.", "No passive attendance.", "No unqualified seats."],
  support:
    "A deliberately limited room for the institutions funding, building, regulating and operating the next financial system.",
} as const;

/* --------------------------------------------------------- 04 who is in it */

export const AUDIENCE = {
  label: "Who Is in It",
  headline: "The audience you'd build by hand, if you had six months and a licence register.",
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
  qualificationHeading: "Our qualification bar, in public",
  qualification:
    "Budget authority or direct influence over payments, treasury or infrastructure spend · organisation on an approved register — licensed financial institution, listed or large corporate, regulated fintech · title floor of Head-of / Director · verified seat by seat by our team.",
  compositionLabel: "Target Composition",
  composition:
    "~35% banks · ~20% licensed payment institutions · ~20% corporate treasury · ~15% infrastructure fintech · ~10% schemes and regulators.",
  compositionNote: "Target composition, verified seat by seat.",
  buyerHeadline: "If you qualify, you attend as our guest.",
  buyerLine: "You choose which meetings you accept — nothing is scheduled without you.",
  buyerNote:
    "Applications are reviewed within five working days, in order received. Buy-side capacity is approximately 220 institutional decision-makers.",
} as const;

/* -------------------------------------------------------- 05 how it works */

export const PROCESS = {
  label: "How It Works",
  headline: "Meetings are the product. Here's the machinery.",
  steps: [
    {
      title: "You name your targets.",
      body: "Partners give us the organisations and titles they need in their pipeline. Buyers tell us what they're evaluating.",
    },
    {
      title: "We match. Both sides opt in.",
      body: "No ambushes. A meeting happens only when both parties accept it.",
    },
    {
      title: "Your schedule lands before you do.",
      body: "Names, titles, table, time — in your hands before day one. Your two days are planned before your flight.",
    },
    {
      title: "You leave with a record.",
      body: "A meeting-outcome report for your pipeline review. Not a stack of scanned badges.",
    },
  ],
  guarantee: "A no-show is replaced.",
  footer: "Built and operated by the team behind fourteen finance-sector events.",
} as const;

/* ------------------------------------------------------- 06 the difference */

export const DIFFERENCE = {
  label: "The Difference",
  headline: ["You already sponsor events with 30,000 visitors.", "How many became pipeline?"],
  expoHeading: "The Mega-Expo Model",
  railsHeading: "Financial Rails",
  rows: [
    { expo: "28K–38K claimed audience", rails: "400 people, capped" },
    {
      expo: "Free registration, open to anyone",
      rails: "Buyers verified against the licence register",
    },
    { expo: "On-site lead capture", rails: "Up to 20 contracted meetings, booked before you land" },
    { expo: "Badge scanning", rails: "The decision-maker, across the table" },
    { expo: "Broad brand visibility", rails: "A meeting report you can hand your CFO" },
  ],
  closing: ["Scale creates reach.", "Curation creates access."],
  support: "Many partners do both: the expo for brand, Financial Rails for pipeline.",
} as const;

/* ------------------------------------------------------------ 07 the agenda */

export const AGENDA = {
  label: "The Agenda",
  headline: "Two days on the systems that move money. Nothing else.",
  tracks: [
    { title: "Cross-Border & Corridors", line: "The $58bn question" },
    { title: "Instant & National Rails", line: "Aani, Jaywan, Buna, UPI" },
    { title: "The Correspondent Stack", line: "ISO 20022, Swift, bank-to-bank" },
    { title: "Corporate Treasury", line: "Cash, liquidity, FX" },
    { title: "Open Finance & Embedded Rails", line: "The UAE framework, A2A" },
    { title: "Regulated Digital Money", line: "Dirham stablecoins, tokenised settlement" },
  ],
  format: "22 curated sessions · 6 closed-door roundtables · 2 private dinners · Two days",
  refusals: ["No consumer fintech.", "No crypto trading.", "No AI theatre."],
  refusalClose: "If it doesn't move money, it isn't on the agenda.",
} as const;

/* ------------------------------------------------------------ 08 the voices */

/**
 * CLOSED ALLOWLIST. Seven of the ten approved names have portraits in the
 * repo; the three without portraits — Mohammad Wassim, Matthew van Niekerk,
 * Ussrah Hussain — are omitted entirely rather than substituted, and join
 * the page the day their portraits do. Titles are the approved strings, not
 * the shared roster's. Mario Nawfal is deliberately absent.
 */
export const VOICES = {
  label: "The Voices",
  headline: "You will be in the room with the people who matter.",
  subhead: "Previous Speakers",
  speakers: [
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
  footnote:
    "Selected speakers from previous Vostad finance-sector events. Titles reflect roles at the time of participation. Financial Rails 2026 faculty will be announced separately.",
  institutionsHeading: "Institutions Represented on Our Stages",
  institutions: [
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
  institutionsFootnote:
    "Institutional names indicate participation across Vostad events. No endorsement or affiliation is implied.",
} as const;

/**
 * Approved commercial partner logos. EMPTY until an explicit allowlist is
 * supplied — the 80 numbered files in /network-logos-trimmed carry no
 * identity metadata, so none can be verified as a commercial partner, and
 * the "Partners Across Our Platforms" block does not render while this is
 * empty. Adding approved entries here lights the block up without redesign.
 */
export const PARTNER_LOGOS: { name: string; src: string }[] = [];

/* ------------------------------------------------------------ 09 the window */

export const WINDOW = {
  label: "The Window",
  headline: "The rails are being rebuilt. The window is 2027–2029.",
  clockHeading: "The Clock",
  clock: [
    { title: "Aani", line: "12.5 million users. 750,000 merchants. Live." },
    { title: "Jaywan", line: "The national card scheme. Issuing now." },
    {
      title: "ISO 20022",
      line: "Hard deadlines in 2026, 2027 and 2028. Every bank mid-migration.",
    },
    { title: "Open Finance", line: "Framework live. First banks licensed." },
    { title: "UPI · Buna · Dirham Stablecoins", line: "Three new cross-border rails." },
    { title: "Sibos Dubai 2029", line: "Swift is coming. We convene first." },
  ],
  cityHeading: "The City",
  city: [
    { title: "The Licensed Base", line: "61 banks. 30+ PSPs. 60+ exchange houses." },
    {
      title: "The Decision-Makers",
      line: "Vendor regional headquarters, the region's largest acquirer and the treasury community.",
    },
    {
      title: "The Reach",
      line: "DXB. One of the world's busiest international airports. 270+ destinations.",
    },
  ],
  closing: ["The window is 2027–2029.", "The room is in Dubai."],
} as const;

/* ---------------------------------------------------------- 10 partnership */

export const PARTNERSHIP = {
  label: "Partnership",
  headline: "Put your brand in the room.",
  intro:
    "Financial Rails partnerships are built around executive access, thought leadership, business development, visibility and strategic positioning.",
  range: "33 partner positions · $7,000–$85,000",
  rangeNote:
    "From Title Partner to focused partnership opportunities, the full architecture is built around the commercial goals of each partner.",
  architecture: [
    { tier: "Title", line: "The event carries your name · 1 position, exclusive" },
    { tier: "Strategic / Banking", line: "Stage and volume · 2 positions each" },
    { tier: "Category", line: "Own your category outright · 6 positions, one per category" },
    { tier: "Meetings", line: "Pipeline, undiluted" },
    { tier: "Roundtable", line: "Your closed-door room" },
    { tier: "Networking", line: "Own a hospitality moment" },
    { tier: "Exhibitor", line: "Presence, priced to enter" },
  ],
  proofNote: "Every number in the prospectus is a contract term, not a projection.",
  proofDetail:
    "Figures describe the room as designed and capped. Meeting counts are contracted per partnership.",
  supporting:
    "Bring your target list to the call. We'll map it against the room and tell you honestly if we can't deliver your buyers.",
} as const;

/**
 * Commercial deadlines. NULL until real dates are supplied — while any value
 * is null the page hides the entire deadline block. Never render a
 * placeholder in its place.
 */
export const COMMERCIAL_DEADLINES: {
  programmeLocks: string | null;
  schedulingOpens: string | null;
  positionsClose: string | null;
} = {
  programmeLocks: null,
  schedulingOpens: null,
  positionsClose: null,
};

/* -------------------------------------------------------------- 11 about */

export const ABOUT = {
  label: "About",
  headline: "Our 14th finance event. Built by operators, run on evidence.",
  platforms: [
    { name: "Blockchain & AI for Finance", years: "2018–2022" },
    { name: "Islamic Fintech Forum", years: "2019–2024" },
    { name: "World Token Summit", years: "2023–Present" },
  ],
  trackRecord: [
    { value: "100+", line: "Events & trainings" },
    { value: "1,200+", line: "Partners" },
    { value: "55+", line: "Countries" },
  ],
  body: "Vostad has convened conferences, forums and executive programmes across finance, technology, energy and industry since 2014.",
  sponsorsHeading: "Selected Series Sponsors",
  sponsors: [
    "HSBC",
    "Visa",
    "Mastercard",
    "Swift",
    "Citi",
    "Standard Chartered",
    "Temenos",
    "Stripe",
  ],
  closing: ["Be in the room.", "When the rails move."],
  closingMeta: "400 seats · ~220 institutional decision-makers · One room.",
  contact: {
    name: "Zahid Mir",
    roles: ["CEO, Vostad", "Founder, Financial Rails"],
    email: "zahid@financialrails.org",
    phone: "+91 8197851926",
    /** Portrait path, when one is supplied. Absent today: the block renders
        as a complete text composition, and the portrait drops into the
        reserved grid column without relayout when this becomes a string. */
    portrait: null as string | null,
  },
  evidenceLine: "Ask us for the evidence behind any claim on this site. We'll show you the source.",
} as const;

/* ------------------------------------------------------ final band + footer */

export const FINAL_BAND = "33 partner positions · ~220 institutional decision-makers · One room.";

export const FOOTER = {
  brand: "Financial Rails",
  line: "The Gulf's meeting place for the people who move money. A Vostad platform.",
  email: "partners@financialrails.org",
  location: "Dubai, UAE",
  legal: "© 2026 Vostad",
  evidence: "Built on evidence. Verified seat by seat.",
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
 * THE ONE DELIVERY SEAM. The repo has no form backend — every existing form
 * on the site is a preventDefault stub — and inventing one is out of scope.
 * When the hosted endpoint is supplied, implement this function and both
 * modals ship without another change. Until then it resolves successfully so
 * the UI's success state is honest about what the page can do locally.
 */
export async function submitLead(payload: LeadPayload): Promise<void> {
  // TODO(endpoint): POST `payload` to the hosted form endpoint when supplied.
  void payload;
}
