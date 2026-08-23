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
 * FINANCIAL RAILS ASIA — 6 October 2026.
 *
 * Content only; every media reference is inherited from the shared library.
 *
 * THE REGIONAL ARGUMENT. Asia is the one region where instant retail payment
 * systems reached national scale before the tokenization debate began, so the
 * questions here are not whether the rails work but what gets built on top of
 * them and how they join up across borders. That is the axis this edition runs
 * on, and it is why the room is weighted toward operators of live systems
 * rather than toward issuers.
 *
 * NO INVENTED PROOF. No named market, volume, corridor or institution is
 * claimed. The figures are stated programme targets, in target language.
 */

/**
 * The lockup's fitted size. "Rails Asia" is the wide line at a measured
 * 6.05em — narrower than the master's "Rails Summit" at 7.23em — so the
 * master's curve holds with margin to spare at every width.
 */
const HERO_TITLE_CLASS = "text-[clamp(2.2rem,11vw,6rem)] lg:text-[clamp(2.6rem,4.7vw,7.5rem)]";

export const FINANCIAL_RAILS_ASIA: EventMicrositeData = {
  event: {
    name: "Financial Rails Asia",
    descriptor: "The infrastructure moving Asia's money",
    footerLine: FINANCIAL_RAILS.positioning,
    positioning: "Asia already runs the rails. The question is what gets built on them.",
    dates: "6 October 2026",
    city: "Singapore",
    capacity: "250 curated decision-makers. Invitation only.",
  },

  heroLabel: "Financial Rails",
  heroTitle: ["Financial", "Rails Asia"],
  heroTitleClass: HERO_TITLE_CLASS,

  nav: FR_NAV,
  heroFilm: FR_HERO_FILM,
  heroImage: FR_HERO_IMAGE,

  why: {
    heading: "Asia built the rails first. Now it decides what runs on them.",
    couplet: [
      "Instant payments are already infrastructure here.",
      "Tokenized money, cross-border settlement and digital banking are what comes next.",
    ],
    close: "That is the only reason to be here.",
  },
  whyImage: FR_WHY_IMAGE,

  roomHeading: "250 decision-makers. No spectators.",
  roomFigures: [
    {
      value: "200+",
      line: "C-level executives from banking, payments, market infrastructure, and technology",
    },
    { value: "40+", line: "Speakers and contributors operating live systems at national scale" },
    { value: "20+", line: "Selected partners with real infrastructure to show" },
    { value: "1", line: "Day of closed-door working sessions" },
  ],
  roomImage: FR_ROOM_IMAGE,
  roomFilters: FR_ROOM_FILTERS,
  roomClose:
    "A deliberately limited room for the institutions funding, building, regulating, and operating Asia's financial infrastructure.",

  peopleHeading: "You will be in the room with the people who matter.",
  speakers: FINANCIAL_RAILS_LEADERS,
  partnersStatement: FR_PARTNERS_STATEMENT,

  experienceHeading: "This is not a conference. This is a working room.",
  experience: [
    {
      index: "01",
      title: "Keynotes from the operators of live systems",
      body: "The people running real-time payment schemes, settlement infrastructure and digital banks set out what they have built, what it cost, and what still does not join up across borders.",
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
      title: "Working sessions on interoperability",
      body: "Closed-door sessions on the unresolved problems: linking domestic instant-payment schemes, settling cross-border in tokenized money, and reconciling supervisory regimes that were written separately.",
      photo: FR_EXPERIENCE_FRAMES.panel,
    },
    {
      index: "04",
      title: "The Financial Rails Agenda",
      body: "Leave with the institutional agenda for the region: what is ready to scale, what remains unresolved, and what to build next.",
      photo: FR_EXPERIENCE_FRAMES.agenda,
    },
  ],
  outputIndex: FINANCIAL_RAILS_AGENDA,

  invitation: {
    heading: "The rails are being built now.",
    line: "Be in the room where they are defined.",
    body: "A closed-door gathering of 250 curated decision-makers shaping the infrastructure of Asian finance.",
  },
};
