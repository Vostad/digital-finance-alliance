import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { Section } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { Action, FinalCta } from "@/components/site/primitives";

/** The widths that exist on disk for the hero photograph. */
const HERO_WIDTHS = [480, 768, 1024, 1400];

export const Route = createFileRoute("/council")({
  head: () => ({
    meta: [
      { title: "Financial Rails Council — The People Shaping the Conversation | Financial Rails" },
      {
        name: "description",
        content:
          "The Financial Rails Council brings together senior leaders and institutions who help shape the questions, priorities and conversations defining the infrastructure money moves through.",
      },
      { property: "og:title", content: "Financial Rails Council" },
      {
        property: "og:description",
        content:
          "A working council of senior leaders across payments, banking, settlement, markets, capital and regulation.",
      },
      { property: "og:url", content: "https://financialrails.org/council" },
    ],
    links: [{ rel: "canonical", href: "https://financialrails.org/council" }],
  }),
  component: Council,
});

/* ------------------------------------------------------------------ data -- */

/** What Council members actually do. Three verbs, not services. */
const PILLARS = [
  {
    name: "Advise",
    body: "Help identify the issues, risks and opportunities that deserve attention.",
  },
  {
    name: "Shape",
    body: "Contribute to the themes, priorities and conversations explored across Financial Rails.",
  },
  {
    name: "Connect",
    body: "Bring relevant leaders, institutions and perspectives into the conversation.",
  },
];

/** Who sits at the table — sectors, not invented members. The Council
    membership is introduced only when confirmed. */
const SECTORS = [
  {
    name: "Payments & Banking Infrastructure",
    body: "The people running the schemes, networks and core systems money moves through.",
  },
  {
    name: "Digital Money & Stablecoins",
    body: "Issuers and banks building tokenized deposits, stablecoins and programmable settlement.",
  },
  {
    name: "Settlement & Market Infrastructure",
    body: "Executives responsible for clearing, collateral, custody and post-trade at scale.",
  },
  {
    name: "Capital & Institutional Adoption",
    body: "Investors and institutions financing the buildout and deciding what reaches production.",
  },
  {
    name: "Regulation & Policy",
    body: "The authorities shaping the rules, standards and supervision the rails operate under.",
  },
];

/* ------------------------------------------------------------------ page -- */

