import type { MicrositePhoto } from "@/lib/microsite-photography";
import type { Leader } from "@/lib/financial-rails-leaders";

/**
 * THE EVENT MICRO-SITE CONTRACT — what an edition of the forum supplies.
 *
 * The platform runs one event page, EventMicrosite, and one edition of it is
 * this object. Everything the template needs that differs between forums lives
 * here; everything that does not — the grid, the type, the spacing, the
 * photography treatment, the reveals, the footer's Explore and Participate
 * columns — stays in the template, because those are the design system and
 * they must not diverge between editions.
 *
 * SHARED MEDIA IS A FEATURE, NOT AN OMISSION. The film, the photography, the
 * speaker roster and the partner marks are deliberately the same objects
 * across all three editions: they are one institutional family, and the
 * archive being shown is the platform's, not any single forum's.
 */
export type EventMicrositeData = {
  /** The edition's own copy of the shared identity block. */
  event: {
    name: string;
    descriptor: string;
    /** The footer's sentence form of the descriptor, punctuation included. */
    footerLine: string;
    positioning: string;
    dates: string;
    city: string;
    capacity: string;
  };

  /** Chapter 01's rail label — the only rail label that names the event. */
  heroLabel: string;
  /** The lockup, exactly two lines, broken where the edition breaks it. */
  heroTitle: [string, string];
  /**
   * The lockup's fitted size. Derived from the widest line's measured em-width
   * against the six-column track, with the master's own headroom — see the
   * note in EventMicrosite. Not a style choice: a fit.
   */
  heroTitleClass: string;

  nav: { label: string; id: string }[];
  heroFilm: { src: string; poster: string };
  heroImage: MicrositePhoto;

  why: { heading: string; couplet: string[]; close: string };
  whyImage: MicrositePhoto;

  roomHeading: string;
  roomFigures: { value: string; line: string }[];
  roomImage: MicrositePhoto;
  roomFilters: string[];
  roomClose: string;

  peopleHeading: string;
  speakers: Leader[];
  partnersStatement: string;

  experienceHeading: string;
  experience: {
    index: string;
    title: string;
    body: string;
    photo: MicrositePhoto | null;
  }[];
  outputIndex: string[];

  invitation: { heading: string; line: string; body: string };
};
