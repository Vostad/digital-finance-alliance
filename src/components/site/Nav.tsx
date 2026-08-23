import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FinancialRailsIcon } from "./FinancialRailsIcon";

export const NAV_LINKS = [
  { label: "Forums", to: "/forums" },
  { label: "FR30", to: "/fr30" },
  { label: "Council", to: "/council" },
  { label: "Intelligence", to: "/intelligence" },
  { label: "About", to: "/about" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,padding] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
          scrolled || open
            ? "border-hairline-invert bg-ink/95 backdrop-blur-md"
            : "border-transparent bg-ink",
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 text-paper md:px-10">
          <Link to="/" className="group flex items-center gap-3" onClick={() => setOpen(false)}>
            <FinancialRailsIcon />
            <span className="font-display text-sm font-extrabold uppercase leading-[0.95] tracking-tight">
              Financial
              <br />
              Rails
            </span>
          </Link>

          <nav className="hidden items-center gap-8 xl:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="label opacity-70 transition-opacity duration-500 hover:opacity-100"
                activeProps={{ className: "label opacity-100" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link
              to="/contact"
              className="label hidden border border-hairline-invert px-5 py-3 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-paper hover:text-ink md:inline-block"
            >
              Contact
            </Link>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? "Close menu" : "Open menu"}
              className="label border border-hairline-invert px-4 py-3 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-paper hover:text-ink xl:hidden"
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink text-paper transition-[opacity,visibility] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] xl:hidden",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        <nav className="flex h-full flex-col justify-center px-6 md:px-10">
          {[...NAV_LINKS, { label: "Contact", to: "/contact" }].map((link, index) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className="display-md border-b border-hairline-invert py-5 transition-opacity duration-500 hover:opacity-50"
              style={{ transitionDelay: `${index * 30}ms` }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
