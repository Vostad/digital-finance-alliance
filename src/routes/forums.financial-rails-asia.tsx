import { createFileRoute } from "@tanstack/react-router";
import { EventMicrosite } from "@/components/site/EventMicrosite";
import { FINANCIAL_RAILS_ASIA } from "@/lib/financial-rails-asia";
import { EVENT_PORTFOLIO } from "@/lib/event-portfolio";
import { eventGraph, jsonLd } from "@/lib/structured-data";

/**
 * Financial Rails Asia — an edition of the Financial Rails event micro-site.
 * Composition from EventMicrosite, content from the edition's data module,
 * media inherited from the shared Financial Rails library.
 */

export const Route = createFileRoute("/forums/financial-rails-asia")({
  head: () => ({
    meta: [
      { title: "Financial Rails Asia — The Infrastructure Moving Asia's Money | Financial Rails" },
      {
        name: "description",
        content:
          "6 October 2026, Singapore. A closed-door gathering of 250 curated decision-makers shaping the infrastructure moving Asia's money. Invitation only.",
      },
      { property: "og:title", content: "Financial Rails Asia — Financial Rails" },
      {
        property: "og:description",
        content: "6 October 2026 · Singapore. 250 curated decision-makers. Invitation only.",
      },
      { property: "og:url", content: "https://financialrails.org/forums/financial-rails-asia" },
    ],
    links: [
      { rel: "canonical", href: "https://financialrails.org/forums/financial-rails-asia" },
      { rel: "preload", as: "image", href: "/media/financial-rails-v2-hero-poster.jpg" },
    ],
  }),
  component: EditionRoute,
});

/* The edition's Event + BreadcrumbList graph, rendered into the document
   rather than declared in head(): TanStack emits head scripts through
   <Scripts /> at the end of <body>, and JSON-LD that a crawler must find is
   not worth routing through a mechanism whose placement the page does not
   control. Google reads ld+json anywhere in the document. */
const EDITION = EVENT_PORTFOLIO.find((e) => e.id === "financial-rails-asia")!;

function EditionRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(eventGraph(EDITION)) }}
      />
      <EventMicrosite event={FINANCIAL_RAILS_ASIA} />
    </>
  );
}
