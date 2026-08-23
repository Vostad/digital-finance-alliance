import { createFileRoute } from "@tanstack/react-router";
import { EventMicrosite } from "@/components/site/EventMicrosite";
import { FINANCIAL_RAILS_ASIA } from "@/lib/financial-rails-asia";

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
    ],
    links: [
      { rel: "canonical", href: "https://financialrails.org/forums/financial-rails-asia" },
      { rel: "preload", as: "image", href: "/media/financial-rails-v2-hero-poster.jpg" },
    ],
  }),
  component: () => <EventMicrosite event={FINANCIAL_RAILS_ASIA} />,
});
