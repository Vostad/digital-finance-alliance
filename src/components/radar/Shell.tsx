/**
 * THE RADAR SHELL — header, breadcrumbs, footer.
 *
 * One header, one footer, on every Radar page. The header carries the product
 * name and a single utility link; nothing competes with the page's own content.
 *
 * THE FOOTER IS NOT DECORATION. It carries two things the product is obliged to
 * say and one it is obliged not to fake:
 *
 *   · the privacy notice, because Radar collects an email address on two forms
 *   · the disclosure that those addresses are used for verification follow-up
 *     only and are not shared
 *   · counts that come from ACTUAL ROWS, or do not render at all
 *
 * That last one matters more than it looks. "127 rails tracked" hardcoded into
 * a footer is the first lie a data product tells, and every other number on the
 * page inherits its credibility from it. If the database is empty these read
 * zero, and zero is the truthful thing for them to say.
 */

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Breadcrumbs, T } from "./primitives";

export type RadarCounts = {
  rails: number;
  providers: number;
  corridors: number;
  routes: number;
} | null;

export function RadarShell({
  trail,
  counts,
  children,
}: {
  trail?: Array<{ label: string; to?: string }>;
  counts?: RadarCounts;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-[76rem] items-baseline justify-between gap-6 px-6 py-5 md:px-10">
          <Link to="/radar" className="group flex items-baseline gap-3">
            <span className="font-display text-[18px] font-extrabold uppercase leading-none tracking-[-0.02em]">
              Rails Radar
            </span>
            <span className={cn(T.label, "hidden text-ink/45 sm:inline")}>
              Intelligence Layer for Moving Money
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              to="/radar/corridors"
              className={cn(
                T.label,
                "text-ink/55 transition-colors hover:text-[var(--accord-orange-deep)]",
              )}
            >
              Corridors
            </Link>
            <Link
              to="/contact"
              className={cn(
                T.label,
                "text-ink/55 transition-colors hover:text-[var(--accord-orange-deep)]",
              )}
            >
              Contact
            </Link>
          </nav>
        </div>
      </header>

      {trail && trail.length > 0 ? (
        <div className="border-b border-hairline bg-bone/60">
          <div className="mx-auto max-w-[76rem] px-6 py-3 md:px-10">
            <Breadcrumbs trail={trail} />
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-[76rem] flex-1 px-6 py-10 md:px-10 md:py-14">
        {children}
      </main>

      <RadarFooter counts={counts ?? null} />
    </div>
  );
}

export function RadarFooter({ counts }: { counts: RadarCounts }) {
  return (
    <footer className="border-t border-hairline bg-bone">
      <div className="mx-auto max-w-[76rem] px-6 py-10 md:px-10">
        {/* Counts render from real rows, or not at all. Never a placeholder. */}
        {counts ? (
          <p className={cn(T.micro, "text-ink/60")}>
            <span className="font-mono tabular-nums">{counts.rails}</span> rails tracked
            <span className="text-ink/25"> · </span>
            <span className="font-mono tabular-nums">{counts.providers}</span> providers
            <span className="text-ink/25"> · </span>
            <span className="font-mono tabular-nums">{counts.corridors}</span> corridors
            <span className="text-ink/25"> · </span>
            <span className="font-mono tabular-nums">{counts.routes}</span> routes
          </p>
        ) : null}

        <div className="mt-6 border-t border-hairline pt-6">
          <p className={cn(T.micro, "max-w-3xl text-ink/55")}>
            Email addresses submitted via “Submit a source” or “Report inaccuracy” are used only for
            verification follow-up and are not shared with third parties.
          </p>
          <p className={cn(T.micro, "mt-3 text-ink/45")}>
            <Link
              to="/radar/privacy"
              className="underline decoration-ink/25 underline-offset-2 transition-colors hover:text-[var(--accord-orange-deep)]"
            >
              Privacy Policy
            </Link>
            <span className="text-ink/25"> · </span>
            Data sources: official provider documentation and regulator registers, verified per
            record.
            <span className="text-ink/25"> · </span>© {new Date().getFullYear()} Rails Radar
          </p>
        </div>
      </div>
    </footer>
  );
}
