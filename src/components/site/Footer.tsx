import { Link } from "@tanstack/react-router";
import { Arrow } from "./primitives";
import { Reveal } from "./Reveal";

const EXPLORE = [
  { label: "Forums", to: "/forums" },
  { label: "FR30", to: "/fr30" },
  { label: "Council", to: "/council" },
  { label: "Intelligence", to: "/intelligence" },
];

const COMPANY = [
  { label: "About", to: "/about" },
  { label: "Partners", to: "/partners" },
  { label: "Speakers", to: "/contact" },
  { label: "Contact", to: "/contact" },
];

/* Channels only. No address is published here because none is configured for
   Financial Rails yet — /contact carries the operational route, and inventing
   an inbox would send real enquiries nowhere. */
const CONNECT = ["LinkedIn", "YouTube", "X"];

export function Footer() {
  return (
    <footer className="border-t border-hairline-invert bg-ink text-paper">
      <div className="grid lg:grid-cols-[6rem_1fr]">
        <div className="hidden border-r border-hairline-invert lg:block">
          <div className="flex justify-center py-10">
            <span className="label opacity-30" style={{ writingMode: "vertical-rl" }}>
              Financial Rails
            </span>
          </div>
        </div>

        <div className="px-6 py-20 md:px-12 lg:px-16">
          <div className="grid gap-14 border-b border-hairline-invert pb-16 lg:grid-cols-12 lg:gap-10">
            <Reveal className="lg:col-span-4">
              <p className="display-md">Financial Rails</p>
              <p className="mt-6 max-w-sm text-sm leading-relaxed opacity-60">
                The institutional platform for the infrastructure through which money is created,
                moved, settled, secured and governed.
              </p>
            </Reveal>

            <Reveal delay={60} className="lg:col-span-2">
              <p className="label opacity-40">Explore</p>
              <ul className="mt-6 space-y-3">
                {EXPLORE.map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="text-sm opacity-75 transition-opacity duration-500 hover:opacity-100"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={120} className="lg:col-span-2">
              <p className="label opacity-40">Company</p>
              <ul className="mt-6 space-y-3">
                {COMPANY.map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="text-sm opacity-75 transition-opacity duration-500 hover:opacity-100"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={180} className="lg:col-span-2">
              <p className="label opacity-40">Connect</p>
              <ul className="mt-6 space-y-3">
                {CONNECT.map((item) => (
                  <li key={item} className="break-all text-sm opacity-75">
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={240} className="lg:col-span-2">
              <p className="label opacity-40">Stay Connected</p>
              <p className="mt-6 text-sm leading-relaxed opacity-60">
                Briefings on the forums, the FR30 and the infrastructure moving money.
              </p>
              <form
                className="group mt-6 flex items-center justify-between border-b border-hairline-invert pb-3"
                onSubmit={(event) => event.preventDefault()}
              >
                <input
                  type="email"
                  placeholder="Email"
                  aria-label="Email"
                  className="w-full bg-transparent text-sm outline-none placeholder:opacity-40"
                />
                <button type="submit" className="group label inline-flex items-center gap-4">
                  Subscribe <Arrow />
                </button>
              </form>
            </Reveal>
          </div>

          <div className="flex flex-col gap-4 pt-8 md:flex-row md:items-center md:justify-between">
            <p className="label opacity-40">© 2026 Financial Rails. All Rights Reserved.</p>
            <p className="label opacity-40">
              Privacy Policy <span className="mx-2">|</span> Terms &amp; Conditions
              <span className="mx-2">|</span> Cookie Policy
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
