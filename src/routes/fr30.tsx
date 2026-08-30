import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { Action } from "@/components/site/primitives";
import {
  FR30_HERO,
  FR30_FEATURED,
  FR30_EDITIONS,
  FR30_METHOD,
  FR30_PRINCIPLES,
  FR30_CLOSE,
} from "@/lib/fr30";

/**
 * FR30 — the franchise's landing page.
 *
 * An editorial index, not an event page: five chapters, no ticketing, no
 * statistics, no badges, one door. It hangs on the site's own Section — the
 * numbered left rail, the content canvas, the type and the buttons are the
 * existing system rather than a new one — but reads quieter and denser than
 * the event micro-sites, which is the difference between a publication and a
 * programme.
 *
 * THE LIST IS NOT HERE. This page introduces the property and points at the
 * Global edition; /fr30-global-list holds the thirty names and is a separate
 * build. The forthcoming regional editions have no routes yet, so none of them
 * is a link — a card announces, it does not promise a page that 404s.
 *
 * GROUNDS. Paper, bone, paper, bone, ink: the four editorial chapters alternate
 * quietly and the close lands on the brand dark, so the statement carries
 * without needing scale it has not earned.
 */

export const Route = createFileRoute("/fr30")({
  head: () => ({
    meta: [
      { title: "FR30 — The 30 People Building the Rails | Financial Rails" },
      {
        name: "description",
        content:
          "An editorial index of the people designing, operating, financing and regulating the infrastructure through which money moves. Global FR30 — 2026, published 15 August 2026.",
      },
      {
        property: "og:title",
        content: "FR30 — The 30 People Building the Rails | Financial Rails",
      },
      {
        property: "og:description",
        content:
          "An editorial index recognising the people building, transforming and governing the next financial system.",
      },
      { property: "og:url", content: "https://financialrails.org/fr30" },
    ],
    links: [{ rel: "canonical", href: "https://financialrails.org/fr30" }],
  }),
  component: Fr30,
});

/* ----------------------------------------------------------------- pieces -- */

/* ------------------------------------------------------------------- page -- */

