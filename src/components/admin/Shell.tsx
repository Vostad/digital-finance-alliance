/**
 * THE ADMIN SHELL — §20.
 *
 * One header, one nav, one content column. No sidebar: the OS has six
 * destinations, and a persistent sidebar spends 15% of a laptop screen to say
 * so. On mobile the nav becomes a horizontal scroller rather than a hamburger —
 * six items fit, and hiding them behind a tap costs more than it saves.
 */

import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { logout } from "@/rpc/auth";
import { TEXT } from "./primitives";

export type NavItem = { to: string; label: string };

/** Only what every role can reach. Role-specific destinations are rendered by
    the screens themselves, where the permission is already known. */
export const NAV: NavItem[] = [
  { to: "/admin", label: "Today" },
  { to: "/admin/pipeline", label: "Pipeline" },
  { to: "/admin/leads", label: "Leads" },
  { to: "/admin/targets", label: "Targets" },
  { to: "/admin/forecast", label: "Forecast" },
  { to: "/admin/insights", label: "Insights" },
  { to: "/admin/directory", label: "Directory" },
];

export function Shell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = router.state.location.pathname;

  return (
    <div className="min-h-dvh bg-bone text-ink">
      <header className="sticky top-0 z-30 border-b border-hairline bg-bone/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[100rem] items-center justify-between gap-4 px-4 py-2.5 md:px-6">
          <Link to="/admin" className={cn(TEXT.label, "shrink-0 text-ink")}>
            Financial Rails <span className="text-ink/45">OS</span>
          </Link>

          <nav className="-mx-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2">
            {NAV.map((item) => {
              const active =
                item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "whitespace-nowrap px-2.5 py-1.5 font-mono text-[13px] uppercase tracking-[0.1em] transition-colors",
                    active
                      ? "text-ink underline underline-offset-[6px]"
                      : "text-ink/50 hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={async () => {
              await logout();
              await router.navigate({ to: "/admin/login" });
            }}
            className={cn(TEXT.label, "shrink-0 text-ink/50 transition-colors hover:text-ink")}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[100rem] px-4 py-5 md:px-6 md:py-7">
        <div className="flex flex-wrap items-baseline justify-between gap-3 pb-4">
          <div className="min-w-0">
            <h1 className={cn(TEXT.page, "text-ink")}>{title}</h1>
            {subtitle ? <p className={cn(TEXT.micro, "mt-1 text-ink/55")}>{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
