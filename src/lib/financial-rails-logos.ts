/**
 * THE FINANCIAL RAILS NETWORK — the single source of logo truth.
 *
 * Eighty real historical marks, copied verbatim from
 * original-media/digital-asset-accord-logos into /public/network-logos —
 * uniform 400×200 transparent PNGs, dark artwork drawn for light stock,
 * ~11 KB each. This one list powers every network surface (the homepage
 * network section and every edition's partner proof), so adding,
 * replacing or retiring a mark is a one-line change here and every page
 * follows.
 *
 * The source files are numbered, not named, so no organisation names exist to
 * put in alt text — and none may be invented. The marks therefore render as
 * decorative proof (empty alt) beneath headings that carry the claim.
 */
export const FINANCIAL_RAILS_LOGOS: string[] = Array.from(
  { length: 80 },
  (_, i) => `/network-logos/${i + 1}.png`,
);

/**
 * THE FEATURED SET — 32 of the 80, curated by sector.
 *
 * The homepage network marquee and Financial Rails V2's partner proof both
 * run this subset; the /partners archive keeps the full eighty. Indices refer
 * to the master list above, so nothing is redefined here — retire a mark in
 * one place and every surface follows.
 *
 * Chosen for the digital-finance and financial-rails ecosystem, and read off
 * the artwork rather than guessed: banks, payment networks, market
 * infrastructure, regulators and authorities, exchanges, custody and digital
 * asset infrastructure. Media, NGOs, consultancies and general technology
 * marks in the master set are deliberately left to the full archive.
 *
 * Ordered so the two rows interleave sectors rather than clustering them, and
 * de-duplicated: the master set carries the same al rajhi mark at 27 and 38,
 * so only 27 appears here.
 */
const FINANCIAL_RAILS_FEATURED_INDICES = [
  // banks
  1, 22, 14, 15, 16, 17, 27, 29, 73, 21,
  // payment networks and payments fintech
  4, 18, 6,
  // market infrastructure and institutional finance
  47, 20, 48, 75,
  // regulators and authorities
  2, 5, 8, 9, 10,
  // exchanges
  52, 26, 25,
  // custody, settlement and market infrastructure
  33, 58, 59, 31, 19, 69, 7,
];

export const FINANCIAL_RAILS_FEATURED_LOGOS: string[] = FINANCIAL_RAILS_FEATURED_INDICES.map(
  (n) => `/network-logos-trimmed/${n}.png`,
);
