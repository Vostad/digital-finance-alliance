import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Section } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { MicrositePhoto } from "@/components/site/MicrositePhoto";
import { MICROSITE_PHOTOS } from "@/lib/microsite-photography";
import {
  DF30_DOMAINS,
  DF30_GLOBAL_META,
  DF30_GLOBAL_PRINCIPLES,
  type Df30Person,
} from "@/lib/df30-global";

/**
 * DIGITAL FINANCE DF30 — GLOBAL EDITION · 2026. The publication page.
 *
 * An annual editorial index, built to read like a publication rather than an
 * awards page: a typographic cover with one editorial photograph, an
 * introduction that argues the list before showing it, thirty profiles in six
 * named domains, a methodology note, and a closing statement. No trophies, no
 * badges, no ranking devices — the numbering is the reading order.
 *
 * The thirty people and every word about them live in src/lib/df30-global.ts;
 * this file is only the composition. The portraits are the normalised 4:5
 * series generated from the supplied DF30/df-global set — five formats and
 * every aspect ratio in, one editorial system out.
 *
 * GROUNDS. Ink cover, paper introduction, paper index (bone would zebra six
 * times), bone methodology, ink close — the publication opens and closes dark
 * and stays quiet in between.
 */

export const Route = createFileRoute("/df30-global-list")({
  head: () => ({
    meta: [
      { title: "Global DF30 — 2026 | Digital Finance DF30" },
      {
        name: "description",
        content:
          "The inaugural Global DF30: 30 leaders shaping the future of finance across infrastructure, inclusion, regulation, institutions, capital markets and AI. Published 15 August 2026.",
      },
      { property: "og:title", content: "Global DF30 — 2026 | Digital Finance DF30" },
      {
        property: "og:description",
        content:
          "30 leaders shaping the future of finance. An editorial index by Digital Finance Alliance.",
      },
    ],
    links: [{ rel: "canonical", href: "/df30-global-list" }],
  }),
  component: Df30GlobalList,
});

/* ----------------------------------------------------------------- pieces -- */

/**
 * One profile's portrait, from the normalised series. AVIF first, JPEG behind;
 * srcset lists only the widths that exist for this person, so the browser can
 * never request a file the source could not honestly provide. The 4:5 box
 * reserves its own height — no layout shift — and every portrait below the
 * fold is lazy.
 *
 * `sizes` is the card's real arithmetic: a third of the content column at lg
 * (33.33vw − 107px), half at md, full width below.
 */
const CARD_SIZES =
  "(min-width: 1024px) calc(33.33vw - 107px), (min-width: 768px) calc(50vw - 68px), calc(100vw - 48px)";

