import { cn } from "@/lib/utils";
import { DIGITAL_FINANCE_FEATURED_LOGOS } from "@/lib/digital-asset-accord-logos";

/**
 * The network marquee: the eighty-mark Digital Finance Alliance network as
 * continuous single-direction streams. One system, two contexts — the
 * homepage runs it on the brand light ground, Financial Rails V2 on dark —
 * both from the same curated set, so the surfaces can never disagree while
 * staying visually distinct.
 *
 * ROWS. `rows` splits the roster by interleaving (mark 1 → row 1, mark 2 →
 * row 2, …), so the sectors spread across both lanes rather than clustering.
 * Both rows share ONE direction and ONE speed, and each starts a half-cycle
 * out of phase (a negative animation-delay) so the two streams never mirror
 * each other — one ecosystem, two currents, not two sliders.
 *
 * SEAMLESS BY CONSTRUCTION. Each track renders its row twice and the shared
 * `aa-marquee` keyframe translates it exactly -50%; because the first copy
 * ends with the same trailing gap the second begins after (`pr` equals the
 * gap), the loop point is pixel-identical to frame zero — no jump, no blank,
 * no visible reset. Pure CSS transforms, no JavaScript.
 *
 * SPEED. Three seconds per mark, so every row travels at the same px/s
 * regardless of how many marks it carries.
 *
 * TONE. The supplied artwork is WHITE on transparency — measured across the
 * set, the opaque pixels average ~250 luminance. On dark ground the marks
 * render exactly as supplied. On the light ground a non-destructive CSS
 * luminance inversion (`grayscale invert`) turns the white artwork dark,
 * producing the required dark-monochrome-on-light result without touching a
 * single file. That is what keeps the two surfaces deliberately different.
 *
 * SIZE. The marks come from the trimmed renditions, whose canvas is the ink
 * box itself; the padded 400×200 originals put the mark at a third of the
 * canvas height, which is why they read small however large the cell. Height
 * is capped and width follows each mark, so a wordmark and a roundel carry
 * the same optical weight without being forced into one rectangle.
 *
 * PRESENCE. Two registers of the same field. `standard` is the scale the
 * Financial Rails V2 partner chapter was approved at, where the marks are the
 * chapter's whole argument. `quiet` steps the cap down and opens the gutters,
 * for the homepage, where the marks are supporting evidence beneath the
 * speaker gallery and must not compete with it. Only cap and gutter change —
 * the roster, the motion and the loop are identical.
 *
 * THE GUTTER AND THE TRAILING PAD MOVE TOGETHER. `pr` must always equal `gap`
 * or the -50% loop point stops being pixel-identical and the row visibly
 * jumps, so the two are written as one pair per register and never separately.
 *
 * ACCESSIBILITY. The source files are numbered, not named, so there are no
 * organisation names to announce and none may be invented: every mark carries
 * empty alt, each duplicate pass is aria-hidden, and the heading above the
 * field carries the claim. Under reduced motion the shared stylesheet stops
 * every row and each becomes a static, horizontally scrollable strip.
 *
 * PERFORMANCE. Thirty-two unique PNGs, all lazy; the duplicate pass reuses the
 * same URLs so nothing is fetched twice, and the row height is fixed by the
 * height cap so nothing shifts as they load.
 */
const PRESENCE = {
  standard: {
    mark: "max-h-8 sm:max-h-9 lg:max-h-11",
    track: "gap-10 pr-10 sm:gap-12 sm:pr-12 lg:gap-14 lg:pr-14",
    lanes: "gap-y-9 lg:gap-y-11",
  },
  quiet: {
    mark: "max-h-7 sm:max-h-8 lg:max-h-9",
    track: "gap-12 pr-12 sm:gap-14 sm:pr-14 lg:gap-16 lg:pr-16",
    lanes: "gap-y-8 lg:gap-y-10",
  },
} as const;

export function NetworkMarquee({
  tone = "light",
  rows = 2,
  logos = DIGITAL_FINANCE_FEATURED_LOGOS,
  presence = "standard",
}: {
  tone?: "light" | "dark";
  rows?: number;
  logos?: string[];
  presence?: keyof typeof PRESENCE;
}) {
  const dark = tone === "dark";
  const scale = PRESENCE[presence];
  const lanes = Array.from({ length: rows }, (_, r) => logos.filter((_, i) => i % rows === r));
  return (
    <div
      className={cn(
        "relative border-y py-10 lg:py-11",
        dark ? "border-hairline-invert" : "border-hairline",
      )}
    >
      <div className={cn("flex flex-col", scale.lanes)}>
        {lanes.map((lane, r) => {
          const duration = lane.length * 3;
          return (
            <div key={r} className="overflow-hidden motion-reduce:overflow-x-auto">
              <div
                className={cn("marquee-track flex w-max items-center", scale.track)}
                style={{
                  animationDuration: `${duration}s`,
                  animationDelay: `${-((duration * r) / Math.max(rows, 1))}s`,
                }}
              >
                {[...lane, ...lane].map((src, index) => (
                  <img
                    key={`${src}-${index}`}
                    src={src}
                    alt=""
                    {...(index < lane.length ? {} : { "aria-hidden": true })}
                    width={400}
                    height={200}
                    loading="lazy"
                    decoding="async"
                    className={cn(
                      "w-auto shrink-0 object-contain",
                      scale.mark,
                      dark ? "opacity-85" : "opacity-85 grayscale invert",
                    )}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {/* The ground reappears at both edges of the whole field so marks enter
          and leave rather than being cut off — legibility scrims spanning
          every row, not decoration. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r to-transparent lg:w-28",
          dark ? "from-ink" : "from-paper",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l to-transparent lg:w-28",
          dark ? "from-ink" : "from-paper",
        )}
      />
    </div>
  );
}
