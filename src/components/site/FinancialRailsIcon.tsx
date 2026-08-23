import { cn } from "@/lib/utils";

/**
 * The official Financial Rails master brand icon.
 *
 * GEOMETRY IS THE CONSTANT. The mark itself is unchanged by the institution's
 * rename — only the wordmark beside it carries the name, and it lives in the
 * two navigation lockups, not here, so a future wordmark asset can replace
 * that text without touching this artwork.
 *
 *   default        → white
 *   hover / focus  → orange
 *
 * Both states are the supplied PNG artwork. The colour change is an image
 * swap, never a CSS filter, hue-rotate, blend mode or tint — the mark's
 * geometry and proportions are identical in both states.
 *
 * The two files below are renditions of the master assets in
 * /public/brand/favicon-white.png and /public/brand/favicon-orange.png,
 * resized (not redrawn, recoloured or cropped) to 144px tall so a 36px header
 * icon does not ship 340KB of artwork on every page load. To serve the masters
 * directly instead, point these two constants at /brand/favicon-{white,orange}.png.
 *
 * USAGE: the interactive ancestor must carry Tailwind's `group` class, because
 * hover and focus live on the link, not on the icon. The icon is aria-hidden —
 * the adjacent wordmark already names the link, and a second label
 * here would be read out twice.
 */

const ICON_WHITE = "/brand/icon-white-144.png";
const ICON_ORANGE = "/brand/icon-orange-144.png";

/** Intrinsic rendition size, declared so the icon reserves its box before load. */
const W = 164;
const H = 144;

export function FinancialRailsIcon({
  className,
  onPhotography = false,
}: {
  className?: string;
  /**
   * Set when the icon sits directly on a photograph — a transparent header
   * over a hero image, for example. Orange is a brand signal, not a
   * photography colour, so the icon then holds white through hover and focus.
   * The background decides the interaction, not the component.
   */
  onPhotography?: boolean;
}) {
  return (
    // inline-flex with a definite height: `h-full` on the layers resolves
    // against it, so the artwork is driven by the height and the width follows
    // the aspect ratio. A grid here would size its row to the intrinsic 144px
    // and overflow the box.
    <span aria-hidden className={cn("relative inline-flex h-9 shrink-0", className)}>
      <img
        src={ICON_ORANGE}
        width={W}
        height={H}
        alt=""
        draggable={false}
        className="h-full w-auto select-none"
      />
      {/* The white mark sits on top and simply gets out of the way, revealing
          the orange already painted beneath. Fading one layer over an opaque
          one avoids the muddy midpoint a two-way crossfade would produce.
          It is positioned against the box the orange layer just established,
          so the two can never drift out of register. */}
      <img
        src={ICON_WHITE}
        width={W}
        height={H}
        alt=""
        draggable={false}
        className={cn(
          "absolute inset-y-0 left-0 h-full w-auto select-none",
          "transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          // Over photography the white mark never steps aside, so the orange
          // beneath is never revealed.
          !onPhotography && [
            // Tailwind v4 already emits group-hover inside @media (hover: hover)
            // (verified in the built stylesheet), so a tap on a touch device
            // cannot strand the icon orange the way a sticky :hover would.
            "group-hover:opacity-0",
            // Keyboard focus gets the same state as hover; touch gets it only
            // for as long as the press lasts.
            "group-focus-visible:opacity-0 group-active:opacity-0",
          ],
        )}
      />
    </span>
  );
}