function Fr30() {
  return (
    <>
      {/* 01 — THE MASTHEAD · a property page, not a landing page, so the
          cover is set as a masthead: name, statement, one sentence, one line
          of metadata. No photograph and no counterweight column — the
          statement holds the page on its own, and the first edition arrives
          immediately below rather than a screen down. `flush` because the band
          sets its own measure: enough head to clear the fixed nav, a short
          foot so nothing floats. */}
      <Section label="FR30" flush>
        <div className="px-6 pt-28 pb-14 md:px-12 md:pt-32 md:pb-16 lg:px-16 lg:pt-36 lg:pb-20">
          <Reveal>
            <p className="label accord-signal">{FR30_HERO.label}</p>
          </Reveal>
          <Reveal delay={80}>
            {/* Two lines by construction, authored with the break. The column
                is the full content width now that no photograph shares the
                row, so the size tracks the page rather than a six-column half
                and settles on the 4.1rem ceiling from roughly 1000px up. */}
            <h1 className="mt-8 font-display text-[clamp(1.75rem,calc((100vw-48px)/12.9),4.1rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.03em] md:text-[clamp(1.75rem,calc((100vw-96px)/12.9),4.1rem)]">
              {FR30_HERO.headline[0]}
              <br />
              {FR30_HERO.headline[1]}
            </h1>
          </Reveal>
          <Reveal delay={150}>
            <p className="lede mt-7 max-w-[52ch] opacity-75">{FR30_HERO.lede}</p>
          </Reveal>
          <Reveal delay={210} className="mt-9 border-t border-hairline pt-6">
            <p className="label opacity-55">{FR30_HERO.meta}</p>
          </Reveal>
        </div>
      </Section>

      {/* 02 — FEATURED FR30 · the first edition, set editorially. The
          photograph is gone with the cover's: this page states the edition
          rather than illustrating it, and the masthead — title, statement,
          date, paragraph, one door — carries it. Two columns of type on the
          site's twelve-column track: the masthead left, the argument right,
          so the band stays a band and does not become a stacked screen. */}
      <Section label="Featured FR30" tone="bone">
        <div className="grid gap-y-8 lg:grid-cols-12 lg:gap-x-12">
          <div className="min-w-0 lg:col-span-6">
            <Reveal>
              <p className="label accord-signal">{FR30_FEATURED.label}</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="display-lg mt-6 max-w-[16ch]">{FR30_FEATURED.title}</h2>
            </Reveal>
            <Reveal delay={110}>
              <p className="display-sm mt-6 max-w-[28ch]">{FR30_FEATURED.line}</p>
            </Reveal>
          </div>

          <div className="min-w-0 lg:col-span-6 lg:self-end">
            <Reveal delay={160}>
              <p className="label opacity-55">{FR30_FEATURED.published}</p>
            </Reveal>
            <Reveal delay={210} className="mt-6 border-t border-hairline pt-6">
              <p className="max-w-[54ch] text-base leading-relaxed opacity-75">
                {FR30_FEATURED.body}
              </p>
            </Reveal>
            <Reveal delay={260} className="mt-9">
              <Action to={FR30_FEATURED.to}>{FR30_FEATURED.cta}</Action>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* 03 — BY REGION · three forthcoming editions as one editorial row.
          No photographs: the library holds no frame made in India or in
          Africa, and captioning a UAE picture as either would be a false claim
          about the photograph. The card is therefore typographic — index,
          rule, title, status, line — which also makes the row trivially
          extensible when GCC, Southeast Asia, Europe or Latin America are
          added, and honest about the fact that none of them is a page yet. */}
      <Section label="The FR30, by Region">
        <Reveal>
          <h2 className="display-lg max-w-[18ch]">The FR30, by region.</h2>
        </Reveal>

        {/* Three up only from lg. At 768 a three-column row gives each card
            197px, and "FR30 — Middle East" needs 230px at the size the title
            floors at — the row went three-up but the titles went two-line and
            cramped. Two up at tablet keeps each card at 316px. */}
        <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-x-12">
          {FR30_EDITIONS.map((edition, i) => (
            /* The Reveal sits inside the item, not around it: it renders a
               div, and a div is not valid as a direct child of a ul. */
            <li key={edition.title} className="border-t border-hairline pt-7">
              <Reveal delay={i * 90}>
                <p className="label accord-signal">{edition.index}</p>
                <h3 className="mt-6 font-display text-[clamp(1.35rem,1.9vw,1.8rem)] font-extrabold uppercase leading-[1.02] tracking-[-0.02em]">
                  {edition.title}
                </h3>
                <p className="label mt-4 opacity-45">{edition.status}</p>
                <p className="mt-5 max-w-[38ch] text-sm leading-relaxed opacity-75">
                  {edition.body}
                </p>
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      {/* 04 — METHODOLOGY · a publication note, not four marketing cards. The
          statement carries the argument at reading scale on the left; the four
          principles sit beside it as a dense two-by-two index. Compact by
          construction: small type, tight rules, no illustration. */}
      <Section label="Methodology" tone="bone">
        <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-12">
          <div className="min-w-0 lg:col-span-5">
            <Reveal>
              <h2 className="display-lg max-w-[14ch]">{FR30_METHOD.heading}</h2>
            </Reveal>
            <Reveal delay={110}>
              <p className="mt-8 max-w-[50ch] text-base leading-relaxed opacity-75">
                {FR30_METHOD.statement}
              </p>
            </Reveal>
          </div>

          <div className="min-w-0 lg:col-span-6 lg:col-start-7">
            <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
              {FR30_PRINCIPLES.map((principle, i) => (
                <Reveal key={principle.title} delay={140 + i * 70}>
                  <div className="border-t border-hairline pt-5">
                    <p className="label accord-signal">{principle.index}</p>
                    <h3 className="mt-4 font-display text-base font-extrabold uppercase tracking-[-0.01em]">
                      {principle.title}
                    </h3>
                    <p className="mt-3 max-w-[34ch] text-sm leading-relaxed opacity-75">
                      {principle.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={430} className="mt-10 border-t border-hairline pt-6">
              <p className="max-w-[52ch] text-sm leading-relaxed opacity-60">{FR30_METHOD.close}</p>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* 05 — THE CLOSE · the editorial conclusion on the brand dark. One
          statement, one line, the masthead. No CTA — the page has already
          offered its single door, and a second ask here would turn a
          conclusion into a pitch. */}
      <Section label="FR30" tone="ink">
        <div className="py-4 lg:py-10">
          <Reveal>
            {/* Two lines, as specified, so the type is sized from the content
                column rather than the viewport and carries no max-width:
                "The financial system" measures 11.89em, and the 16ch cap was
                narrower than that line needed, breaking the statement onto
                three lines. Dividing the column by 12.2 holds both lines
                whole from 320px up, with a ceiling so it does not run away at
                1920. */}
            <p className="font-display text-[clamp(1.35rem,calc((100vw-48px)/12.2),5.6rem)] font-extrabold uppercase leading-[0.86] tracking-[-0.035em] md:text-[clamp(1.35rem,calc((100vw-96px)/12.2),5.6rem)] lg:text-[clamp(1.35rem,calc((100vw-224px)/12.2),5.6rem)]">
              {FR30_CLOSE.headline[0]}
              <br />
              {FR30_CLOSE.headline[1]}
            </p>
          </Reveal>
          <Reveal delay={120}>
            <p className="display-sm mt-10 max-w-[34ch] opacity-80">{FR30_CLOSE.line}</p>
          </Reveal>
          <Reveal delay={200} className="mt-14 border-t border-hairline-invert pt-8">
            <p className="label accord-signal-invert">{FR30_CLOSE.signature}</p>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
