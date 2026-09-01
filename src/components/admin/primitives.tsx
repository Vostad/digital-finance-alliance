/**
 * ADMIN UI PRIMITIVES — §20.
 *
 * A lean operating system, not a marketing page. The whole vocabulary is here:
 * a shell, a stat, a table, a pill, a field. Anything a screen needs beyond
 * these is probably decoration.
 *
 * THE TYPE FLOOR IS 13px AND IT IS ENFORCED HERE, not remembered per screen.
 * `TEXT.micro` is 13px and nothing in this file is smaller. Uppercase labels
 * get letter-spacing because dense uppercase at 13px is otherwise a wall.
 *
 * Colour, type and rules come from the platform tokens the public site already
 * uses — ink / paper / bone / hairline, Archivo and IBM Plex — so the OS reads
 * as the same institution rather than a bolted-on admin panel.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The complete type scale. Nothing below 13px exists. */
export const TEXT = {
  /** 13px — the floor. Table cells, meta, secondary detail. */
  micro: "text-[13px] leading-[1.45]",
  /** 13px uppercase, tracked. Column headers and section labels. */
  label: "font-mono text-[13px] uppercase tracking-[0.12em]",
  /** 14px — the default reading size for dense data. */
  body: "text-[14px] leading-[1.5]",
  /** 15px — emphasis inside a row. */
  strong: "text-[15px] leading-[1.45] font-medium",
  /** Figures. Tabular so columns of numbers line up. */
  figure: "font-display text-[26px] font-bold leading-none tabular-nums tracking-[-0.02em]",
  figureSm: "font-display text-[19px] font-bold leading-none tabular-nums tracking-[-0.015em]",
  heading: "font-display text-[17px] font-bold uppercase leading-[1.15] tracking-[-0.01em]",
  page: "font-display text-[22px] font-extrabold uppercase leading-[1.05] tracking-[-0.02em]",
} as const;

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(TEXT.label, "text-ink/55", className)}>{children}</span>;
}

/**
 * A headline figure.
 *
 * `hint` carries the sentence that stops a number being misread — "excludes
 * cancelled", "forecast, not committed". A figure without its qualification is
 * how a dashboard starts lying.
 */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
  tone?: "default" | "urgent" | "muted" | undefined;
}) {
  return (
    <div className="min-w-0 border-r border-hairline px-4 py-3 last:border-r-0">
      <Label>{label}</Label>
      <div
        className={cn(
          TEXT.figure,
          "mt-2",
          tone === "urgent" && "text-[var(--accord-orange-deep)]",
          tone === "muted" && "text-ink/45",
        )}
      >
        {value}
      </div>
      {hint ? <p className={cn(TEXT.micro, "mt-1.5 text-ink/50")}>{hint}</p> : null}
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 border-y border-hairline sm:grid-cols-3 lg:grid-cols-5">
      {children}
    </div>
  );
}

/** A section with a rule and a label. The only structural device in the OS. */
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <header className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2">
        <h2 className={cn(TEXT.heading, "text-ink")}>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/**
 * A dense table. Horizontal scroll lives on the wrapper, never the page —
 * a body that scrolls sideways makes every other column unreachable.
 */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <table className="w-full min-w-[40rem] border-collapse">
        <thead>
          <tr className="border-b border-hairline">
            {head.map((h) => (
              <th key={h} className={cn(TEXT.label, "px-3 py-2 text-left font-normal text-ink/55")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-hairline align-top",
        onClick && "cursor-pointer transition-colors hover:bg-ink/[0.035]",
      )}
    >
      {children}
    </tr>
  );
}

export function Cell({
  children,
  className,
  numeric,
}: {
  children: ReactNode;
  className?: string;
  numeric?: boolean;
}) {
  /* 14px, not the 13px floor. A table of fifty cells all at the minimum is
     dense without hierarchy — legal under §20 and unpleasant to scan. Labels
     and meta stay at 13, data sits one step above them. */
  return (
    <td className={cn(TEXT.body, "px-3 py-2.5", numeric && "text-right tabular-nums", className)}>
      {children}
    </td>
  );
}

/** Status, as a shape as well as a word — §20's "encode state in form". */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "open" | "won" | "lost" | "attention";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap border px-1.5 py-0.5 font-mono text-[13px] uppercase leading-none tracking-[0.06em]",
        tone === "neutral" && "border-hairline text-ink/60",
        tone === "open" && "border-ink/25 text-ink",
        tone === "won" && "border-ink bg-ink text-paper",
        tone === "lost" && "border-hairline text-ink/40 line-through",
        tone === "attention" &&
          "border-[var(--accord-orange-deep)] text-[var(--accord-orange-deep)]",
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap px-4 py-2 font-mono text-[13px] uppercase tracking-[0.1em] transition-colors disabled:opacity-50",
        variant === "primary" && "bg-ink text-paper hover:bg-ink/85",
        variant === "secondary" && "border border-ink text-ink hover:bg-ink hover:text-paper",
        variant === "quiet" && "text-ink/60 hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string | undefined;
  required?: boolean | undefined;
}) {
  return (
    <label className="block min-w-0">
      <span className={cn(TEXT.label, "text-ink/60")}>
        {label}
        {required ? <span className="ml-1 text-[var(--accord-orange-deep)]">*</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className={cn(TEXT.micro, "mt-1 text-ink/50")}>{hint}</p> : null}
    </label>
  );
}

/** 16px on the input itself: anything smaller makes iOS Safari zoom the page
    on focus, which on mobile reads as the layout breaking. */
export const INPUT =
  "w-full border border-hairline bg-paper px-3 py-2 text-[16px] leading-[1.4] text-ink outline-none transition-colors focus:border-ink md:text-[14px]";

/** Money, rendered once, the same way everywhere. */
export function money(value: number | string | null | undefined, currency = "USD") {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * A rate, or the honest refusal to state one.
 *
 * §12: below the sample threshold this returns NOT ENOUGH DATA rather than a
 * percentage the data cannot support.
 */
export function rate(r: { value: number | null; numerator: number; denominator: number } | null) {
  if (!r) return "—";
  if (r.value == null) return `NOT ENOUGH DATA (${r.numerator}/${r.denominator})`;
  return `${Math.round(r.value * 100)}%`;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className={cn(TEXT.body, "py-6 text-ink/50")}>{children}</p>;
}
