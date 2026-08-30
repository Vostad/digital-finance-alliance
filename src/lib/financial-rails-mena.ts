import { FINANCIAL_RAILS_LEADERS } from "@/lib/financial-rails-leaders";
import type { EventMicrositeData } from "@/lib/event-microsite";
import {
  FINANCIAL_RAILS,
  FINANCIAL_RAILS_AGENDA,
  FR_NAV,
  FR_HERO_FILM,
  FR_HERO_IMAGE,
  FR_WHY_IMAGE,
  FR_ROOM_IMAGE,
  FR_PARTNERS_STATEMENT,
  FR_EXPERIENCE_FRAMES,
} from "@/lib/financial-rails";

/**
 * FINANCIAL RAILS MENA — the flagship edition, 5 November 2026.
 *
 * This is the edition the platform's own template was built from, so its copy
 * is the reference every other edition is written against. Content only: the
 * film, the photography, the roster and the partner marks come from the shared
 * library, because the archive belongs to the institution, not to one city.
 *
 * THE DATE. Earlier material carried "4–5 November 2026" for a two-day shape.
 * The edition is a single day, 5 November 2026, and that is the only date this
 * platform states anywhere. The room's fourth figure follows it: one day of
 * working sessions, not two.
 *
 * NOTHING HERE IS INVENTED. The figures are the platform's stated programme
 * targets and are written as targets, not as confirmed registrations.
 */

/**
 * The lockup's fitted size, unchanged. "Rails Summit" is the wide line and it
 * is the exact line the master's 4.7vw was measured against — 7.23em on the
 * six-column track, tightest at 376px on a 1024 viewport, where it leaves 8%
 * of margin. Nothing here needed refitting.
 */
const HERO_TITLE_CLASS = "text-[clamp(2.2rem,11vw,6rem)] lg:text-[clamp(2.6rem,4.7vw,7.5rem)]";

export const FINANCIAL_RAILS_MENA: EventMicrositeData = {
  event: {
    name: "Financial Rails MENA",
    descriptor: FINANCIAL_RAILS.descriptor,
    footerLine: FINANCIAL_RAILS.positioning,
    positioning: "The people who move the Gulf's money. One room. Two days.",
    dates: "18\u201319 November 2026",
    city: "Dubai, UAE",
    capacity: "250 curated decision-makers. Invitation only.",
  },

  heroLabel: "Financial Rails",
  heroTitle: ["Financial", "Rails Summit"],
  heroTitleClass: HERO_TITLE_CLASS,
  heroActions: [{ label: "Request the Prospectus" }, { label: "Apply to Attend" }],
  heroNote: "Vostad's 14th finance event. The first Financial Rails.",

  nav: FR_NAV,
  heroFilm: FR_HERO_FILM,
  heroImage: FR_HERO_IMAGE,

  /**
   * Chapter 02, stated as the market rather than as the room. The rail reads
   * "The Gap" — the site's rail labels are title-case noun phrases ("The
   * Room", "The Platform"), so the article form fits the system where a bare
   * "Market" would not. `couplet` and `close` stay populated because the type
   * requires them; `stats` and `closeLines` are what render.
   */
  why: {
    label: "The Gap",
    heading: "$58 billion leaves the UAE every year. The people moving it have nowhere to meet.",
    headingLines: [
      "$58 billion leaves the UAE every year.",
      "The people moving it have nowhere to meet.",
    ],
    couplet: [],
    close:
      "A market this important deserves a room built for the people making the decisions \u2014 not the crowd.",
    stats: [
      { value: "$58B", label: "Outbound remittances" },
      {
        value: "40%",
        label: "Growth in the UAE's licensed payment-institution register, sixteen months",
      },
      { value: "61", label: "Licensed banks" },
    ],
    omitCta: true,
  },
  whyImage: FR_WHY_IMAGE,

  /* This edition's chapter-03 fits. The heading is a three-clause sentence
     rather than the master's short one, so it takes a wider measure and a
     smaller size — five lines at the master's scale, three at this one. The
     figures stay the heroes, so the heading is set well beneath them, and the
     refusals come down far enough that each holds one line at every width:
     "No passive delegation." is the long one, and its binding case is lg,
     where the column is 326px after the rule's pl-12 — not the 534px it gets
     at 1440. 2.3vw clears it there with margin. */
  roomType: {
    heading:
      "font-display max-w-[30ch] text-[clamp(1.6rem,2.9vw,2.75rem)] font-extrabold uppercase leading-[0.92] tracking-[-0.028em]",
    figureLine: "text-base leading-relaxed xl:text-lg",
    filters:
      "font-display text-[clamp(1.25rem,2.3vw,2.35rem)] font-extrabold uppercase leading-[1.02] tracking-[-0.028em]",
  },
  roomHeading: "400 seats. ~220 institutional decision-makers. 370+ pre-scheduled meetings.",
  roomFigures: [
    { value: "14", line: "Vostad finance events since 2018" },
    { value: "400", line: "Seats, capped" },
    { value: "~220", line: "Institutional decision-makers" },
    { value: "370+", line: "Pre-scheduled meetings" },
  ],
  roomImage: FR_ROOM_IMAGE,
  /* This edition states its own refusals rather than the shared three: the
     filter here is about how a seat is earned, not about what the room lacks. */
  roomFilters: ["No mass audience.", "No passive delegation.", "No random access."],
  roomClose:
    "A deliberately limited room for the institutions funding, building, regulating and operating the next financial system.",

  peopleHeading: "You will be in the room with the people who matter.",
  speakers: FINANCIAL_RAILS_LEADERS,
  partnersStatement: FR_PARTNERS_STATEMENT,

  experienceHeading: "This is not a conference. This is a working room.",
  experience: [
    {
      index: "01",
      title: "Keynotes from people who move money",
      body: "The leaders running the region's payment networks, settlement systems and tokenization platforms share what they are building—and what they need from the room.",
      photo: FR_EXPERIENCE_FRAMES.keynote,
    },
    {
      index: "02",
      title: "Private 1:1 meetings",
      body: "Pre-arranged meetings built around your strategic priorities. The right person in the right conversation. No wasted time.",
      photo: FR_EXPERIENCE_FRAMES.networking,
    },
    {
      index: "03",
      title: "Panels that talk about solutions",
      body: "No theory. No slideware. Closed-door sessions where operators and regulators break down what is working, what is broken, and what must change next.",
      photo: FR_EXPERIENCE_FRAMES.panel,
    },
    {
      index: "04",
      title: "The Financial Rails Agenda",
      body: "Leave with the annual institutional agenda capturing what is ready to scale, what remains unresolved, and what to build next.",
      photo: FR_EXPERIENCE_FRAMES.agenda,
    },
  ],
  outputIndex: FINANCIAL_RAILS_AGENDA,

  invitation: {
    heading: "The rails are being built now.",
    line: "Be in the room where they are defined.",
    body: "A closed-door gathering of 250 curated decision-makers shaping the infrastructure of the next financial system.",
  },
};
