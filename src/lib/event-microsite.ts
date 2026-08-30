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
  /**
   * The hero's doors. OPTIONAL, and the default is the shared one — omit it
   * and the hero renders the single "Request an Invitation" button it has
   * always rendered, unchanged. An edition that runs a different admission
   * process states its own doors here rather than forcing the shared
   * component to know about editions.
   */
  heroActions?: { label: string; to?: string }[];
  /**
   * A single line of provenance under the hero's doors. OPTIONAL; omit it and
   * nothing renders, which is what every edition did before one needed it.
   */
  heroNote?: string;

  nav: { label: string; id: string }[];
  heroFilm: { src: string; poster: string };
  heroImage: MicrositePhoto;

  /**
   * Chapter 02. `couplet` and `close` are the original shape and remain the
   * default; the three optional fields below let one edition state the
   * chapter as a market argument instead of a room argument WITHOUT changing
   * what any other edition renders. Omit them all and the chapter is exactly
   * what it has always been.
   */
  why: {
    heading: string;
    couplet: string[];
    close: string;
    /** Rail label override. Defaults to "Why Be in the Room". */
    label?: string;
    /**
     * The heading set as authored sentences rather than one run of type. The
     * second and later lines carry the turn, and are set back so the first
     * lands first. Falls back to `heading` when absent.
     */
    headingLines?: string[];
    /** Figures in place of the couplet, in the site's own figure/caption pair. */
    stats?: { value: string; label: string }[];
    /** A close set as separate lines rather than one sentence. */
    closeLines?: string[];
    /** Drops the chapter's partner door — for an edition that converts later. */
    omitCta?: boolean;
  };
  whyImage: MicrositePhoto;

  /**
   * Chapter 03's fits, when an edition's copy needs different ones. Same
   * principle as `heroTitleClass`: not a style choice, a fit. The defaults
   * are the master's, and an edition that omits this renders exactly what it
   * always rendered. Supply a COMPLETE class string — these replace, they do
   * not merge.
   */
  roomType?: {
    /** The chapter heading. Default: `display-lg max-w-[20ch]`. */
    heading?: string;
    /** A figure's caption. Default: `text-sm`. */
    figureLine?: string;
    /** One refusal in the filter stack. Default: `display-lg`. */
    filters?: string;
  };
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
