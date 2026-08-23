/**
 * THE FINANCIAL RAILS LEADERS — one roster, every surface.
 *
 * The eight leaders, in the order supplied, powering both the homepage
 * network strip and every edition's Previous Speakers grid. One list, so
 * the two surfaces can never disagree: change a leader here and both follow.
 *
 * REAL PEOPLE, VERBATIM. Every name, title and organisation is read straight
 * off the supplied filenames in original-media/digital-asset-accord-leaders —
 * nothing inferred, nothing invented, nothing reordered.
 *
 * Portraits are encoded from those files at their native 4:5 (800×1000), so
 * the portrait frames crop nothing: `-400` and `-800` in AVIF with JPEG
 * fallback. The originals are untouched.
 */

export type Leader = {
  name: string;
  title: string;
  /** Absent where the supplied filename names no organisation. */
  company?: string;
  /** Path stem; `-400`/`-800` and `.avif`/`.jpg` are appended at render. */
  image: string;
};

export const FINANCIAL_RAILS_LEADERS: Leader[] = [
  {
    name: "Dr. Marwan Alzarouni",
    title: "CEO",
    company: "Dubai Blockchain Center",
    image: "/leaders/marwan-alzarouni",
  },
  {
    name: "Dr. Ayesha Bin Lootah",
    title: "Assistant Vice President",
    company: "VARA",
    image: "/leaders/ayesha-bin-lootah",
  },
  {
    name: "Henk J. Hoogendoorn",
    title: "Chief of Financial Services Sector",
    company: "QFC",
    image: "/leaders/henk-hoogendoorn",
  },
  {
    name: "Ibrahim Almheiri",
    title: "CEO",
    company: "Mashreq Al Islami",
    image: "/leaders/ibrahim-almheiri",
  },
  {
    name: "Paul Kayrouz",
    title: "Chief Fintech Officer",
    company: "Central Bank of UAE",
    image: "/leaders/paul-kayrouz",
  },
  {
    name: "Giovanni Miano",
    title: "CTO",
    company: "Zodia Markets",
    image: "/leaders/giovanni-miano",
  },
  {
    /* Supplied filename reads "Daniel Coheur, Co-founder Tokeny and" — it ends
       mid-phrase, so the organisation is recorded as the one it names and the
       dangling conjunction is not guessed at. */
    name: "Daniel Coheur",
    title: "Co-founder",
    company: "Tokeny",
    image: "/leaders/daniel-coheur",
  },
  {
    /* Supplied filename names no organisation, so none is shown. */
    name: "Mario Nawfal",
    title: "Political Commentator",
    image: "/leaders/mario-nawfal",
  },
];
