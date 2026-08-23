import { createFileRoute } from "@tanstack/react-router";
import { EventMicrosite } from "@/components/site/EventMicrosite";
import { FINANCIAL_RAILS_AFRICA } from "@/lib/financial-rails-africa";

/**
 * Financial Rails Africa — an edition of the Financial Rails event micro-site.
 * Composition from EventMicrosite, content from the edition's data module,
 * media inherited from the shared Financial Rails library.
 */

export const Route = createFileRoute("/forums/financial-rails-africa")({
  head: () => ({
    meta: [
      {
        title:
          "Financial Rails Africa — The Infrastructure Moving Africa's Money | Financial Rails",
      },
      {
        name: "description",
        content:
          "14 October 2026, Nairobi, Kenya. A closed-door gathering of 250 curated decision-makers shaping the infrastructure moving Africa's money. Invitation only.",
      },
      { property: "og:title", content: "Financial Rails Africa — Financial Rails" },
      {
        property: "og:description",
        content: "14 October 2026 · Nairobi, Kenya. 250 curated decision-makers. Invitation only.",
      },
    ],
    links: [
      { rel: "canonical", href: "https://financialrails.org/forums/financial-rails-africa" },
      { rel: "preload", as: "image", href: "/media/financial-rails-v2-hero-poster.jpg" },
    ],
  }),
  component: () => <EventMicrosite event={FINANCIAL_RAILS_AFRICA} />,
});
