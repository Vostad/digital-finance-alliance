import { createFileRoute } from "@tanstack/react-router";
import { EventMicrosite } from "@/components/site/EventMicrosite";
import { AFRICAN_MONEY_EVENT } from "@/lib/african-money-movement";

/**
 * AFRICAN MONEY MOVEMENT — an edition of the platform's event micro-site.
 * Composition from EventMicrosite, content from the edition's data module,
 * media inherited from the Financial Rails master.
 */

export const Route = createFileRoute("/forums/african-money-movement")({
  head: () => ({
    meta: [
      {
        title: "African Money Movement — The Rails Are Already Moving | Digital Finance Alliance",
      },
      {
        name: "description",
        content:
          "24–25 February 2027, Nairobi. A closed-door gathering of 250 curated decision-makers shaping the infrastructure of the next African money system. Invitation only.",
      },
      { property: "og:title", content: "African Money Movement — Digital Finance Alliance" },
      {
        property: "og:description",
        content:
          "The rails are already moving. The next economy is being built on them. 24–25 February 2027 · Nairobi, Kenya. 250 curated decision-makers. Invitation only.",
      },
    ],
    links: [
      { rel: "canonical", href: "/forums/african-money-movement" },
      { rel: "preload", as: "image", href: "/media/financial-rails-v2-hero-poster.jpg" },
    ],
  }),
  component: () => <EventMicrosite event={AFRICAN_MONEY_EVENT} />,
});
