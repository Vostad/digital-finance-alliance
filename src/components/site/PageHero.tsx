import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Action, Figure } from "./primitives";
import { Reveal } from "./Reveal";

export type HeroAction = { label: string; to: string };

/**
 * Full-bleed opening spread: oversized headline on the left rail-aligned
 * column, standing image column on the right — the first scroll beat.
 */
export function PageHero({
  eyebrow,
  title,
  titleClassName,
  lede,
  body,
  actions,
  seed,
  meta,
  figureTo,
  figureLabel,
  image,
}: {
  eyebrow?: string;
  /** ReactNode so a hero can author its own line breaks; plain strings still work. */
  title: ReactNode;
  /**
   * Replaces the h1 class outright — not merged, because `display-xl` is a
   * custom utility that tailwind-merge cannot resolve against a font-size
   * override. Pass a complete class string when a longer headline needs its
   * own measure and scale; omit it and the default sizing is untouched.
   */
  titleClassName?: string;
  lede?: string;
  body?: ReactNode;
  actions?: HeroAction[];
  seed: string;
  meta?: string;
  /** When set, the standing image links here. Visual treatment is unchanged. */
  figureTo?: string;
  figureLabel?: string;
  /**
   * Real photography in place of the seeded placeholder. Same frame.
   *
   * `src` alone is enough; supply `avifSrcSet`/`srcSet`/`sizes` as well and the
   * frame delivers responsively in the site's usual AVIF-first, JPEG-behind
   * shape. The ladder is optional so a hero that only has one file still works.
   */
  image?: {
    src: string;
    alt: string;
    avifSrcSet?: string;
    srcSet?: string;
    sizes?: string;
    /**
     * Locks the frame to a ratio, exactly as the seeded Figure does. Without
     * it the frame stretches to the grid row and its height follows whatever
     * the text column happens to be — which is shorter, and at 1920 much
     * shorter. Pass "3 / 4" to reproduce the placeholder's own geometry.
     */
    ratio?: string;
  };
}) {
  const frame = (
    <>
      {/* The site's image grammar: grayscale at rest, full colour under the
          pointer. The reveal class sits on the <img>, which fills the frame
          absolutely, so colour returns under the photograph and nowhere else —
          not the column, not the headline beside it. Tailwind gates `hover:`
          behind (hover: hover), so a touch device never enters the colour
          state, and only the filter moves: no zoom, no scale. */}
      <picture className="contents">
        {image?.avifSrcSet ? (
          <source type="image/avif" srcSet={image.avifSrcSet} sizes={image.sizes} />
        ) : null}
        <img
          src={image?.src}
          {...(image?.srcSet ? { srcSet: image.srcSet } : {})}
          {...(image?.sizes ? { sizes: image.sizes } : {})}
          alt={image?.alt ?? ""}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover grayscale transition-[filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:grayscale-0 motion-reduce:transition-none"
        />
      </picture>
    </>
  );

  const figure = image ? (
    <div className="relative h-full min-h-[22rem] overflow-hidden bg-bone lg:min-h-full">
      {/* The ratio belongs on an INNER box, exactly as the seeded Figure places
          it. Put it on the h-full box instead and, in a row taller than the
          frame is wide, the definite height drives the width instead of the
          other way round — which blew this frame out to 1006px and pushed
          1306px of horizontal overflow onto /contact. Here the width comes
          from the grid column and the ratio derives the height. */}
      {image.ratio ? (
        <div style={{ aspectRatio: image.ratio }} className="relative w-full overflow-hidden">
          {frame}
        </div>
      ) : (
        frame
      )}
    </div>
  ) : (
    <Figure seed={seed} ratio="3 / 4" className="h-full min-h-[22rem] lg:min-h-full" />
  );

  return (
    <section className="bg-paper pt-20">
      <div className="grid lg:grid-cols-[6rem_1fr]">
        <div className="hidden border-r border-hairline lg:block">
          {meta ? (
            <div className="flex h-full items-end justify-center pb-16">
              <span
                className="label opacity-40 whitespace-nowrap"
                style={{ writingMode: "vertical-rl" }}
              >
                {meta}
              </span>
            </div>
          ) : null}
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_38%]">
          <div className="flex flex-col justify-center px-6 py-20 md:px-12 md:py-28 lg:px-16 lg:py-32">
            {eyebrow ? (
              <Reveal>
                <p className="label mb-10 opacity-50">{eyebrow}</p>
              </Reveal>
            ) : null}
            <Reveal delay={60}>
              <h1 className={titleClassName ?? "display-xl max-w-[14ch]"}>{title}</h1>
            </Reveal>
            {lede ? (
              <Reveal delay={140}>
                <p className="lede mt-10 max-w-2xl border-t border-hairline pt-8 opacity-80">
                  {lede}
                </p>
              </Reveal>
            ) : null}
            {body ? (
              <Reveal delay={180}>
                <div className="mt-6 max-w-2xl text-base opacity-70">{body}</div>
              </Reveal>
            ) : null}
            {actions?.length ? (
              <Reveal delay={240} className="mt-12 flex flex-wrap gap-4">
                {actions.map((action, index) => (
                  <Action
                    key={action.label}
                    to={action.to}
                    variant={index === 0 ? "solid" : "outline"}
                  >
                    {action.label}
                  </Action>
                ))}
              </Reveal>
            ) : null}
          </div>

          <div className="border-l border-hairline">
            {figureTo ? (
              <Link to={figureTo} aria-label={figureLabel} className="block h-full">
                {figure}
              </Link>
            ) : (
              figure
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
