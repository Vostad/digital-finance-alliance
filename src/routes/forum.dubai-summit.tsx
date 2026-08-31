import { createFileRoute } from "@tanstack/react-router";
import { DubaiSummit } from "@/components/site/DubaiSummit";

/**
 * Financial Rails Summit MENA — the NEW Dubai Summit microsite at
 * /forum/dubai-summit. A ground-up implementation, independent of the legacy
 * /forums/financial-rails-mena page.
 *
 * NO EVENT JSON-LD HERE, deliberately: the legacy route already publishes
 * the canonical Event graph for this same event, and two live URLs each
 * claiming schema.org authority over one event is worse than one. When this
 * page replaces the old one, move the Event graph (city-level location only,
 * per the standing ruling — no venue) and a 301 across in the same change.
 */

const URL = "https://financialrails.org/forum/dubai-summit";

export const Route = createFileRoute("/forum/dubai-summit")({
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
  component: DubaiSummit,
});
