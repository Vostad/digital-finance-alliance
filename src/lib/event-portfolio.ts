/**
 * THE ACTIVE DIGITAL FINANCE ALLIANCE EVENT PORTFOLIO — the single source of
 * truth for the 2026–2027 calendar.
 *
 * This module feeds every portfolio surface — the homepage's Featured / Next /
 * Upcoming sections and the forums directory — so the calendar is edited in
 * exactly one place and can never disagree with itself across pages. It feeds
 * NOTHING inside the event micro-sites: an event page owns its own content in
 * its own data module, exactly as /forums/financial-rails-v2 does.
 *
 * ONE TEMPLATE, THREE FORUMS. Every event here is an edition of the same
 * canonical micro-site (src/components/site/EventMicrosite.tsx) and every one
 * has a page, so every card links. The `to` field stays optional so a future
 * announced-but-unbuilt edition can be listed unlinked rather than pointing at
 * a route that does not exist.
 *
 * Every event is one self-contained object. Changing one event's date touches
 * that object alone; swapping one image cannot reach another event; a status
 * change edits one field. Retiring an event is deleting its object, and the
 * pages that read this list re-derive themselves.
 *
 * The array is kept in CALENDAR ORDER where dates exist (the undated summit
 * leads as the announced next event). Presentation order is a page decision —
 * the homepage deliberately leads with the featured flagship, not the next
 * date — so pages select by status rather than by position.
 */

export type EventStatus = "featured" | "next" | "upcoming";

export type PortfolioEvent = {
  id: string;
  /** Rendered through uppercase display type everywhere it appears. */
  name: string;
  tagline: string;
  status: EventStatus;
  /** The chip a card carries — "Featured Event", "Next Event", "Upcoming Event". */
  statusLabel: string;
  dates: string;
  city: string;
  country: string;
  /**
   * The event's own micro-site, when one has been built on the canonical
   * template. Absent while an announced event has no page yet — the directory
   * then renders the card unlinked rather than pointing at a dead route.
   */
  to?: string;
  image: { src: string; alt: string };
};

export const EVENT_PORTFOLIO: PortfolioEvent[] = [
  {
    /**
     * The three editions of the platform, in calendar order. Each is a built
     * page on the canonical event template, so each carries a `to`. The
     * earlier speculative entries — Stablecoins, Digital Market
     * Infrastructure, Institutional Digital Assets, Tokenized Economy,
     * Programmable Finance — are retired: the Forums ecosystem is these three.
     *
     * Every field is read from that edition's own data module, so the
     * directory and the page cannot disagree. Frames come from the shared
     * photography the editions themselves use.
     */
    id: "india-digital-payments",
    name: "India Digital Payments & Fintech",
    tagline: "The payments and fintech infrastructure powering India's digital economy",
    status: "next",
    statusLabel: "Next Event",
    dates: "12–13 January 2027",
    city: "Mumbai",
    country: "India",
    to: "/forums/india-digital-payments",
    image: {
      src: "/media/financial-rails-v2/experience/panel-1280.jpg",
      alt: "A panel of speakers seated on stage in front of a seated audience",
    },
  },
  {
    id: "african-money-movement",
    name: "African Money Movement",
    tagline: "The rails are already moving",
    status: "upcoming",
    statusLabel: "Upcoming Event",
    dates: "24–25 February 2027",
    city: "Nairobi",
    country: "Kenya",
    to: "/forums/african-money-movement",
    image: {
      src: "/media/financial-rails-v2/experience/networking-1280.jpg",
      alt: "Two delegates talking together during a break",
    },
  },
  {
    id: "financial-rails",
    name: "Financial Rails Summit",
    tagline: "The infrastructure of the next financial system",
    status: "featured",
    statusLabel: "Featured Event",
    dates: "4–5 November 2026",
    city: "Dubai",
    country: "United Arab Emirates",
    to: "/forums/financial-rails-v2",
    image: {
      src: "/media/microsite/closing-frame-1280.jpg",
      alt: "Delegates seated at round tables during a conference session",
    },
  },
];

/* Selectors, so pages read intent rather than array positions. `!` is safe by
   construction: the portfolio always carries exactly one featured and one next
   event — that is what those statuses mean. */

export const FEATURED_EVENT = EVENT_PORTFOLIO.find((event) => event.status === "featured")!;

export const NEXT_EVENT = EVENT_PORTFOLIO.find((event) => event.status === "next")!;

/** Calendar order, which the array already is. */
export const UPCOMING_EVENTS = EVENT_PORTFOLIO.filter((event) => event.status === "upcoming");
