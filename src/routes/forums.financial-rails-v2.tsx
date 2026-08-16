import { createFileRoute } from "@tanstack/react-router";
import { EventMicrosite } from "@/components/site/EventMicrosite";
import { FINANCIAL_RAILS_EVENT } from "@/lib/financial-rails-v2";

/**
 * FINANCIAL RAILS SUMMIT — the platform's master edition.
 *
 * The composition it was built with now lives in EventMicrosite, so every
 * forum in the platform renders through one file and none of them can drift
 * from this one. This route is the edition: its content is in
 * src/lib/financial-rails-v2.ts and its rendered output is unchanged.
 */

export const Route = createFileRoute("/forums/financial-rails-v2")({
  head: () => ({
    meta: [
      {
        title:
          "Financial Rails Summit — The Infrastructure of the Next Financial System | Digital Finance Alliance",
      },
      {
        name: "description",
        content:
          "4–5 November 2026, Dubai. A closed-door gathering of 250 curated decision-makers shaping the infrastructure of the next financial system. Invitation only.",
      },
      { property: "og:title", content: "Financial Rails Summit — Digital Finance Alliance" },
      {
        property: "og:description",
        content:
          "The institutions building the rails are already moving. 4–5 November 2026 · Dubai, UAE. 250 curated decision-makers. Invitation only.",
      },
    ],
    links: [
      { rel: "canonical", href: "/forums/financial-rails-v2" },
      { rel: "preload", as: "image", href: "/media/financial-rails-v2-hero-poster.jpg" },
    ],
  }),
  component: () => <EventMicrosite event={FINANCIAL_RAILS_EVENT} />,
});
