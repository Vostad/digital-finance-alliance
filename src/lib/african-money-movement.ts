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
 * AFRICAN MONEY MOVEMENT — an edition of the platform's event micro-site.
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
 * The lockup's fitted size. "Money Movement" is the wide line at a measured
 * 9.80em against the master's 7.23em, so the master's 4.7vw would overflow the
 * six-column track; 3.4vw carries the same 8% of margin at 1024, which is
 * where the track is tightest. Same rule, same headroom, different string.
 */
const HERO_TITLE_CLASS = "text-[clamp(1.6rem,8vw,4.4rem)] lg:text-[clamp(1.7rem,3.4vw,5.5rem)]";

export const AFRICAN_MONEY_EVENT: EventMicrositeData = {
  event: {
    name: "African Money Movement",
    descriptor: "The rails are already moving",
    /* Not supplied for this edition; the platform's own line is reused. */
    footerLine: V2_EVENT.footerLine,
    positioning: "The rails are already moving. The next economy is being built on them.",
    dates: "24–25 February 2027",
    city: "Nairobi, Kenya",
    capacity: "250 curated decision-makers. Invitation only.",
  },

  heroLabel: "African Money",
  heroTitle: ["African", "Money Movement"],
  heroTitleClass: HERO_TITLE_CLASS,

  nav: V2_NAV,
  heroFilm: V2_HERO_FILM,
  heroImage: V2_HERO_IMAGE,

  why: {
    heading: "This is where the next African money system gets built.",
    couplet: ["You won't be told what might happen.", "You'll meet the people making it happen."],
    close: "That is the only reason to be here.",
  },
  whyImage: V2_WHY_IMAGE,

  roomHeading: "250 decision-makers. No spectators.",
  roomFigures: [
    {
      value: "200+",
      line: "C-level executives from banking, payments, mobile money, and technology",
    },
    { value: "40+", line: "Speakers and contributors already building the rails" },
    { value: "20+", line: "Selected partners with real infrastructure to show" },
    { value: "2", line: "Days of closed-door working sessions" },
  ],
  roomImage: V2_ROOM_IMAGE,
  roomFilters: ["No mass audience.", "No exhibition floor.", "No press."],
  roomClose:
    "A deliberately limited room for the institutions funding, building, regulating, and operating the next African money system.",

  peopleHeading: "You will be in the room with the people who matter.",
  speakers: DIGITAL_ASSET_ACCORD_LEADERS,
  partnersStatement: "The institutions below have already shaped this conversation.",

  experienceHeading: "This is not a conference. This is a working room.",
  experience: [
    {
      index: "01",
      title: "Keynotes from people who move money",
      body: "The leaders running the biggest payment networks, mobile money platforms, and settlement systems share what they are building—and what they need from the room.",
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
      title: "The African Money Agenda",
      body: "Leave with the annual institutional agenda capturing what is ready to scale, what remains unresolved, and what to build next.",
      photo: V2_EXPERIENCE_FRAMES.agenda,
    },
  ],
  outputIndex: ["Money", "Markets", "Infrastructure", "Rules"],

  invitation: {
    heading: "The rails are being built now.",
    line: "Be in the room where they are defined.",
    body: "A closed-door gathering of 250 curated decision-makers shaping the infrastructure of the next African money system.",
  },
};
