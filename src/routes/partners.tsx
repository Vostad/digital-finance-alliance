import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { MicrositePhoto } from "@/components/site/MicrositePhoto";
import { Action } from "@/components/site/primitives";
import { FINANCIAL_RAILS_LOGOS } from "@/lib/financial-rails-logos";
import { MICROSITE_PHOTOS } from "@/lib/microsite-photography";

/**
 * PARTNERS & NETWORK — the institutional network page.
 *
 * Four beats and nothing else: who we are, why partner, who has already been
 * in the room, and the ask. Every chapter hangs on the site's own Section, so
 * the numbered left rail, the grounds, the type and the buttons are the
 * existing system rather than a new one.
 *
 * The archive reads from FINANCIAL_RAILS_LOGOS — the same eighty marks
 * that power the homepage network field and Financial Rails V2 — so the three
 * surfaces can never disagree and a mark is added or retired in one place.
 *
 * GROUNDS. Light, surface, then dark for the archive and the close: the two
 * quiet chapters make the dark proof moment land, and the archive and the ask
 * read as one crescendo rather than two blocks.
 *
 * The marks are white artwork on transparency (measured: 79 of 80 sit at a
 * mean opaque luminance above 128, median 252), so on the dark ground they are
 * shown with no filter and no inversion. That is also why the archive is dark:
 * it is the ground the artwork was drawn for.
 *
 * The archive renders from /network-logos-trimmed — the same eighty marks with
 * their transparent margin cropped away. The supplied canvases are a uniform
 * 400x200 with the ink occupying a median 55% of the width and just 32% of the
 * height, which is why the marks read small however large the cell. Trimming
 * is a crop of empty alpha only; no artwork pixel is altered. It lives in its
 * own directory rather than replacing the shared files because the homepage
 * and Financial Rails V2 marquees are sized around the padded canvases, and
 * this page must not change them.
 */

export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "Partners & Network — The Institutions Behind the Room | Financial Rails" },
      {
        name: "description",
        content:
          "A network of leading organisations that have participated in, supported and shaped our programmes.",
      },
      { property: "og:title", content: "Partners & Network — Financial Rails" },
      {
        property: "og:description",
        content:
          "A network of leading organisations that have participated in, supported and shaped our programmes.",
      },
    ],
    links: [{ rel: "canonical", href: "https://financialrails.org/partners" }],
  }),
  component: Partners,
});

/** 02 — the three reasons, locked, each led by a real frame from the archive. */
const WHY_PARTNER = [
  {
    index: "01",
    title: "Access",
    body: "Reach senior decision-makers across payments, banking, settlement, markets and regulation.",
    photo: MICROSITE_PHOTOS.whyAttend,
  },
  {
    index: "02",
    title: "Authority",
    body: "Put your organisation at the centre of the conversations shaping the next financial system.",
    photo: MICROSITE_PHOTOS.speak,
  },
  {
    index: "03",
    title: "Engagement",
    body: "Create meaningful relationships through content, meetings and direct participation.",
    photo: MICROSITE_PHOTOS.whoInRoom,
  },
];

