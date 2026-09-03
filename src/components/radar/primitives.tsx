/**
 * RAILS RADAR — the UI vocabulary.
 *
 * Radar is a tool, not a page. It borrows the platform's tokens — ink, paper,
 * bone, hairline, Archivo and IBM Plex, `--radius: 0rem` — so it reads as the
 * same institution, but it is laid out like the admin OS rather than the
 * editorial site: tables and structured cards, never prose.
 *
 * NO REVEAL ANIMATIONS HERE, deliberately. The public site fades sections in on
 * scroll; a treasury team checking a cut-off time should not wait for a
 * transition to read a number. Everything renders immediately.
 *
 * THE ONE IDEA THIS FILE EXISTS TO ENFORCE: a figure and its provenance are the
 * same object. `SourcedField` cannot render a value without also rendering
 * where it came from and when it was checked, because it takes them together.
 * A field with no value prints "Not published" — never a guess, never a range,
 * never "typically", never a figure derived from another figure.
 */

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** The type scale. Mirrors the admin OS: 13px floor, tabular figures. */
export const T = {
  micro: "text-[13px] leading-[1.45]",
  label: "font-mono text-[11px] uppercase tracking-[0.14em]",
  body: "text-[14px] leading-[1.55]",
  strong: "text-[15px] leading-[1.45] font-medium",
  /** Right-aligned wherever it carries a number. Tabular so columns line up. */
  figure: "font-mono text-[14px] tabular-nums",
  heading: "font-display text-[17px] font-bold uppercase leading-[1.15] tracking-[-0.01em]",
  page: "font-display text-[26px] font-extrabold uppercase leading-[1.05] tracking-[-0.02em]",
} as const;

/* ------------------------------------------------------------ provenance -- */

/**
 * THE HONEST ABSENCE.
 *
 * Rendered wherever a provider has not published a figure. It is deliberately
 * plain and deliberately not apologetic — "Not published" is a finding, not a
 * gap. A platform that says this where every competitor guesses is the one a
 * treasury team can act on.
 */
export function NotPublished({ className }: { className?: string }) {
  return (
    <span className={cn(T.micro, "text-ink/40 italic", className)} title="No published source">
      Not published
    </span>
  );
}

export type Sourced = {
  value: string;
  sourceUrl: string;
  verifiedAt: Date | string | null;
  verifiedBy?: string | null;
} | null;

export function formatDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * A labelled fact, with its source attached.
 *
 * There is no way to call this with a value and no source: the `Sourced` type
 * carries both or is null. That is the spec's provenance rule expressed where
 * it cannot be forgotten — in the component's signature.
 */
