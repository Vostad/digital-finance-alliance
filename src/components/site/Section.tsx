import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionProps = {
  label?: string;
  /**
   * The rail label's type class. Defaults to the site's 11px `label`, so
   * every existing page renders exactly as before; a page with a higher type
   * floor passes its own. Additive only — nothing here changes without it.
   */
  labelClassName?: string;
  children: ReactNode;
  tone?: "paper" | "bone" | "ink";
  className?: string;
  id?: string;
  flush?: boolean;
};

/**
 * The page's structural unit: a hairline-separated band with a vertical
 * index label running down the left rail, echoing an editorial spread.
 */
export function Section({
  label,
  labelClassName = "label",
  children,
  tone = "paper",
  className,
  id,
  flush = false,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative border-t",
        tone === "ink" && "bg-ink text-paper border-hairline-invert",
        tone === "bone" && "bg-bone text-ink border-hairline",
        tone === "paper" && "bg-paper text-ink border-hairline",
        className,
      )}
    >
      <div className="grid lg:grid-cols-[6rem_minmax(0,1fr)]">
        <div
          className={cn(
            "hidden lg:block border-r",
            tone === "ink" ? "border-hairline-invert" : "border-hairline",
          )}
        >
          {label ? (
            <div className="sticky top-32 flex justify-center py-10">
              <span
                className={cn(labelClassName, "opacity-40 whitespace-nowrap")}
                style={{ writingMode: "vertical-rl" }}
              >
                {label}
              </span>
            </div>
          ) : null}
        </div>
        {/* min-w-0: a grid item's automatic minimum is its min-content width, so
            without this the clipped marquee track inflates the column — and with
            it the page — at every breakpoint. */}
        <div
          className={cn("min-w-0", flush ? "" : "px-6 py-20 md:px-12 md:py-28 lg:px-16 lg:py-32")}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("label opacity-50", className)}>{children}</p>;
}

export function Rule({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-current opacity-10", className)} />;
}
