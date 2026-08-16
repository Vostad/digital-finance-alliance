import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

/* ------------------------------------------------------------------ links */

type ActionProps = {
  children: ReactNode;
  to?: string;
  variant?: "solid" | "outline" | "outlineInvert" | "bare";
  className?: string;
};

export function Action({ children, to = "/contact", variant = "solid", className }: ActionProps) {
  const base =
    "group inline-flex items-center gap-4 label px-7 py-4 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]";
  // The outline variants name their hover fill AND their hover text. The
  // previous `hover:bg-current` filled the button with its own text colour, so
  // the label and arrow became ink-on-ink and disappeared on hover; the
  // mix-blend-difference that was meant to rescue them resolved to
  // |ink − ink| = black, which is the same invisible result.
  const styles = {
    solid: "bg-ink text-paper hover:bg-accent",
    /** On paper or bone. */
    outline: "border border-current text-ink hover:bg-ink hover:text-paper",
    /** The same button on ink. */
    outlineInvert: "border border-current text-paper hover:bg-paper hover:text-ink",
    bare: "px-0 py-2 hover:opacity-60",
  } as const;
  return (
    <Link to={to} className={cn(base, styles[variant], className)}>
      <span>{children}</span>
      <Arrow />
    </Link>
  );
}

export function Arrow({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block translate-x-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5",
        className,
      )}
    >
      →
    </span>
  );
}

/* ------------------------------------------------------------------ heads */