function Partners() {
  return (
    <>
      {/* 01 — PARTNERS & NETWORK · the opening. One statement, one sentence
          beside it, and nothing else. */}
      <Section label="01 — Partners & Network">
        {/* The header is fixed and overlays the first 77px of the page, which
            eats most of the section's own opening padding — the heading was
            landing 52px under the navigation. This restores a deliberate
            opening: further spacing steps at both ends of the scale, so the
            chapter starts ~148px clear of the chrome at desktop and ~84px on
            the phone, instead of 52px at either. */}
        <div className="grid gap-y-10 pt-20 lg:grid-cols-12 lg:gap-x-12 lg:pt-24">
          <Reveal className="lg:col-span-7">
            <h1 className="display-xl max-w-[16ch]">The institutions behind the room.</h1>
          </Reveal>
          <Reveal delay={110} className="lg:col-span-5 lg:col-start-8 lg:self-end lg:pb-3">
            <p className="lede max-w-[46ch] opacity-75">
              A network of leading organisations that have participated in, supported and shaped our
              programmes.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* 02 — WHY PARTNER · three editorial columns on three rules. No boxes,
          no fills, no icons: the number, the word and one line each. */}
      <Section label="02 — Why Partner" tone="bone">
        <Reveal>
          <h2 className="display-lg max-w-[18ch]">Build the room with us.</h2>
        </Reveal>

        {/* Three editorial panels, not cards: a frame leads each one, then a
            hairline, then number, title and line. No container, no radius, no
            shadow — the picture and the rule are the whole device. Two up at
            tablet with the third below, one up on the phone. */}
        <div className="mt-14 grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
          {WHY_PARTNER.map((item, i) => (
            <Reveal key={item.title} delay={i * 90}>
              <figure className="relative aspect-[4/3] w-full overflow-hidden bg-bone">
                <MicrositePhoto
                  photo={item.photo}
                  className="grayscale transition-[filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:grayscale-0 motion-reduce:transition-none"
                />
              </figure>
              <div className="mt-7 border-t border-hairline pt-6">
                <p className="label accord-signal">{item.index}</p>
                <h3 className="mt-5 font-display text-[clamp(1.5rem,2.6vw,2.1rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.025em]">
                  {item.title}
                </h3>
                <p className="mt-4 max-w-[40ch] text-base leading-relaxed opacity-75">
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 03 — THE NETWORK · the proof. A static archive on the brand dark
          ground: eight marks a row at desktop, six at tablet, three on the
          phone, on a plain grid with generous air and no tiles, rules or
          shadows. Nothing moves and nothing depends on hover — the marks are
          the argument. */}
      <Section label="03 — The Network" tone="ink">
        <Reveal>
          <h2 className="display-lg max-w-[20ch]">Attended by industry leaders.</h2>
        </Reveal>

        {/* The files are numbered, not named, so there are no organisation
            names to put in alt text and none may be invented. Each mark is
            therefore decorative and the list carries one honest label for
            assistive technology; the heading above states the claim. */}
        <Reveal delay={110}>
          <ul
            aria-label={`${FINANCIAL_RAILS_LOGOS.length} organisations from the Financial Rails network`}
            className="mt-14 grid grid-cols-3 items-center gap-x-6 gap-y-12 sm:gap-x-10 md:grid-cols-4 md:gap-x-12 md:gap-y-14 lg:mt-16 xl:grid-cols-6 xl:gap-x-14 xl:gap-y-16"
          >
            {FINANCIAL_RAILS_LOGOS.map((src) => (
              <li key={src} className="flex items-center justify-center">
                <img
                  src={src.replace("/network-logos/", "/network-logos-trimmed/")}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  /* Height sets the optical weight and width follows the
                     mark, so a 7.4:1 wordmark and a square roundel carry the
                     same presence without being forced into one box. Both
                     bounds are capped, so the widest marks bind on width and
                     the compact ones on height. */
                  className="max-h-12 w-auto max-w-full object-contain opacity-80 lg:max-h-14"
                />
              </li>
            ))}
          </ul>
        </Reveal>
      </Section>

      {/* FINAL — the ask. The archive's own ground carried through, so the
          proof and the invitation read as one close. One statement, one door,
          no second paragraph. */}
      <Section label="Partner With Us" tone="ink">
        <div className="grid gap-y-10 lg:grid-cols-12 lg:items-end lg:gap-x-12">
          <Reveal className="lg:col-span-7">
            <h2 className="display-lg max-w-[16ch]">Build the next room with us.</h2>
          </Reveal>
          <Reveal delay={110} className="lg:col-span-5 lg:col-start-8 lg:pb-2">
            <Action to="/contact" variant="outlineInvert">
              Become a Partner
            </Action>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
