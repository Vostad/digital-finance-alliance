import { createFileRoute } from "@tanstack/react-router";
import { EventMicrosite } from "@/components/site/EventMicrosite";
import { INDIA_DIGITAL_EVENT } from "@/lib/india-digital-payments";

/**
 * INDIA DIGITAL PAYMENTS & FINTECH — an edition of the platform's event
 * micro-site. Composition from EventMicrosite, content from the edition's data
 * module, media inherited from the Financial Rails master.
 */

export const Route = createFileRoute("/forums/india-digital-payments")({
  head: () => ({
    meta: [
      {
        title:
          "India Digital Payments & Fintech — Powering India's Digital Economy | Digital Finance Alliance",
      },
      {
        name: "description",
        content:
          "12–13 January 2027, Mumbai. A closed-door gathering of 250 curated decision-makers shaping the infrastructure of India's next digital financial system. Invitation only.",
      },
      {
        property: "og:title",
        content: "India Digital Payments & Fintech — Digital Finance Alliance",
      },
      {
        property: "og:description",
        content:
          "The payments and fintech infrastructure powering the next phase of India's digital economy. 12–13 January 2027 · Mumbai, India. Invitation only.",
      },
    ],
    links: [
      { rel: "canonical", href: "/forums/india-digital-payments" },
      { rel: "preload", as: "image", href: "/media/financial-rails-v2-hero-poster.jpg" },
    ],
  }),
  component: () => <EventMicrosite event={INDIA_DIGITAL_EVENT} />,
});
