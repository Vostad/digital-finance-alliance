import { cn } from "@/lib/utils";
import { srcSetFor, fallbackSrc, type MicrositePhoto as Photo } from "@/lib/microsite-photography";

/**
 * One photograph from the shared event set, delivered responsively.
 *
 * AVIF FIRST, JPEG BEHIND IT. Two formats, not three: AVIF carries every modern
 * browser at roughly half the bytes of JPEG, and JPEG covers the rest. A WebP
 * ladder in between would add a third copy of every file to earn almost nothing,
 * so there isn't one. The browser picks exactly one file per slot.
 *
 * NO LAYOUT SHIFT BY CONSTRUCTION. The image is absolutely positioned and fills
 * a parent that already reserves its own height — a fixed aspect-ratio box for
 * the grid figures, a min-height for the full-bleed frames. Space exists before
 * a byte arrives. `width`/`height` carry the master's intrinsic ratio so the
 * intent survives if this is ever used in normal flow.
 *
 * `<picture>` is display:contents so it introduces no box of its own; the layout
 * is exactly what a bare <img> produced before.
 */

type MicrositePhotoProps = {
  photo: Photo;
  /** Applied to the <img> — positioning, object-fit and the grayscale treatment. */
  className?: string;
  /** Below-the-fold images stay lazy; nothing here is above the fold. */
  loading?: "lazy" | "eager";
};

export function MicrositePhoto({ photo, className, loading = "lazy" }: MicrositePhotoProps) {
  return (
    <picture className="contents">
      <source type="image/avif" srcSet={srcSetFor(photo, "avif")} sizes={photo.sizes} />
      <img
        src={fallbackSrc(photo)}
        srcSet={srcSetFor(photo, "jpg")}
        sizes={photo.sizes}
        alt={photo.alt}
        width={photo.intrinsic.width}
        height={photo.intrinsic.height}
        loading={loading}
        // Decoded off the main thread so a large frame can never stall scrolling.
        decoding="async"
        className={cn("absolute inset-0 h-full w-full object-cover", className)}
      />
    </picture>
  );
}

/**
 * The grayscale resting state and its hover reveal.
 *
 * Tailwind gates `group-hover:` behind `@media (hover: hover)`, so touch devices
 * never enter the colour state and simply keep the grayscale image — no sticky
 * hover, no tap-to-colour. Only the filter transitions: no zoom, no movement, no
 * opacity change. 700ms on the project's standard easing.
 *
 * The Experience panels are deliberately NOT given this class. They already
 * carry the master's own hover treatment and are left exactly as they were.
 */
export const PHOTO_REVEAL =
  "grayscale transition-[filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:grayscale-0 motion-reduce:transition-none";
