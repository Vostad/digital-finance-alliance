import { createFileRoute } from "@tanstack/react-router";
import { FinancialRailsSummit } from "@/components/site/FinancialRailsSummit";
import { SUMMIT } from "@/lib/financial-rails-summit";
import { ORG_ID, absolute, jsonLd } from "@/lib/structured-data";

/**
 * Financial Rails Summit — Dubai · 18–19 November 2026. The V4 microsite.
 *
 * The route keeps its /forums/financial-rails-mena address — MENA is the
 * regional identity in the platform's calendar — while the page itself
 * carries the formal event name, Financial Rails Summit.
 *
 * The Event graph is written here rather than through the shared
 * eventGraph() helper because this page's claims are its own: a two-day
 * range, the Summit name, and a CITY-LEVEL location only — the venue is
 * shared with confirmed delegates and partners, so no venue is emitted.
 */

const URL = "https://financialrails.org/forums/financial-rails-mena";

const SUMMIT_GRAPH = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Event",
      "@id": `${URL}#event`,
      name: SUMMIT.name,
      startDate: SUMMIT.startDateISO,
      endDate: SUMMIT.endDateISO,
      eventStatus: "https://schema.org/EventScheduled",
      url: URL,
      description:
        "The people who move the Gulf's money. One room. Two days. 400 seats, capped; ~220 institutional decision-makers; 370+ pre-scheduled meetings.",
      image: absolute("/media/microsite/closing-frame-1280.jpg"),
      location: {
        "@type": "Place",
        name: "Dubai",
        address: { "@type": "PostalAddress", addressLocality: "Dubai", addressCountry: "AE" },
      },
      organizer: { "@id": ORG_ID },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${URL}#breadcrumbs`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://financialrails.org" },
        { "@type": "ListItem", position: 2, name: "Forums", item: absolute("/forums") },
        { "@type": "ListItem", position: 3, name: SUMMIT.name, item: URL },
      ],
    },
  ],
};

export const Route = createFileRoute("/forums/financial-rails-mena")({
  head: () => ({
    meta: [
      { title: "Financial Rails Summit — Dubai, 18–19 November 2026 | Financial Rails" },
      {
        name: "description",
        content:
          "18–19 November 2026, Dubai, UAE. The people who move the Gulf's money — 400 seats, capped, ~220 institutional decision-makers, 370+ pre-scheduled meetings. Vostad's 14th finance event.",
      },
      { property: "og:title", content: "Financial Rails Summit — Dubai · 18–19 November 2026" },
      {
        property: "og:description",
        content:
          "The people who move the Gulf's money. One room. Two days. 400 seats, capped · ~220 institutional decision-makers · 370+ pre-scheduled meetings.",
      },
      { property: "og:url", content: URL },
    ],
    links: [
      { rel: "canonical", href: URL },
      { rel: "preload", as: "image", href: "/media/financial-rails-v2-hero-poster.jpg" },
    ],
  }),
  component: SummitRoute,
});

function SummitRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(SUMMIT_GRAPH) }}
      />
      <FinancialRailsSummit />
    </>
  );
}
