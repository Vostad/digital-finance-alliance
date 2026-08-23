import { Reveal } from "./Reveal";

/**
 * Typographic page opener: an oversized title sitting over a near-invisible
 * ghost wordmark. No image, no copy — the word itself is the composition.
 * The ghost is far wider than the viewport, so both the section and the
 * content column clip it and the column carries min-w-0.
 */
export function PageOpener({
  meta,
  title,
  ghost = "Financial Rails",
  /** Standard scale. Titles with a word too long to fit the column pass a
      smaller step so the word is never clipped. */
  titleSize = "text-[clamp(3.5rem,15vw,15rem)]",
}: {
  meta: string;
  title: string;
  ghost?: string;
  titleSize?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-paper pt-20">
      <div className="grid lg:grid-cols-[6rem_minmax(0,1fr)]">
        <div className="hidden border-r border-hairline lg:block">
          <div className="flex h-full items-end justify-center pb-16">
            <span
              className="label whitespace-nowrap opacity-40"
              style={{ writingMode: "vertical-rl" }}
            >
              {meta}
            </span>
          </div>
        </div>

        <div className="relative min-w-0 overflow-hidden px-6 py-24 md:px-12 md:py-32 lg:px-16 lg:py-40">
          <span
            aria-hidden
            className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 select-none whitespace-nowrap font-display text-[clamp(7rem,27vw,27rem)] font-extrabold uppercase leading-none tracking-[-0.04em] text-ink/[0.045] md:left-12 lg:left-16"
          >
            {ghost}
          </span>
          <Reveal>
            <h1
              className={`relative font-display ${titleSize} font-extrabold uppercase leading-[0.82] tracking-[-0.045em]`}
            >
              {title}
            </h1>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
