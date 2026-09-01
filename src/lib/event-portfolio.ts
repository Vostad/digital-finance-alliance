/**
 * THE FINANCIAL RAILS EVENT PORTFOLIO — the single source of truth for the
 * 2026 calendar.
 *
 * This module feeds every portfolio surface — the homepage's Featured / Next /
 * Upcoming sections and the forums directory — so the calendar is edited in
 * exactly one place and can never disagree with itself across pages. It feeds
 * NOTHING inside the event micro-sites: an edition owns its own content in its
 * own data module.
 *
 * ONE TEMPLATE, THREE EDITIONS. Financial Rails Summit is the umbrella brand;
 * Asia, Africa and MENA are its editions, and each is an instance of the same
 * canonical micro-site (src/components/site/EventMicrosite.tsx). Every one has
 * a page, so every card links. The `to` field stays optional so a future
 * announced-but-unbuilt edition can be listed unlinked rather than pointing at
 * a route that does not exist.
 *
 * Every event is one self-contained object. Changing one edition's date
 * touches that object alone; retiring an edition is deleting its object, and
 * the pages that read this list re-derive themselves.
 *
 * The array is kept in CALENDAR ORDER. Presentation order is a page decision —
 * the homepage leads with the flagship, not the nearest date — so pages select
 * by status rather than by position.
 */

export type EventStatus = "featured" | "next" | "upcoming";

export type PortfolioEvent = {
  id: string;
  /** Rendered through uppercase display type everywhere it appears. */
  name: string;
  tagline: string;
  status: EventStatus;
  /** The chip a card carries — "Featured Edition", "Next Edition", "Upcoming Edition". */
  statusLabel: string;
  dates: string;
  /**
   * The same day as `dates`, in ISO 8601, for schema.org `startDate`. Kept
   * beside the display string rather than parsed out of it, because "6 October
   * 2026" is written for a reader and a date parser should never be the thing
   * standing between an edition and its rich result.
   */
  startDateISO: string;
  city: string;
  country: string;
  /**
   * ISO 3166-1 alpha-2, for schema.org `addressCountry`. Google asks for the
   * code rather than the printed country name, and `country` above is the
   * printed name — "United Arab Emirates" is what a card should say and "AE"
   * is what a crawler should read.
   */
  countryCode: string;
  /**
   * The edition's own micro-site. Absent while an announced edition has no
   * page yet — the directory then renders the card unlinked rather than
   * pointing at a dead route.
   */
  to?: string;
  image: { src: string; alt: string };
};

export const EVENT_PORTFOLIO: PortfolioEvent[] = [
  {
    id: "financial-rails-asia",
    name: "Financial Rails Asia",
    tagline: "The infrastructure moving Asia's money",
    status: "next",
    statusLabel: "Next Edition",
    dates: "6 October 2026",
    startDateISO: "2026-10-06",
    city: "Singapore",
    country: "Singapore",
    countryCode: "SG",
    to: "/forums/financial-rails-asia",
    image: {
      src: "/media/financial-rails-v2/experience/panel-1280.jpg",
      alt: "A panel of speakers seated on stage in front of a seated audience",
    },
  },
  {
    id: "financial-rails-africa",
    name: "Financial Rails Africa",
    tagline: "The infrastructure moving Africa's money",
    status: "upcoming",
    statusLabel: "Upcoming Edition",
    dates: "14 October 2026",
    startDateISO: "2026-10-14",
    city: "Nairobi",
    country: "Kenya",
    countryCode: "KE",
    to: "/forums/financial-rails-africa",
    image: {
      src: "/media/financial-rails-v2/experience/networking-1280.jpg",
      alt: "Two delegates talking together during a break",
    },
  },
  {
    id: "financial-rails-mena",
    name: "Financial Rails MENA",
    tagline: "The infrastructure of the next financial system",
    status: "featured",
    statusLabel: "Featured Edition",
    dates: "18\u201319 November 2026",
    startDateISO: "2026-11-18",
    city: "Dubai",
    country: "United Arab Emirates",
    countryCode: "AE",
    /* The canonical MENA microsite. The old /forums/financial-rails-mena
       address still resolves, by 301, for links already in the world — but
       nothing internal points at it. */
    to: "/forums/mena",
    image: {
      src: "/media/microsite/closing-frame-1280.jpg",
      alt: "Delegates seated at round tables during a conference session",
    },
  },
];

/* Selectors, so pages read intent rather than array positions. `!` is safe by
   construction: the portfolio always carries exactly one featured and one next
   edition — that is what those statuses mean. */

export const FEATURED_EVENT = EVENT_PORTFOLIO.find((event) => event.status === "featured")!;

export const NEXT_EVENT = EVENT_PORTFOLIO.find((event) => event.status === "next")!;

/** Calendar order, which the array already is. */
export const UPCOMING_EVENTS = EVENT_PORTFOLIO.filter((event) => event.status === "upcoming");