export function TitleBlock({
  eyebrow,
  title,
  body,
  aside,
  size = "lg",
}: {
  eyebrow?: string;
  title: string;
  body?: ReactNode;
  aside?: ReactNode;
  size?: "lg" | "md";
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-7">
        {eyebrow ? (
          <Reveal>
            <p className="label mb-8 opacity-50">{eyebrow}</p>
          </Reveal>
        ) : null}
        <Reveal delay={60}>
          <h2 className={size === "lg" ? "display-lg" : "display-md"}>{title}</h2>
        </Reveal>
      </div>
      <div className="lg:col-span-5 lg:pt-4">
        {body ? (
          <Reveal delay={120}>
            <div className="lede max-w-xl opacity-80">{body}</div>
          </Reveal>
        ) : null}
        {aside ? <Reveal delay={180}>{aside}</Reveal> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ stats */

export type Stat = { value: string; label: string; body?: string };

export function StatBand({ items, tone = "light" }: { items: Stat[]; tone?: "light" | "dark" }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <Reveal
          key={item.label}
          delay={index * 80}
          className={cn(
            "border-t px-0 py-8 sm:px-8 sm:first:pl-0 lg:border-t-0 lg:border-l lg:py-2 lg:first:border-l-0 lg:first:pl-0",
            tone === "dark" ? "border-hairline-invert" : "border-hairline",
          )}
        >
          {item.body ? <p className="label mb-4 opacity-45">{item.body}</p> : null}
          <p
            className="display-lg leading-none"
            style={{
              fontSize: `clamp(1.5rem, ${((2.6 * 10) / Math.max(item.value.length, 6)).toFixed(2)}vw, ${(25 / Math.max(item.value.length, 6.7)).toFixed(2)}rem)`,
            }}
          >
            {item.value}
          </p>

          <p className="display-sm mt-5">{item.label}</p>
        </Reveal>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ cards */

export function CardLink({
  index,
  title,
  body,
  cta,
  to = "/contact",
  newTab = false,
}: {
  index?: string;
  title: string;
  body?: string;
  cta?: string;
  to?: string;
  /** Opens the card in a new tab, leaving this page in the original one.
      Used where a card enters a self-contained event micro-site. */
  newTab?: boolean;
}) {
  const className =
    "group relative flex min-h-[19rem] flex-col justify-between border-b border-l border-hairline p-8 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-ink hover:text-paper md:p-10";
  const inner = (
    <>
      {index ? <span className="label opacity-40">{index}</span> : null}
      <div className="mt-10">
        <h3 className="display-sm max-w-[18ch]">{title}</h3>
        {body ? <p className="mt-5 max-w-[42ch] text-sm opacity-70">{body}</p> : null}
      </div>
      {cta ? (
        <span className="label mt-10 inline-flex items-center gap-3">
          {cta} <Arrow />
        </span>
      ) : null}
    </>
  );

  // A plain anchor, so the browser owns the new-tab behaviour rather than the
  // router intercepting the click.
  if (newTab) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }

  return (
    <Link to={to} className={className}>
      {inner}
    </Link>
  );
}

export function CardGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div
      className={cn(
        "grid border-t border-hairline sm:grid-cols-2",
        cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2",
      )}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- listing */

export function TagList({ items, tone = "light" }: { items: string[]; tone?: "light" | "dark" }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <Reveal
          as="li"
          key={item}
          delay={(index % 3) * 60}
          className={cn(
            "group flex items-baseline gap-5 border-b py-5 pr-6 transition-opacity duration-500 hover:opacity-50",
            tone === "dark" ? "border-hairline-invert" : "border-hairline",
          )}
        >
          <span className="label opacity-30">{String(index + 1).padStart(2, "0")}</span>
          <span className="display-sm">{item}</span>
        </Reveal>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------- faq */

export function Faq({
  items,
  tone = "light",
}: {
  items: { q: string; a: string }[];
  tone?: "light" | "dark";
}) {
  return (
    <div className="border-t border-current/10">
      {items.map((item, index) => (
        <details
          key={item.q}
          className={cn(
            "group border-b",
            tone === "dark" ? "border-hairline-invert" : "border-hairline",
          )}
        >
          <summary className="flex cursor-pointer list-none items-baseline justify-between gap-8 py-7 transition-opacity duration-500 hover:opacity-60 [&::-webkit-details-marker]:hidden">
            <span className="flex items-baseline gap-5">
              <span className="label opacity-30">{String(index + 1).padStart(2, "0")}</span>
              <span className="display-sm max-w-[34ch]">{item.q}</span>
            </span>
            <span
              aria-hidden
              className="text-2xl leading-none transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="max-w-3xl pb-8 pl-0 text-base opacity-70 sm:pl-14">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- figure */

/** Placeholder photography. Every image is intended to be replaced later. */
export function Figure({
  seed,
  ratio = "4 / 3",
  caption,
  overlay,
  className,
}: {
  seed: string;
  ratio?: string;
  caption?: string;
  overlay?: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("group relative overflow-hidden bg-bone", className)}>
      <div style={{ aspectRatio: ratio }} className="relative overflow-hidden">
        <img
          src={`https://picsum.photos/seed/${seed}/1400/1050`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover grayscale transition-[transform,filter] duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] group-hover:grayscale-0"
        />
        {overlay ? (
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink/80 via-ink/10 to-transparent p-6 text-paper md:p-8">
            {overlay}
          </div>
        ) : null}
      </div>
      {caption ? <figcaption className="label mt-4 opacity-50">{caption}</figcaption> : null}
    </figure>
  );
}

/* ---------------------------------------------------------------- marquee */

export function Marquee({ items }: { items: string[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-hairline py-8">
      <div className="marquee-track flex w-max items-center gap-16 pr-16">
        {doubled.map((item, index) => (
          <span key={`${item}-${index}`} className="display-sm whitespace-nowrap opacity-35">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- final cta */

export function FinalCta({
  title,
  body,
  actions,
}: {
  title: string;
  body: string;
  actions: { label: string; to: string }[];
}) {
  return (
    <section className="border-t border-hairline-invert bg-ink text-paper">
      <div className="grid lg:grid-cols-[6rem_1fr]">
        <div className="hidden border-r border-hairline-invert lg:block" />
        <div className="px-6 py-24 md:px-12 md:py-32 lg:px-16 lg:py-40">
          <div className="grid gap-12 lg:grid-cols-12">
            <Reveal className="lg:col-span-7">
              <h2 className="display-lg max-w-[16ch]">{title}</h2>
            </Reveal>
            <div className="lg:col-span-5 lg:pt-3">
              <Reveal delay={100}>
                <p className="lede max-w-lg opacity-70">{body}</p>
              </Reveal>
              <Reveal delay={180} className="mt-10 flex flex-wrap gap-4">
                {actions.map((action, index) => (
                  <Action
                    key={action.label}
                    to={action.to}
                    variant={index === 0 ? "solid" : "outlineInvert"}
                    className={
                      index === 0 ? "bg-paper text-ink hover:bg-accent hover:text-paper" : ""
                    }
                  >
                    {action.label}
                  </Action>
                ))}
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