function Council() {
  return (
    <>
      {/* 01 — HERO · private and selective. Architecture, not a meeting. */}
      <PageHero
        meta="Financial Rails Council"
        eyebrow="Financial Rails Council"
        title={
          <>
            The people
            <br />
            shaping the conversation.
          </>
        }
        /* "SHAPING THE CONVERSATION." measures 15.46× its font-size, so
           inside the hero column (0.62·(vw−96px)−128px at lg) the authored
           break only holds when the size stays under 2.8vw — measured at
           1024, the tightest lg width. Below sm the headline recomposes to
           three natural lines at a readable size instead of shrinking the
           25-character line onto one row. */
        titleClassName="font-display max-w-[26ch] text-[clamp(1.5rem,8vw,1.75rem)] font-extrabold uppercase leading-[0.86] tracking-[-0.03em] break-words sm:text-[clamp(1.75rem,2.8vw,2.9rem)]"
        lede="The Financial Rails Council brings together senior leaders and institutions who help shape the questions, priorities and conversations defining the infrastructure money moves through."
        actions={[{ label: "Express Interest", to: "/contact" }]}
        seed="financial-rails-council"
        /* Replaces the hotlinked Unsplash stock frame with the project's own
           photograph. No `ratio` is passed, so this frame keeps the height it
           has always had here — it stretches to the text column, which makes
           its shape vary from 0.79:1 at 1440 to 1.04:1 at 1920. The master is
           a 1400x1400 square for exactly that reason: it stays centred and
           uncropped-looking at every one of those shapes. */
        image={{
          src: "/media/home/council-hero-1024.jpg",
          srcSet: HERO_WIDTHS.map((w) => `/media/home/council-hero-${w}.jpg ${w}w`).join(", "),
          avifSrcSet: HERO_WIDTHS.map((w) => `/media/home/council-hero-${w}.avif ${w}w`).join(", "),
          sizes: "(min-width: 1024px) calc(37.95vw - 37px), 100vw",
          alt: "Two delegates in conversation during a break at a conference",
        }}
      />

      {/* 02 — WHY THE COUNCIL · spacious, one argument. */}
      <Section label="Why the Council">
        <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-6">
            <Reveal>
              <p className="label accord-signal opacity-45">Why the Council</p>
            </Reveal>
            <Reveal delay={60}>
              {/* Authored two-line break. "FOR ONE PERSPECTIVE." measures
                  12.04× its font-size against a 384px column at 1024, so the
                  size is capped below the display-lg curve. */}
              <h2 className="mt-8 font-display text-[clamp(1rem,5.8vw,1.9rem)] font-extrabold uppercase leading-[0.88] tracking-[-0.028em] break-words sm:text-[clamp(1.9rem,3.05vw,3rem)] lg:text-[clamp(1.5rem,2.4vw,3rem)]">
                {" "}
                Money is moving too fast
                <br />
                for one perspective.
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-5 lg:col-start-8 lg:pt-4">
            <Reveal delay={120}>
              <p className="lede opacity-80">
                {" "}
                The forces rebuilding financial infrastructure span payments, banking, settlement,
                markets, capital and regulation.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <p className="mt-6 text-base leading-relaxed opacity-75">
                {" "}
                The Council brings different perspectives into one room so Financial Rails can focus
                on the questions that matter.
              </p>
            </Reveal>
          </div>
        </div>

        {/* The statement. */}
        <div className="mt-20 border-t border-hairline pt-12 lg:mt-24">
          <Reveal>
            <p className="display-md">Different perspectives.</p>
          </Reveal>
          <Reveal delay={90}>
            <p className="display-md accord-signal mt-2">One conversation.</p>
          </Reveal>
        </div>
      </Section>

      {/* 03 — WHAT THE COUNCIL DOES · three functions on rules. */}
      <Section label="What the Council Does" tone="bone">
        <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="label accord-signal opacity-45">The Role</p>
            </Reveal>
            <Reveal delay={60}>
              {/* "SHAPE THE QUESTIONS." at the display-lg curve leaves under
                  1% slack in the lg column at 1024 — 3.5vw buys real margin
                  without visibly leaving the site's scale. */}
              <h2 className="mt-8 font-display text-[clamp(1.2rem,6.7vw,1.9rem)] font-extrabold uppercase leading-[0.88] tracking-[-0.028em] break-words sm:text-[clamp(1.9rem,3.5vw,3.6rem)]">
                Shape the questions.
                <br />
                Sharpen the agenda.
              </h2>
            </Reveal>
          </div>
        </div>

        <div className="mt-16 grid gap-x-8 gap-y-10 sm:grid-cols-3 lg:mt-20">
          {PILLARS.map((pillar, i) => (
            <Reveal key={pillar.name} delay={i * 80} className="border-t border-hairline pt-6">
              <p className="label accord-signal opacity-60">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="display-sm mt-6">{pillar.name}</h3>
              <p className="mt-4 max-w-[34ch] text-sm leading-relaxed opacity-65">{pillar.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 04 — WHO SITS AT THE TABLE · sectors, never invented members. */}
      <Section label="Who Sits at the Table">
        <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="label accord-signal opacity-45">The Council</p>
            </Reveal>
            <Reveal delay={60}>
              {/* "DIFFERENT PERSPECTIVES." measures 13.94× its font-size —
                  it outgrows both the display-lg floor on phones and the
                  display-lg curve inside the lg column, so both ends of the
                  clamp are fitted to the measured column widths. */}
              <h2 className="mt-8 font-display text-[clamp(1.1rem,6vw,1.9rem)] font-extrabold uppercase leading-[0.88] tracking-[-0.028em] break-words sm:text-[clamp(1.9rem,3.1vw,3rem)]">
                Different sectors.
                <br />
                Different perspectives.
                <br />
                Shared responsibility.
              </h2>
            </Reveal>
          </div>
        </div>

        <div className="mt-16 border-t border-hairline lg:mt-20">
          {SECTORS.map((sector, i) => (
            <Reveal key={sector.name} delay={i * 70}>
              <div className="grid items-baseline gap-x-8 gap-y-3 border-b border-hairline py-8 lg:grid-cols-12 lg:py-10">
                <p className="label accord-signal opacity-60 lg:col-span-1">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="display-md lg:col-span-4">{sector.name}</h3>
                <p className="max-w-[52ch] text-base leading-relaxed opacity-70 lg:col-span-6 lg:col-start-7">
                  {sector.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 05 — THE ROLE · the dark editorial statement. Two negations, then
          what the Council actually is. */}
      <Section label="The Role" tone="ink">
        <div className="grid gap-y-14 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-7">
            {/* "A WORKING COUNCIL." measures 10.96× its font-size — the
                display-xl curve overruns the lg column at every width from
                1024 up, so the whole clamp is fitted to the measured column:
                3.9vw holds it with slack from 1024 to past 1920. */}
            <Reveal>
              <h2 className="font-display text-[clamp(1.3rem,7.5vw,2.25rem)] font-extrabold uppercase leading-[0.84] tracking-[-0.03em] break-words sm:text-[clamp(2.25rem,3.9vw,4rem)]">
                <span className="block opacity-40">Not a board.</span>
                <span className="block opacity-40">Not a network.</span>
                <span className="accord-signal-invert block">A working council.</span>
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:pt-4">
            <Reveal delay={140}>
              <p className="lede opacity-80">
                {" "}
                The Council is designed to be an active body of people who contribute perspective,
                challenge assumptions and help Financial Rails stay focused on the issues that will
                matter next.
              </p>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* 06 — EXPRESS INTEREST · a simple, selective invitation. */}
      <Section label="Express Interest" tone="bone">
        <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-6">
            <Reveal>
              <p className="label accord-signal opacity-45">Join the Council</p>
            </Reveal>
            <Reveal delay={60}>
              {/* Unconstrained measure: at the display-lg scale the column
                  itself breaks this after "perspective" — a clean two-line
                  wrap. A ch-based max-w here forced a three-line stack. */}
              <h2 className="mt-8 font-display text-[clamp(1.3rem,8vw,1.9rem)] font-extrabold uppercase leading-[0.88] tracking-[-0.028em] break-words sm:text-[clamp(1.9rem,3.6vw,3.75rem)]">
                Your perspective matters.
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-5 lg:col-start-8 lg:pt-4">
            <Reveal delay={120}>
              <p className="lede opacity-80">
                {" "}
                Financial Rails is building a Council of senior leaders and institutions across
                payments, banking, settlement, markets, capital and regulation.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <p className="mt-6 text-base leading-relaxed opacity-75">
                Council participation is selective and by invitation.
              </p>
            </Reveal>
            <Reveal delay={240} className="mt-10">
              <Action to="/contact">Express Interest</Action>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* 07 — FINAL CTA · nothing after this. */}
      <FinalCta
        title="Help shape what comes next."
        body="The Council is being built now."
        actions={[{ label: "Express Interest", to: "/contact" }]}
      />
    </>
  );
}
