import { createFileRoute } from "@tanstack/react-router";
import { EventMicrosite } from "@/components/site/EventMicrosite";
import { FINANCIAL_RAILS_MENA } from "@/lib/financial-rails-mena";

/**
 * Financial Rails MENA — an edition of the Financial Rails event micro-site.
 * Composition from EventMicrosite, content from the edition's data module,
 * media inherited from the shared Financial Rails library.
 */

export const Route = createFileRoute("/forums/financial-rails-mena")({
  head: () => ({
    meta: [
      {
        title:
          "Financial Rails MENA — The Infrastructure of the Next Financial System | Financial Rails",
      },
      {
        name: "description",
        content:
          "5 November 2026, Dubai, UAE. A closed-door gathering of 250 curated decision-makers shaping the infrastructure of the next financial system. Invitation only.",
      },
      { property: "og:title", content: "Financial Rails MENA — Financial Rails" },
      {
        property: "og:description",
        content: "5 November 2026 · Dubai, UAE. 250 curated decision-makers. Invitation only.",
      },
    ],
    links: [
      { rel: "canonical", href: "https://financialrails.org/forums/financial-rails-mena" },
      { rel: "preload", as: "image", href: "/media/financial-rails-v2-hero-poster.jpg" },
    ],
  }),
  component: () => <EventMicrosite event={FINANCIAL_RAILS_MENA} />,
});