function Portrait({ person }: { person: Df30Person }) {
  const { stem, widths } = person.portrait;
  const set = (ext: "avif" | "jpg") => widths.map((w) => `${stem}-${w}.${ext} ${w}w`).join(", ");
  return (
    <figure className="relative aspect-[4/5] w-full overflow-hidden bg-bone">
      <picture className="contents">
        <source type="image/avif" srcSet={set("avif")} sizes={CARD_SIZES} />
        <img
          src={`${stem}-480.jpg`}
          srcSet={set("jpg")}
          sizes={CARD_SIZES}
          alt={`Portrait of ${person.name}`}
          width={480}
          height={600}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover grayscale transition-[filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:grayscale-0 motion-reduce:transition-none"
        />
      </picture>
    </figure>
  );
}

/**
 * One editorial profile. Portrait, then the index and slot on one quiet line,
 * the name as the anchor, the role, and one factual sentence. All information
 * sits on the page — nothing is hover-gated — and the hover is the portrait
 * alone, per the site's grammar.
 */
function ProfileCard({ person, delay }: { person: Df30Person; delay: number }) {
  return (
    <Reveal delay={delay}>
      <article className="flex h-full flex-col">
        <Portrait person={person} />
        <div className="mt-5 flex items-baseline justify-between gap-x-4 border-t border-hairline pt-4">
          <p className="label accord-signal">{person.index}</p>
          <p className="label text-right opacity-45">{person.slot}</p>
        </div>
        <h4 className="mt-3 font-display text-[clamp(1.2rem,1.5vw,1.45rem)] font-extrabold uppercase leading-[1.04] tracking-[-0.02em]">
          {person.name}
        </h4>
        <p className="mt-2 text-sm leading-snug opacity-70">{person.role}</p>
        <p className="mt-3 max-w-[38ch] text-sm leading-relaxed opacity-60">{person.note}</p>
      </article>
    </Reveal>
  );
}

/* ------------------------------------------------------------------- page -- */

function Df30GlobalList() {
  return (
    <>
      {/* 01 — THE COVER · dark, typographic, one photograph. The masthead
          carries the property, the headline carries the claim, and the frame
          is a room of many faces — the audience the list is drawn from — so
          no single honouree is elevated onto the cover. Published date on the
          floor, no CTA: covers do not sell. */}
      <Section label="Digital Finance DF30" tone="ink">
        <div className="grid gap-y-12 pt-20 lg:grid-cols-12 lg:items-center lg:gap-x-12 lg:pt-24">
          <div className="min-w-0 lg:col-span-6">
            <Reveal>
              <p className="label accord-signal-invert">{DF30_GLOBAL_META.label}</p>
            </Reveal>
            <Reveal delay={80}>
              {/* Two lines by construction: "the Future of Finance" measures
                  12.59em in this face, so the size is the column over 12.9
                  rather than a viewport guess. */}
              <h1 className="mt-8 font-display text-[clamp(1.25rem,calc((100vw-48px)/12.9),4.1rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.03em] md:text-[clamp(1.25rem,calc((100vw-96px)/12.9),4.1rem)] lg:text-[clamp(1.25rem,calc((50vw-136px)/12.9),4.1rem)]">
                {DF30_GLOBAL_META.headline[0]}
                <br />
                {DF30_GLOBAL_META.headline[1]}
              </h1>
            </Reveal>
            <Reveal delay={150}>
              <p className="display-sm mt-8">{DF30_GLOBAL_META.edition}</p>
            </Reveal>
            <Reveal delay={210} className="mt-10 border-t border-hairline-invert pt-6">
              <p className="label opacity-55">{DF30_GLOBAL_META.published}</p>
            </Reveal>
          </div>

          {/* The cover photograph: delegates seated in a summit audience, from
              the platform's own record — many faces, no favourite. Eager and
              full-priority: it is the page's opening image. */}
          <Reveal delay={120} className="min-w-0 lg:col-span-6">
            <figure className="relative aspect-[4/3] w-full overflow-hidden bg-ink/40">
              <MicrositePhoto
                photo={{
                  ...MICROSITE_PHOTOS.attend,
                  sizes:
                    "(min-width: 1024px) calc(50vw - 136px), (min-width: 768px) calc(100vw - 96px), calc(100vw - 48px)",
                }}
                loading="eager"
                className="grayscale"
              />
            </figure>
          </Reveal>
        </div>
      </Section>

      {/* 02 — THE ARGUMENT · why the list exists, before anyone appears. One
          heading, one paragraph, one line of data on a rule. */}
      <Section label={DF30_GLOBAL_META.introLabel}>
        <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="min-w-0 lg:col-span-6">
            <Reveal>
              <p className="label accord-signal">{DF30_GLOBAL_META.introLabel}</p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="display-lg mt-7 max-w-[14ch]">{DF30_GLOBAL_META.introHeading}</h2>
            </Reveal>
          </div>
          <div className="min-w-0 lg:col-span-6 lg:self-end">
            <Reveal delay={140}>
              <p className="lede max-w-[56ch] opacity-80">{DF30_GLOBAL_META.intro}</p>
            </Reveal>
            <Reveal delay={200} className="mt-9 border-t border-hairline pt-6">
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {DF30_GLOBAL_META.introMeta.map((item, i) => (
                  <li
                    key={item}
                    className={cn("label opacity-55", i > 0 && "border-l border-ink/20 pl-5")}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* 03 — THE DF30 · thirty profiles in six named domains. Each domain
          opens on its own editorial divider — index, rule, title — then runs
          its five profiles on a three-column grid. Spacing between a domain's
          cards and the next domain's header is one controlled step, not a
          section break, so the whole list reads as one continuous index. */}
      <Section label={DF30_GLOBAL_META.listLabel}>
        <Reveal>
          <h2 className="display-lg max-w-[20ch]">{DF30_GLOBAL_META.listLabel}.</h2>
        </Reveal>

        {DF30_DOMAINS.map((domain) => (
          <div key={domain.index} className="mt-12 lg:mt-14">
            <Reveal>
              <div className="flex items-baseline gap-x-5 border-t-2 border-ink/80 pt-5">
                <p className="accord-signal font-display text-[clamp(1.3rem,1.8vw,1.7rem)] font-extrabold leading-none tracking-[-0.02em]">
                  {domain.index}
                </p>
                <h3 className="font-display text-[clamp(1.05rem,1.5vw,1.4rem)] font-extrabold uppercase leading-[1.05] tracking-[-0.015em]">
                  {domain.title}
                </h3>
              </div>
            </Reveal>
            <div className="mt-8 grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-12">
              {domain.people.map((person, i) => (
                <ProfileCard key={person.name} person={person} delay={(i % 3) * 80} />
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* 04 — METHODOLOGY · a publication note. The statement at reading
          scale, four compact principles on hairlines, the published date. */}
      <Section label="How the DF30 Is Built" tone="bone">
        <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-12">
          <div className="min-w-0 lg:col-span-5">
            <Reveal>
              <h2 className="display-lg max-w-[15ch]">{DF30_GLOBAL_META.methodHeading}</h2>
            </Reveal>
            <Reveal delay={110}>
              <p className="mt-8 max-w-[50ch] text-base leading-relaxed opacity-75">
                {DF30_GLOBAL_META.method}
              </p>
            </Reveal>
          </div>
          <div className="min-w-0 lg:col-span-6 lg:col-start-7">
            <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {DF30_GLOBAL_PRINCIPLES.map((principle, i) => (
                <Reveal key={principle.title} delay={140 + i * 70}>
                  <div className="border-t border-hairline pt-5">
                    <h3 className="font-display text-base font-extrabold uppercase tracking-[-0.01em]">
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
              <p className="label opacity-55">{DF30_GLOBAL_META.published}</p>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* 05 — THE CLOSE · the editorial conclusion on the brand dark. One
          statement sized from the column ("The financial system" is 11.89em),
          one line, the masthead. No CTA. */}
      <Section label="DF30" tone="ink">
        <div className="py-4 lg:py-10">
          <Reveal>
            <p className="font-display text-[clamp(1.35rem,calc((100vw-48px)/12.2),5.6rem)] font-extrabold uppercase leading-[0.86] tracking-[-0.035em] md:text-[clamp(1.35rem,calc((100vw-96px)/12.2),5.6rem)] lg:text-[clamp(1.35rem,calc((100vw-224px)/12.2),5.6rem)]">
              {DF30_GLOBAL_META.closeHeadline[0]}
              <br />
              {DF30_GLOBAL_META.closeHeadline[1]}
            </p>
          </Reveal>
          <Reveal delay={120}>
            <p className="display-sm mt-10 max-w-[34ch] opacity-80">{DF30_GLOBAL_META.closeLine}</p>
          </Reveal>
          <Reveal delay={200} className="mt-14 border-t border-hairline-invert pt-8">
            <p className="label accord-signal-invert">{DF30_GLOBAL_META.signature}</p>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
