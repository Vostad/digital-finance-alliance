import { FINANCIAL_RAILS } from "@/lib/financial-rails";
import { EVENT_PORTFOLIO, type PortfolioEvent } from "@/lib/event-portfolio";

/**
 * JSON-LD, in one place.
 *
 * Every graph the site emits is built here so the machine-readable identity
 * cannot drift from page to page. Two rules hold throughout:
 *
 * ONE ORGANIZATION. The Organization node is declared once, in the root
 * document, under a stable @id. Every other node — WebSite, Event,
 * BreadcrumbList — REFERENCES that @id rather than restating the name, logo
 * and slogan. A second full Organization node on an event page is how a site
 * ends up looking like two entities to a crawler.
 *
 * NOTHING UNSUPPORTED. Only fields the site can actually stand behind are
 * emitted. No venue, no offers, no price, no attendance mode, no performer,
 * no sponsor, no aggregate rating, no attendance figures. An event whose
 * street address the site does not publish gets a Place with a locality and a
 * country and nothing else, which is true, rather than a fabricated address,
 * which would be both false and a structured-data violation.
 */

const ORIGIN = FINANCIAL_RAILS.origin;

/** Stable node identities, so references resolve across pages. */
export const ORG_ID = `${ORIGIN}/#organization`;
export const SITE_ID = `${ORIGIN}/#website`;

/** Absolute, because a crawler resolving JSON-LD has no page to resolve against. */
export function absolute(path: string) {
  return path.startsWith("http") ? path : `${ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The root graph: who the institution is, and what this website is. Emitted
 * once, in __root, on every page — which is what makes the @id references on
 * the event pages resolve.
 */
export function rootGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: FINANCIAL_RAILS.name,
        url: ORIGIN,
        slogan: FINANCIAL_RAILS.positioning,
        description: FINANCIAL_RAILS.seoDescription,
        logo: {
          "@type": "ImageObject",
          url: absolute("/favicon-512.png"),
        },
        image: absolute("/og-image.png"),
        parentOrganization: {
          "@type": "Organization",
          name: FINANCIAL_RAILS.operator,
        },
      },
      {
        "@type": "WebSite",
        "@id": SITE_ID,
        url: ORIGIN,
        name: FINANCIAL_RAILS.name,
        description: FINANCIAL_RAILS.seoDescription,
        publisher: { "@id": ORG_ID },
        inLanguage: "en",
      },
    ],
  };
}

/**
 * One edition, as an Event, plus the crumb trail that places it under /forums.
 *
 * `location` carries a locality and a country and stops there: the site does
 * not publish venues, so neither does this. `organizer` points at the
 * Organization node rather than repeating it. `eventStatus` is the one status
 * claim the site genuinely supports — these editions are scheduled.
 */
export function eventGraph(event: PortfolioEvent) {
  const url = absolute(event.to ?? `/forums/${event.id}`);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Event",
        "@id": `${url}#event`,
        name: event.name,
        startDate: event.startDateISO,
        eventStatus: "https://schema.org/EventScheduled",
        url,
        description: event.tagline,
        image: absolute(event.image.src),
        location: {
          "@type": "Place",
          name: event.city,
          address: {
            "@type": "PostalAddress",
            addressLocality: event.city,
            addressCountry: event.countryCode,
          },
        },
        organizer: { "@id": ORG_ID },
        isAccessibleForFree: false,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN },
          { "@type": "ListItem", position: 2, name: "Forums", item: absolute("/forums") },
          { "@type": "ListItem", position: 3, name: event.name, item: url },
        ],
      },
    ],
  };
}

/** The forums directory, as the ItemList a crawler can read the calendar from. */
export function forumsGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${absolute("/forums")}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN },
          { "@type": "ListItem", position: 2, name: "Forums", item: absolute("/forums") },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${absolute("/forums")}#editions`,
        name: "Financial Rails Forums",
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: EVENT_PORTFOLIO.length,
        itemListElement: EVENT_PORTFOLIO.map((event, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: event.name,
          item: absolute(event.to ?? `/forums/${event.id}`),
        })),
      },
    ],
  };
}

/** Serialised for dangerouslySetInnerHTML, with `<` escaped so it cannot break out. */
export function jsonLd(graph: unknown) {
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
