/**
 * AI ACCORD COLOUR SYSTEM — the palette switch.
 *
 * The whole site renders from one of two named palettes. The active one is
 * written to <html data-accord-palette="…"> in src/routes/__root.tsx, and every
 * colour decision resolves from CSS tokens in src/styles.css.
 *
 *   AI_ACCORD_ORIGINAL           The shipping black / white / bone system.
 *   AI_ACCORD_ORANGE_EXPERIMENT  The #D8663A signature-orange experiment.
 *
 * TO REVERT: change ACTIVE_PALETTE below to AI_ACCORD_ORIGINAL. Nothing else.
 *
 * The original palette is preserved exactly, not approximated. In that palette
 * the `.accord-*` hook classes used in the markup carry NO rules at all — they
 * are inert marker classes — so every opacity, tone and hover state renders
 * precisely as originally authored.
 */

export const ACCORD_PALETTES = {
  AI_ACCORD_ORIGINAL: "original",
  AI_ACCORD_ORANGE_EXPERIMENT: "orange-experiment",
} as const;

export type AccordPalette = (typeof ACCORD_PALETTES)[keyof typeof ACCORD_PALETTES];

/** ▼ THE SWITCH ▼ */
export const ACTIVE_PALETTE: AccordPalette = ACCORD_PALETTES.AI_ACCORD_ORANGE_EXPERIMENT;
