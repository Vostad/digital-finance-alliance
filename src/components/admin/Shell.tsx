/**
 * THE ADMIN SHELL.
 *
 * One header, one nav, one content column. Five destinations for a manager, two
 * for a team member — few enough that a persistent sidebar would spend 15% of a
 * laptop screen saying very little. On mobile the nav stays a horizontal row
 * rather than a hamburger: five items still fit, and hiding them behind a tap
 * costs more than it saves.
 *
 * Radar is the fifth, added when Rails Radar shipped. It is a manager-only
 * editorial workspace, not configuration — an editor verifying sources is in it
 * daily — so unlike Settings it belongs in the primary path rather than the
 * account menu. Phase 2 cut this nav from eight to four; this is a deliberate
 * move to five, not creep, and nav.test.ts was updated to say so out loud.
 *
 * Settings is deliberately NOT here. It is configuration, touched rarely, and
 * putting it in the daily path would make four destinations feel like five. It
 * lives in the account menu, which is where people already look for it.
 */

import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { logout } from "@/rpc/auth";
import { TEXT } from "./primitives";

export type NavItem = { to: string; label: string; roles: string[] };

const MANAGER = ["super_admin", "admin"];
const MEMBER = ["team_member"];

/**
 * The destinations, and who may reach them.
 *
 * A Super Admin and an Admin see an IDENTICAL structure. They differ only in
 * what the server returns inside it — an Admin's Leads, Events and Team are all
 * confined to their event scope by `scopedQuery`, not by a hidden link. Hiding a
 * link has never secured anything, and every screen below is guarded again on
 * the server.
 *
 * A team member gets the same two screens under names that describe their work
 * rather than the organisation's: they are not browsing a lead database, they
 * are working their own list.
 */
export const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", roles: MANAGER },
  { to: "/admin/leads", label: "Leads", roles: MANAGER },
  { to: "/admin/events", label: "Events", roles: MANAGER },
  { to: "/admin/team", label: "Team", roles: MANAGER },
  { to: "/admin/radar", label: "Radar", roles: MANAGER },
  { to: "/admin/leads", label: "My Leads", roles: MEMBER },
  { to: "/admin/targets", label: "My Targets", roles: MEMBER },
];

/** An unrecognised role gets the least-privileged set, never the full one:
    defaulting open is how a permission bug ships. */
export function navFor(role: string): NavItem[] {
  const known = MANAGER.includes(role) || MEMBER.includes(role);
  const effective = known ? role : "team_member";
  return NAV.filter((item) => item.roles.includes(effective));
}

export function Shell({
  title,
  subtitle,
  actions,
  role,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode;
  /** Drives which destinations are shown. Omitted means the safe subset. */
  role?: string | undefined;
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
            {navFor(role ?? "team_member").map((item) => {
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

          <AccountMenu />
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

/**
 * THE ACCOUNT MENU — the entry point to Settings, and the way out.
 *
 * Rare configuration does not belong in a four-item navigation. It belongs
 * where people already look for it: behind their own name. Closing on outside
 * click and on Escape is not decoration — a menu that traps you is worse than
 * no menu.
 */
function AccountMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(TEXT.label, "text-ink/50 transition-colors hover:text-ink")}
      >
        Account
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-44 border border-hairline bg-bone py-1 shadow-sm"
        >
          <Link
            to="/admin/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 font-mono text-[13px] uppercase tracking-[0.1em] text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await logout();
              await router.navigate({ to: "/admin/login" });
            }}
            className="block w-full px-3 py-2 text-left font-mono text-[13px] uppercase tracking-[0.1em] text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
