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
  FR_ROOM_FILTERS,
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
 * The lockup's fitted size. "Rails MENA" is the wide line, and it is shorter
 * than the "Rails Summit" the master was fitted for — so the master's own
 * 4.7vw carries more margin than it needs and holds at every width from
 * 1024 up.
 */
const HERO_TITLE_CLASS = "text-[clamp(2.2rem,11vw,6rem)] lg:text-[clamp(2.6rem,4.7vw,7.5rem)]";

export const FINANCIAL_RAILS_MENA: EventMicrositeData = {
  event: {
    name: "Financial Rails MENA",
    descriptor: FINANCIAL_RAILS.descriptor,
    footerLine: FINANCIAL_RAILS.positioning,
    positioning: "The institutions building the rails are already moving.",
    dates: "5 November 2026",
    city: "Dubai, UAE",
    capacity: "250 curated decision-makers. Invitation only.",
  },

  heroLabel: "Financial Rails",
  heroTitle: ["Financial", "Rails MENA"],
  heroTitleClass: HERO_TITLE_CLASS,

  nav: FR_NAV,
  heroFilm: FR_HERO_FILM,
  heroImage: FR_HERO_IMAGE,

  why: {
    heading: "This is where the next financial system gets built.",
    couplet: ["You won't be told what might happen.", "You'll meet the people making it happen."],
    close: "That is the only reason to be here.",
  },
  whyImage: FR_WHY_IMAGE,

  roomHeading: "250 decision-makers. No spectators.",
  roomFigures: [
    {
      value: "200+",
      line: "C-level executives from banking, payments, markets, and technology",
    },
    { value: "40+", line: "Speakers and contributors already building the rails" },
    { value: "20+", line: "Selected partners with real infrastructure to show" },
    { value: "1", line: "Day of closed-door working sessions" },
  ],
  roomImage: FR_ROOM_IMAGE,
  roomFilters: FR_ROOM_FILTERS,
  roomClose:
    "A deliberately limited room for the institutions funding, building, regulating, and operating the next financial system.",

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
