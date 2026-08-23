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
 * FINANCIAL RAILS AFRICA — 14 October 2026.
 *
 * Content only; every media reference is inherited from the shared library.
 *
 * THE REGIONAL ARGUMENT. Africa reached scale through mobile money rather than
 * through card networks or correspondent banking, which means the continent's
 * domestic rails work and its cross-border ones are the expensive part. This
 * edition runs on that gap: interoperability between national schemes,
 * settlement that does not route through a third currency, and the licensing
 * work that has to happen before either is possible.
 *
 * NO INVENTED PROOF. No named corridor, remittance cost, scheme or institution
 * is claimed. The figures are stated programme targets, in target language.
 */

/**
 * The lockup's fitted size. "Rails Africa" measures 6.94em against the
 * master's 7.23em "Rails Summit", so the master's fitted curve holds.
 */
const HERO_TITLE_CLASS = "text-[clamp(2.2rem,11vw,6rem)] lg:text-[clamp(2.6rem,4.7vw,7.5rem)]";

export const FINANCIAL_RAILS_AFRICA: EventMicrositeData = {
  event: {
    name: "Financial Rails Africa",
    descriptor: "The infrastructure moving Africa's money",
    footerLine: FINANCIAL_RAILS.positioning,
    positioning: "The domestic rails already work. The cross-border ones are the problem.",
    dates: "14 October 2026",
    city: "Nairobi, Kenya",
    capacity: "250 curated decision-makers. Invitation only.",
  },

  heroLabel: "Financial Rails",
  heroTitle: ["Financial", "Rails Africa"],
  heroTitleClass: HERO_TITLE_CLASS,

  nav: FR_NAV,
  heroFilm: FR_HERO_FILM,
  heroImage: FR_HERO_IMAGE,

  why: {
    heading: "Africa moved money differently. The infrastructure has to catch up.",
    couplet: [
      "Mobile money reached scale without waiting for the banking rails.",
      "Instant payments, settlement and cross-border interoperability are the unfinished work.",
    ],
    close: "That is the only reason to be here.",
  },
  whyImage: FR_WHY_IMAGE,

  roomHeading: "250 decision-makers. No spectators.",
  roomFigures: [
    {
      value: "200+",
      line: "C-level executives from banking, mobile money, payments, and technology",
    },
    { value: "40+", line: "Speakers and contributors operating rails across the continent" },
    { value: "20+", line: "Selected partners with real infrastructure to show" },
    { value: "1", line: "Day of closed-door working sessions" },
  ],
  roomImage: FR_ROOM_IMAGE,
  roomFilters: FR_ROOM_FILTERS,
  roomClose:
    "A deliberately limited room for the institutions funding, building, regulating, and operating Africa's financial infrastructure.",

  peopleHeading: "You will be in the room with the people who matter.",
  speakers: FINANCIAL_RAILS_LEADERS,
  partnersStatement: FR_PARTNERS_STATEMENT,

  experienceHeading: "This is not a conference. This is a working room.",
  experience: [
    {
      index: "01",
      title: "Keynotes from the people who move the money",
      body: "The operators of mobile money platforms, instant payment schemes and settlement systems set out what they have built, where it stops at the border, and what it would take to go further.",
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
      title: "Working sessions on the cross-border problem",
      body: "Closed-door sessions on regional interoperability, settlement that does not route through a third currency, remittance economics, and the licensing work that has to come first.",
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
    body: "A closed-door gathering of 250 curated decision-makers shaping the infrastructure of African finance.",
  },
};