export function SourcedField({
  label,
  field,
  numeric = false,
  className,
}: {
  label: string;
  field: Sourced;
  numeric?: boolean;
  className?: string;
}) {
  const verified = formatDate(field?.verifiedAt ?? null);
  return (
    <div className={cn("min-w-0", className)}>
      <p className={cn(T.label, "accord-signal text-ink/55")}>{label}</p>
      {field ? (
        <>
          <p
            className={cn(
              numeric ? cn(T.figure, "text-right tabular-nums") : T.body,
              "mt-1 text-ink",
            )}
          >
            {field.value}
          </p>
          <p className={cn(T.micro, "mt-1 text-ink/45")}>
            <a
              href={field.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline decoration-ink/25 underline-offset-2 transition-colors hover:text-[var(--accord-orange-deep)] hover:decoration-[var(--accord-orange-deep)]"
            >
              Source
            </a>
            {verified ? <span> · Verified {verified}</span> : null}
          </p>
        </>
      ) : (
        <p className="mt-1">
          <NotPublished />
        </p>
      )}
    </div>
  );
}

/**
 * PER-RECORD verification. There is no global "Data verified: Today" badge in
 * this product and there must never be one — the claim is false the moment a
 * single row goes stale.
 */
export function VerifiedStamp({
  at,
  by,
  sourceUrl,
}: {
  at: Date | string | null;
  by?: string | null;
  sourceUrl?: string | null;
}) {
  const when = formatDate(at);
  return (
    <p className={cn(T.micro, "text-ink/45")}>
      {when ? (
        <>
          Last verified {when}
          {by ? ` by ${by}` : ""}
        </>
      ) : (
        <span className="italic">Not yet verified</span>
      )}
      {sourceUrl ? (
        <>
          {" · "}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline decoration-ink/25 underline-offset-2 transition-colors hover:text-[var(--accord-orange-deep)]"
          >
            Source
          </a>
        </>
      ) : null}
    </p>
  );
}

/* ---------------------------------------------------------------- layout -- */

export function Breadcrumbs({ trail }: { trail: Array<{ label: string; to?: string }> }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(T.label, "flex flex-wrap items-center gap-2 text-ink/45")}
    >
      {trail.map((c, i) => (
        <span key={`${c.label}-${i}`} className="flex items-center gap-2">
          {i > 0 ? (
            <span aria-hidden className="text-ink/25">
              /
            </span>
          ) : null}
          {c.to ? (
            <Link to={c.to} className="transition-colors hover:text-[var(--accord-orange-deep)]">
              {c.label}
            </Link>
          ) : (
            <span className="text-ink/70">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

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
        <h2 className={cn(T.heading, "text-ink")}>{title}</h2>
        {action}
      </header>
      <div className="pt-4">{children}</div>
    </section>
  );
}

/** A list of short values. Interpunct-separated, as the spec asks. */
export function Values({ items, empty = "Not published" }: { items: string[]; empty?: string }) {
  if (items.length === 0) {
    return empty === "Not published" ? (
      <NotPublished />
    ) : (
      <span className={cn(T.micro, "text-ink/40")}>{empty}</span>
    );
  }
  return (
    <span className={cn(T.body, "text-ink")}>
      {items.map((v, i) => (
        <span key={v}>
          {i > 0 ? <span className="text-ink/25"> · </span> : null}
          {v}
        </span>
      ))}
    </span>
  );
}

/** Licences always render with the register they appear on. Never without. */
export function Licences({
  licences,
}: {
  licences: Array<{ id: string; name: string; registerUrl: string; jurisdiction: string | null }>;
}) {
  if (licences.length === 0) {
    return (
      <span className={cn(T.micro, "text-ink/40 italic")}>
        No licences verified yet — if you have a source, submit it.
      </span>
    );
  }
  return (
    <span className={cn(T.body, "text-ink")}>
      {licences.map((l, i) => (
        <span key={l.id}>
          {i > 0 ? <span className="text-ink/25"> · </span> : null}
          <a
            href={l.registerUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline decoration-ink/25 underline-offset-2 transition-colors hover:text-[var(--accord-orange-deep)] hover:decoration-[var(--accord-orange-deep)]"
            title={`Register entry${l.jurisdiction ? ` — ${l.jurisdiction}` : ""}`}
          >
            {l.name}
          </a>
          {l.jurisdiction ? <span className="text-ink/45"> ({l.jurisdiction})</span> : null}
        </span>
      ))}
    </span>
  );
}

/* ----------------------------------------------------------------- table -- */

export function Table({
  head,
  children,
}: {
  head: Array<{ label: string; numeric?: boolean }>;
  children: ReactNode;
}) {
  return (
    <div className="-mx-6 overflow-x-auto px-6 md:mx-0 md:px-0">
      <table className="w-full min-w-[44rem] border-collapse">
        <thead>
          <tr className="border-b border-hairline">
            {head.map((h) => (
              <th
                key={h.label}
                className={cn(
                  T.label,
                  "px-3 py-2 font-normal text-ink/55",
                  h.numeric ? "text-right" : "text-left",
                )}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <tr className="border-b border-hairline last:border-b-0">{children}</tr>;
}

export function Cell({
  children,
  numeric = false,
  className,
}: {
  children: ReactNode;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-3 py-3 align-top",
        numeric ? cn(T.figure, "text-right") : T.body,
        className,
      )}
    >
      {children}
    </td>
  );
}

/* ---------------------------------------------------------------- inputs -- */

export const INPUT =
  "w-full border border-hairline bg-paper px-3 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-[var(--accord-orange-deep)]";

export function Button({
  children,
  type = "button",
  variant = "solid",
  disabled,
  onClick,
  className,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  variant?: "solid" | "outline";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.12em] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40",
        variant === "solid"
          ? "bg-ink text-paper hover:bg-[var(--accord-orange-deep)]"
          : "border border-ink/25 text-ink hover:border-[var(--accord-orange-deep)] hover:text-[var(--accord-orange-deep)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- skeleton -- */

/** Skeleton, not a spinner. A spinner says "wait"; a skeleton says what is
    arriving and holds the layout still when it does. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-[52px] animate-pulse border border-hairline bg-bone" />
      ))}
    </div>
  );
}
