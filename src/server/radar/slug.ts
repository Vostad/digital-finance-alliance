/**
 * SLUGS — the URL is the identity.
 *
 * A corridor's slug is how every inbound link, every search result and every
 * citation reaches it. Regenerating one for a corridor that already exists
 * breaks all of them at once, so `corridorSlug` is called when a corridor is
 * CREATED and never again. The admin surface treats it as immutable.
 *
 * Pure functions, no database, no imports. Kept separate so both the admin
 * writer and the sitemap generator agree on the shape without either importing
 * the other.
 */

/** Lowercase, ASCII, hyphenated. Nothing that needs percent-encoding. */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** `us-to-brazil`. Country names, not codes — the slug is read by people and
    matched against how they actually search. */
export function corridorSlug(originCountry: string, destinationCountry: string): string {
  return `${slugify(originCountry)}-to-${slugify(destinationCountry)}`;
}

/** The human title, used in <title>, <h1> and the JSON-LD name. */
export function corridorTitle(
  origin: { country: string; currency: string },
  destination: { country: string; currency: string },
): string {
  return `${origin.country} (${origin.currency}) → ${destination.country} (${destination.currency})`;
}
