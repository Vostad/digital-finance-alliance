/**
 * Continuous partner and client logo marquee.
 *
 * Pass `logos` to render real marks; without it the placeholder bars remain,
 * so the pages that have not been given a roster yet are untouched.
 *
 * The track is rendered twice because the marquee keyframe translates -50%;
 * anything else breaks the seamless loop.
 */
export function LogoMarquee({ count = 10, logos }: { count?: number; logos?: string[] }) {
  const tiles = logos
    ? [...logos, ...logos]
    : Array.from({ length: count * 2 }, (_, index) => index);
  return (
    <div className="relative overflow-hidden border-y border-hairline py-10">
      <div className="marquee-track flex w-max items-center gap-6 pr-6">
        {tiles.map((tile, index) => (
          <div
            key={typeof tile === "string" ? `${tile}-${index}` : tile}
            className="group flex h-16 w-44 shrink-0 items-center justify-center border border-hairline bg-bone"
            aria-hidden
          >
            {typeof tile === "string" ? (
              /* Capped on BOTH axes so a 7.25:1 wordmark and a 1.86:1 roundel
                 carry comparable visual weight inside the same slot. The mark
                 itself is the only thing that changes on hover — the slot keeps
                 its bone fill and hairline in both states. */
              <img
                src={tile}
                alt=""
                loading="lazy"
                className="max-h-9 max-w-[8.5rem] object-contain grayscale transition-[filter] duration-500 group-hover:grayscale-0"
              />
            ) : (
              <span className="h-2 w-16 bg-ink/15" />
            )}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-paper to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-paper to-transparent" />
    </div>
  );
}

/** Portrait grid used for speakers, members and honourees. */
export function PortraitGrid({ seedPrefix, count = 8 }: { seedPrefix: string; count?: number }) {
  const items = Array.from({ length: count }, (_, index) => index);
  return (
    <div className="grid grid-cols-2 border-l border-t border-hairline sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item} className="group border-b border-r border-hairline">
          <div className="relative overflow-hidden" style={{ aspectRatio: "4 / 5" }}>
            <img
              src={`https://picsum.photos/seed/${seedPrefix}-${item}/800/1000`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover grayscale transition-[transform,filter] duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] group-hover:grayscale-0"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
