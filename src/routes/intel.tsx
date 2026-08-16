import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Section } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { Arrow } from "@/components/site/primitives";

export const Route = createFileRoute("/intel")({
  head: () => ({
    meta: [
      { title: "Digital Assets Intel — What Matters Before It Becomes Obvious" },
      {
        name: "description",
        content:
          "Perspectives, analysis and ideas on the forces reshaping digital assets, from tokenization and payments to custody, regulation and market infrastructure.",
      },
      { property: "og:title", content: "Digital Assets Intel" },
      {
        property: "og:description",
        content:
          "What matters before it becomes obvious. The editorial desk of Digital Finance Alliance.",
      },
    ],
  }),
  component: Intel,
});

/* ------------------------------------------------------------------ data -- */

/** The five editorial lenses. `all` is the default reading state. */
const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "tokenization", label: "Tokenization" },
  { id: "stablecoins", label: "Stablecoins" },
  { id: "custody", label: "Custody" },
  { id: "regulation", label: "Regulation" },
  { id: "infrastructure", label: "Infrastructure" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

/** What each lens watches — the editorial index. */
const LENSES = [
  {
    name: "Infrastructure",
    body: "Exchanges, custody, settlement and the systems behind digital markets.",
  },
  {
    name: "Tokenization",
    body: "Real-world assets, funds, bonds and securities moving on-chain.",
  },
  {
    name: "Payments",
    body: "Stablecoins, digital money, cross-border settlement and treasury.",
  },
  {
    name: "Regulation",
    body: "Rules, licensing, supervision and the policy decisions shaping adoption.",
  },
  {
    name: "Capital",
    body: "Investment, allocation and the economics of the digital asset buildout.",
  },
];

type Story = {
  category: Exclude<CategoryId, "all">;
  categoryLabel: string;
  title: string;
  dek: string;
  /** Set when the article page exists. Until then the story carries its
      metadata line and no dead link — never a fake destination. */
  to?: string;
};

/** The lead story. Editorial perspective — no fabricated research, data,
    contributors or statistics. */
const FEATURED: Story = {
  category: "tokenization",
  categoryLabel: "Tokenization",
  title: "Tokenization is no longer a future problem.",
  dek: "Real-world assets are moving on-chain. Institutional adoption — not speculation — is emerging as the defining force of the digital asset buildout.",
};

/** The opening slate — six perspectives, one per lens plus depth where the
    thesis is strongest. Quality over volume. */
const STORIES: Story[] = [
  {
    category: "tokenization",
    categoryLabel: "Tokenization",
    title: "Tokenized funds are becoming a product, not a pilot.",
    dek: "Money-market funds and bonds are moving on-chain first — where settlement speed and distribution matter most.",
  },
  {
    category: "stablecoins",
    categoryLabel: "Stablecoins",
    title: "Stablecoins are quietly becoming payment infrastructure.",
    dek: "Cross-border settlement and corporate treasury are adopting digital money faster than consumer payments.",
  },
  {
    category: "custody",
    categoryLabel: "Custody",
    title: "Custody is the gate institutional capital walks through.",
    dek: "Allocation follows infrastructure: qualified custody, segregation and controls come before size.",
  },
  {
    category: "regulation",
    categoryLabel: "Regulation",
    title: "Regulation is turning digital assets into a licensed industry.",
    dek: "Clear frameworks are replacing uncertainty — and deciding where the next wave of institutional activity locates.",
  },
  {
    category: "infrastructure",
    categoryLabel: "Infrastructure",
    title: "Market infrastructure is being rebuilt for 24/7 settlement.",
    dek: "Exchanges, clearing and collateral are being redesigned around always-on, programmable markets.",
  },
  {
    category: "infrastructure",
    categoryLabel: "Infrastructure",
    title: "Interoperability is becoming the quiet constraint.",
    dek: "Assets that cannot move between networks and ledgers cannot scale — connectivity now decides what gets built.",
  },
];

/* The publication's own metadata line. No invented issue numbers, dates or
   read times — this is the §14 fallback identity. */
const IMPRINT = "Digital Assets Intel · 2026";

/* ------------------------------------------------------------------ page -- */

function Intel() {
  const [category, setCategory] = useState<CategoryId>("all");
  const visible = category === "all" ? STORIES : STORIES.filter((s) => s.category === category);

  return (
    <>
      {/* 01 — FEATURED STORY · the lead, and the page's opening beat. There is
          no masthead above it: the publication opens straight into its
          journalism. pt-20 is the clearance the fixed nav needs, carried by
          whichever section opens a page. */}
      <Section label="Featured" className="pt-20">
        <Reveal>
          <p className="label opacity-45">Featured</p>
        </Reveal>

        {/* THE LEAD, SET IN TYPE. The photograph that used to hold the left
            seven columns is gone, and nothing stands in for it: the headline
            takes the width the picture had and becomes the page's opening
            image. Category above, statement at full scale, the line beneath
            it on its own measure, the imprint on a rule — the structure is
            the composition. */}
        <div className="mt-10 border-t-2 border-ink pt-8 lg:mt-12 lg:pt-10">
          <Reveal delay={60}>
            <p className="label accord-signal">{FEATURED.categoryLabel}</p>
          </Reveal>
          <Reveal delay={120}>
            {/* h1: the lead story is the page's dominant heading and the
                document needs exactly one. */}
            <h1 className="display-lg mt-7 max-w-[18ch]">{FEATURED.title}</h1>
          </Reveal>

          <div className="mt-10 grid gap-y-6 lg:mt-12 lg:grid-cols-12 lg:gap-x-10">
            <Reveal delay={180} className="lg:col-span-7">
              <p className="lede max-w-[54ch] opacity-75">{FEATURED.dek}</p>
            </Reveal>
            <Reveal
              delay={240}
              className="lg:col-span-4 lg:col-start-9 lg:justify-self-end lg:text-right"
            >
              <p className="label border-t border-hairline pt-5 opacity-45">{IMPRINT}</p>
              {FEATURED.to ? (
                <a href={FEATURED.to} className="label mt-6 inline-flex items-center gap-3">
                  Read Article <Arrow />
                </a>
              ) : null}
            </Reveal>
          </div>
        </div>
      </Section>

      {/* 02 — LATEST INTELLIGENCE · the browsing area. The lenses live here,
          between the headline and the stories they filter, so the control and
          its result read as one thing. */}
      <Section label="Latest Intelligence">
        <Reveal>
          <p className="label accord-signal opacity-45">Latest Intelligence</p>
        </Reveal>
        <Reveal delay={60}>
          <h2 className="mt-8 font-display text-[clamp(1.2rem,6.5vw,1.9rem)] font-extrabold uppercase leading-[0.88] tracking-[-0.028em] break-words sm:text-[clamp(1.9rem,3.6vw,3.75rem)]">
            The signal,
            <br />
            without the noise.
          </h2>
        </Reveal>

        {/* Ruled band: the rules above and below are what mark this as the
            section's own control, so the active lens needs only the accent —
            an underline inside a ruled band reads as a collision. */}
        <Reveal delay={120} className="mt-14 border-y border-hairline py-5">
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <div
              role="tablist"
              aria-label="Editorial categories"
              className="flex flex-wrap gap-x-8 gap-y-3"
            >
              {CATEGORIES.map((entry) => {
                const selected = entry.id === category;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setCategory(entry.id)}
                    className={cn(
                      "label transition-opacity duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink",
                      selected ? "accord-signal opacity-100" : "opacity-40 hover:opacity-70",
                    )}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>
            {/* Pinned right where there is room; on narrow screens it takes its
                own line on the left margin rather than floating out there
                alone once the lenses wrap. */}
            <span className="label basis-full opacity-35 sm:ml-auto sm:basis-auto">
              {visible.length} {visible.length === 1 ? "Perspective" : "Perspectives"}
            </span>
          </div>
        </Reveal>

        {/* THE INDEX. Each perspective is a ruled row rather than a card:
            number, category, statement, line. It is the same device the
            editorial index below already uses, so the two halves of the page
            read as one publication rather than a gallery and a list. No
            boxes, no fills, no radius — the rules and the numbering carry the
            structure the photographs used to.

            The number is the story's position in the full roster, not in the
            filtered result, so a perspective keeps its number when a lens
            narrows the list. */}
        {/* No top rule here: the filter band above already closes with one, and
            adding a second left an empty ruled band between the control and
            the first entry. The band's own bottom rule opens the index. */}
        <div className="mt-10 lg:mt-12">
          {visible.map((story) => {
            const index = STORIES.indexOf(story) + 1;
            return (
              <Reveal key={story.title} delay={(index % 3) * 60}>
                <article className="grid gap-x-10 gap-y-4 border-b border-hairline py-9 lg:grid-cols-12 lg:py-11">
                  <p className="label accord-signal lg:col-span-1">
                    {String(index).padStart(2, "0")}
                  </p>
                  <div className="min-w-0 lg:col-span-6 lg:col-start-2">
                    <p className="label opacity-45">{story.categoryLabel}</p>
                    <h3 className="display-md mt-4 max-w-[30ch]">{story.title}</h3>
                  </div>
                  <div className="min-w-0 lg:col-span-4 lg:col-start-9">
                    <p className="max-w-[46ch] text-base leading-relaxed opacity-70">{story.dek}</p>
                    {story.to ? (
                      <a href={story.to} className="label mt-6 inline-flex items-center gap-3">
                        Read Article <Arrow />
                      </a>
                    ) : null}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* 05 — EDITORIAL INDEX · the five lenses, stated once. */}
      <Section label="What We Watch" tone="bone">
        <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="label accord-signal opacity-45">What We Watch</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="mt-8 font-display text-[clamp(1.2rem,6.5vw,1.9rem)] font-extrabold uppercase leading-[0.88] tracking-[-0.028em] break-words sm:text-[clamp(1.9rem,3.6vw,3.75rem)]">
                {" "}
                The forces behind
                <br />
                digital assets.
              </h2>
            </Reveal>
          </div>
        </div>

        <div className="mt-16 border-t border-hairline lg:mt-20">
          {LENSES.map((lens, i) => (
            <Reveal key={lens.name} delay={i * 70}>
              <div className="grid items-baseline gap-x-8 gap-y-3 border-b border-hairline py-8 lg:grid-cols-12 lg:py-10">
                <p className="display-md accord-signal opacity-60 lg:col-span-1">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="display-md lg:col-span-4">{lens.name}</h3>
                <p className="max-w-[52ch] text-base leading-relaxed opacity-70 lg:col-span-6 lg:col-start-7">
                  {lens.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 06 — STAY CLOSE TO THE SIGNAL · the close. Mirrors the footer's
          frontend-only form convention — no fake success state. */}
      <Section label="Stay Close to the Signal" tone="ink">
        <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-6">
            <Reveal>
              <p className="label accord-signal-invert opacity-70">Digital Assets Intel</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="display-lg mt-8 max-w-[14ch]">Stay close to the signal.</h2>
            </Reveal>
          </div>
          <div className="lg:col-span-5 lg:col-start-8 lg:pt-4">
            <Reveal delay={120}>
              <p className="lede opacity-75">
                {" "}
                Receive the latest Digital Finance Alliance perspectives, analysis and intelligence
                directly.
              </p>
            </Reveal>
            <Reveal delay={180} className="mt-10">
              <form
                className="group flex items-center justify-between border-b border-hairline-invert pb-4"
                onSubmit={(event) => event.preventDefault()}
              >
                <input
                  type="email"
                  placeholder="Email"
                  aria-label="Email"
                  className="w-full bg-transparent text-base outline-none placeholder:opacity-40"
                />
                <button type="submit" className="label inline-flex items-center gap-3">
                  Subscribe <Arrow />
                </button>
              </form>
            </Reveal>
          </div>
        </div>
      </Section>
    </>
  );
}
