import { createFileRoute } from "@tanstack/react-router";
import { DubaiSummit } from "@/components/site/DubaiSummit";
import { EVENT } from "@/lib/dubai-summit";
import { ORG_ID, absolute, jsonLd } from "@/lib/structured-data";

/**
 * FINANCIAL RAILS SUMMIT MENA — the canonical microsite. /forums/mena.
 *
 * This is the ONLY MENA microsite. It was developed at the temporary route
 * /forum/dubai-summit, which was never published — no deployment ever served
 * it and no redirect exists for it, because there is nothing to redirect.
 * /forums/financial-rails-mena WAS published, and now permanently redirects
 * here.
 *
 * THE EVENT GRAPH LIVES HERE NOW. It moved from the old route, which no longer
 * renders a page and therefore can no longer be the schema.org authority for
 * this event. It is written out rather than built through the shared
 * eventGraph() helper because this page's claims are its own: a two-day range,
 * the Summit name, and a CITY-LEVEL location only — the venue is shared with
 * confirmed delegates and partners, so no venue is emitted.
 */

const URL = "https://financialrails.org/forums/mena";

const SUMMIT_GRAPH = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Event",
      "@id": `${URL}#event`,
      name: EVENT.name,
      startDate: EVENT.startDateISO,
      endDate: EVENT.endDateISO,
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
        { "@type": "ListItem", position: 3, name: EVENT.name, item: URL },
      ],
    },
  ],
};

export const Route = createFileRoute("/forums/mena")({
  head: () => ({
    meta: [
      { title: "Financial Rails Summit MENA — Dubai, 18–19 November 2026 | Financial Rails" },
      {
        name: "description",
        content:
          "18–19 November 2026, Dubai, UAE. The people who move the Gulf's money — 400 seats, capped, ~220 institutional decision-makers, 370+ pre-scheduled meetings. Vostad's ninth finance edition.",
      },
      {
        property: "og:title",
        content: "Financial Rails Summit MENA — Dubai · 18–19 November 2026",
      },
      {
        property: "og:description",
        content:
          "The people who move the Gulf's money. One room. Two days. 400 seats, capped · ~220 institutional decision-makers · 370+ pre-scheduled meetings.",
      },
      { property: "og:url", content: URL },
      {
        property: "og:image",
        content: "https://financialrails.org/media/microsite/closing-frame-1280.jpg",
      },
    ],
    links: [
      { rel: "canonical", href: URL },
      { rel: "preload", as: "image", href: "/media/financial-rails-v2-hero-poster.jpg" },
    ],
  }),
  component: MenaRoute,
});

function MenaRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(SUMMIT_GRAPH) }}
      />
      <DubaiSummit />
    </>
  );
}
