import { DIGITAL_ASSET_ACCORD_LEADERS } from "@/lib/digital-asset-accord-leaders";
import type { EventMicrositeData } from "@/lib/event-microsite";
import {
  V2_NAV,
  V2_HERO_FILM,
  V2_HERO_IMAGE,
  V2_WHY_IMAGE,
  V2_ROOM_IMAGE,
  V2_EXPERIENCE_FRAMES,
  V2_EVENT,
} from "@/lib/financial-rails-v2";

/**
 * INDIA DIGITAL PAYMENTS & FINTECH — an edition of the platform's event micro-site.
 *
 * Content only. Every media reference — the hero film, the hero photograph,
 * the spread's portrait, the room's frame, the four Experience frames, the
 * speaker roster and the partner marks — is imported from the Financial Rails
 * master rather than duplicated or replaced, because the three forums are one
 * institutional family showing one shared archive.
 *
 * The copy below is the supplied editorial content, verbatim. Where the
 * template needs a string the brief did not supply — the footer's descriptor
 * line — the master's own line is reused rather than invented.
 */

/**
 * The lockup's fitted size. "Digital Payments & Fintech" measures 15.15em —
 * 2.1× the master's "Rails Summit" at 7.23em — so forcing it onto a single
 * line drove the type to 31.7px, below the 37.4px of the statement beneath it,
 * which inverted the master's hierarchy: the event's own name read smaller
 * than its strapline.
 *
 * The long line is therefore allowed to wrap, which makes the binding
 * measurement "DIGITAL PAYMENTS &" at 10.57em rather than the whole string.
 * Fitted to that with the master's 8% of margin at 1024, the lockup returns to
 * 46px at 1440 — comfortably dominant again. The supplied copy and its
 * specified break are unchanged; only the second line runs onto two rows, as
 * long lines do.
 */
const HERO_TITLE_CLASS = "text-[clamp(1.5rem,7.4vw,4.1rem)] lg:text-[clamp(1.55rem,3.2vw,5.1rem)]";

export const INDIA_DIGITAL_EVENT: EventMicrositeData = {
  event: {
    name: "India Digital Payments & Fintech",
    descriptor: "Powering India's digital economy",
    /* Not supplied for this edition; the platform's own line is reused. */
    footerLine: V2_EVENT.footerLine,
    positioning:
      "The payments and fintech infrastructure powering the next phase of India's digital economy.",
    dates: "12–13 January 2027",
    city: "Mumbai, India",
    capacity: "250 curated decision-makers. Invitation only.",
  },

  heroLabel: "India Digital",
  heroTitle: ["India", "Digital Payments & Fintech"],
  heroTitleClass: HERO_TITLE_CLASS,

  nav: V2_NAV,
  heroFilm: V2_HERO_FILM,
  heroImage: V2_HERO_IMAGE,

  why: {
    heading: "This is where India's next financial system gets built.",
    couplet: ["You won't be told what might happen.", "You'll meet the people making it happen."],
    close: "That is the only reason to be here.",
  },
  whyImage: V2_WHY_IMAGE,

  roomHeading: "250 decision-makers. No spectators.",
  roomFigures: [
    {
      value: "200+",
      line: "C-level executives from banking, payments, fintech, and technology",
    },
    {
      value: "40+",
      line: "Speakers and contributors building India's digital infrastructure",
    },
    { value: "20+", line: "Selected partners with real infrastructure to show" },
    { value: "2", line: "Days of closed-door working sessions" },
  ],
  roomImage: V2_ROOM_IMAGE,
  roomFilters: ["No mass audience.", "No exhibition floor.", "No press."],
  roomClose:
    "A deliberately limited room for the institutions funding, building, regulating, and operating India's next digital financial system.",

  peopleHeading: "You will be in the room with the people who matter.",
  speakers: DIGITAL_ASSET_ACCORD_LEADERS,
  partnersStatement: "The institutions below have already shaped this conversation.",

  experienceHeading: "This is not a conference. This is a working room.",
  experience: [
    {
      index: "01",
      title: "Keynotes from people who move money",
      body: "The leaders running the biggest payment networks, fintech platforms, and digital public infrastructure leaders share what they are building—and what they need from the room.",
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
      title: "The India Digital Agenda",
      body: "Leave with the annual institutional agenda capturing what is ready to scale, what remains unresolved, and what to build next.",
      photo: V2_EXPERIENCE_FRAMES.agenda,
    },
  ],
  outputIndex: ["Money", "Payments", "Infrastructure", "Rules"],

  invitation: {
    heading: "The rails are being built now.",
    line: "Be in the room where they are defined.",
    body: "A closed-door gathering of 250 curated decision-makers shaping the infrastructure of India's next digital financial system.",
  },
};
