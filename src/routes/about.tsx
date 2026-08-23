import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { LogoMarquee } from "@/components/site/LogoMarquee";
import { Action, Arrow, FinalCta } from "@/components/site/primitives";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Financial Rails — Why It Exists, What It Does, Who Is Behind It" },
      {
        name: "description",
        content:
          "Financial Rails is the institutional platform for the infrastructure through which money is created, moved, settled, secured and governed. Forums, the FR30, the Council and original intelligence.",
      },
      { property: "og:title", content: "About Financial Rails" },
      {
        property: "og:description",
        content:
          "Money is changing at the infrastructure level. Financial Rails brings the institutions building, funding, regulating and operating that infrastructure into the same room.",
      },
    ],
    links: [{ rel: "canonical", href: "https://financialrails.org/about" }],
  }),
  component: About,
});

/* ------------------------------------------------------------------ data -- */

/**
 * The closing argument of Why Financial Rails — the Agenda itself, which is
 * also the four chapters every forum works through and the four domains the
 * platform covers. One list, stated here as the thesis.
 */
const WHY_CLOSING = ["Money.", "Markets.", "Infrastructure.", "Rules."];

/** What Financial Rails does, in four verbs. Not services — functions. */
const PILLARS = [
  {
    name: "Convene",
    body: "Put the institutions building, funding, regulating and operating financial infrastructure in one room.",
  },
  {
    name: "Connect",
    body: "Create the private conversations between operators, regulators and capital that move decisions forward.",
  },
  {
    name: "Research",
    body: "Publish original analysis on what is working, what is broken, and what has to be built next.",
  },
  {
    name: "Recognise",
    body: "Name the people doing the work through the FR30, an editorial index rather than a ranking.",
  },
];

/** The four components of the platform. Each links to its real page. */
const PLATFORM = [
  {
    name: "Financial Rails Forums",
    body: "Invitation-only working rooms in Asia, Africa and MENA. Closed-door sessions, no exhibition floor, no press.",
    to: "/forums",
  },
  {
    name: "FR30",
    body: "An editorial index of the thirty people designing, operating, financing and regulating the infrastructure money moves through.",
    to: "/fr30",
  },
  {
    name: "Financial Rails Council",
    body: "A working council of senior leaders and institutions shaping the questions Financial Rails explores.",
    to: "/council",
  },
  {
    name: "Financial Rails Intelligence",
    body: "Research, briefings and analysis on payments, settlement, digital money, market infrastructure and the rules around them.",
    to: "/intelligence",
  },
];

/** Who it is for — recognition, not an audience list. */
const AUDIENCES = [
  {
    name: "Financial Institutions",
    body: "Banks, payment providers, exchanges and market infrastructure operators running the systems money moves through.",
  },
  {
    name: "Technology Builders",
    body: "The platforms, networks and companies building settlement, identity, compliance and core banking infrastructure.",
  },
  {
    name: "Regulators & Policymakers",
    body: "The authorities writing the rules, issuing the licences and supervising the rails.",
  },
  {
    name: "Capital",
    body: "The investors, treasuries and institutions financing the buildout and deciding what reaches production.",
  },
];

/* Mirrors the homepage Experience marquee order (endorsed → sponsor →
   trained). Declared locally so the homepage file stays untouched. */
const CLIENT_LOGOS = [
  "/logos/meity.png",
  "/logos/digital-india.png",
  "/logos/nic.png",
  "/logos/qatar-financial-centre.png",
  "/logos/cloudflare.png",
  "/logos/sbi-group.png",
  "/logos/temenos.png",
  "/logos/cisco.png",
  "/logos/mashreq.png",
  "/logos/rakuten.png",
  "/logos/ministry-of-health-saudi.png",
  "/logos/sabic.png",
  "/logos/sonangol.png",
  "/logos/maersk.png",
  "/logos/petrobras.png",
  "/logos/ega.png",
  "/logos/boehringer-ingelheim.png",
  "/logos/de-beers.png",
  "/logos/bp.png",
  "/logos/coca-cola.png",
  "/logos/sanofi.png",
  "/logos/maaden.png",
  "/logos/fmc-technologies.png",
];

/* ------------------------------------------------------------------ page -- */

function About() {
  return (
    <>
      {/* 01 — HERO · the thesis, stated typographically. No photography: on
          this page the argument is the image. */}
      <section className="bg-paper pt-20">
        <div className="grid lg:grid-cols-[6rem_minmax(0,1fr)]">
          <div className="hidden border-r border-hairline lg:block">
            <div className="flex h-full items-end justify-center pb-16">
              <span
                className="label whitespace-nowrap opacity-40"
                style={{ writingMode: "vertical-rl" }}
              >
                About Financial Rails
              </span>
            </div>
          </div>

          <div className="px-6 py-24 md:px-12 md:py-32 lg:px-16 lg:py-36">
            <Reveal>
              <p className="label mb-10 opacity-50">About Financial Rails</p>
            </Reveal>
            <Reveal delay={60}>
              {/* display-xl written out so a mobile-only fluid floor can hold
                  the two authored lines: "AI IS GOING PHYSICAL." must not
                  fracture at narrow widths, so below sm the size tracks the
                  viewport instead of stopping at the utility's 2.25rem floor. */}
              <h1 className="font-display text-[clamp(0.9rem,4.7vw,2rem)] font-extrabold uppercase leading-[0.86] tracking-[-0.03em] break-words sm:text-[clamp(2rem,4.6vw,5.75rem)] lg:text-[clamp(2rem,4.2vw,5.75rem)]">
                Money is changing
                <br />
                at the infrastructure level.
              </h1>
            </Reveal>
            <Reveal delay={140}>
              <p className="lede mt-10 max-w-2xl border-t border-hairline pt-8 opacity-80">
                Financial Rails is the institutional platform for the infrastructure through which
                money is created, moved, settled, secured and governed.
              </p>
            </Reveal>
            <Reveal delay={220} className="mt-12">
              <Action to="/forums">Explore Our Forums</Action>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 02 — WHY FINANCIAL RAILS EXISTS · the argument for the institution. */}
      <Section label="Why Financial Rails">
        <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-6">
            <Reveal>
              <p className="label accord-signal opacity-45">Why Financial Rails</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="display-lg mt-8 max-w-[14ch]">
                The rails are being rebuilt, not upgraded.
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-5 lg:col-start-8 lg:pt-4">
            <Reveal delay={120}>
              <p className="lede opacity-80">
                The change is happening underneath the products, not in them.
              </p>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-6 text-base leading-relaxed opacity-75">
                Instant payment schemes, tokenized deposits, stablecoins and always-on settlement
                are moving into the core of the financial system.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-6 text-base leading-relaxed opacity-75">
                At the same time the rules are being rewritten around them — licensing, supervision
                and the standards that decide what may connect to what.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <p className="mt-6 text-base leading-relaxed opacity-75">
                The decisions being made now will shape how that transformation unfolds.
              </p>
            </Reveal>
            <Reveal delay={280} className="mt-10 border-t border-hairline pt-8">
              <p className="display-sm">
                Financial Rails exists to bring the people making those decisions into the same
                room.
              </p>
            </Reveal>
          </div>
        </div>

        {/* The thesis in four lines. */}
        <div className="mt-20 border-t border-hairline pt-12 lg:mt-24">
          {WHY_CLOSING.map((line, i) => (
            <Reveal key={line} delay={i * 90}>
              <p className="display-md mt-2 first:mt-0">{line}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 03 — WHAT FINANCIAL RAILS DOES · four functions, one sentence each. */}
      <Section label="What We Do" tone="bone">
        <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-6">
            <Reveal>
              <p className="label accord-signal opacity-45">What We Do</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="display-lg mt-8 max-w-[16ch]">
                We convene the people who can move things.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={120} className="lg:col-span-5 lg:col-start-8 lg:pt-6">
            <p className="lede opacity-75">
              Financial Rails creates high-trust environments where decision-makers meet, exchange
              intelligence, form partnerships and move working conversations toward decisions.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {PILLARS.map((pillar, i) => (
            <Reveal key={pillar.name} delay={i * 80} className="border-t border-hairline pt-6">
              <p className="label accord-signal opacity-60">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="display-sm mt-6">{pillar.name}</h3>
              <p className="mt-4 max-w-[34ch] text-sm leading-relaxed opacity-65">{pillar.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 04 — THE PLATFORM · the architecture of the institution. Ink, so the
          structure reads as the centrepiece of the page. */}
      <Section label="The Platform" tone="ink">
        <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="label accord-signal-invert opacity-70">The Platform</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="display-lg mt-8 max-w-[18ch]">
                Four ways the institution does its work.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={120} className="lg:col-span-4 lg:col-start-9 lg:pt-6">
            <p className="lede opacity-75">
              Financial Rails is not one event. It is an institutional platform with four distinct
              components.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 border-t border-hairline-invert lg:mt-20">
          {PLATFORM.map((component, i) => (
            <Reveal key={component.name} delay={i * 80}>
              <Link
                to={component.to}
                className="group grid items-baseline gap-x-8 gap-y-3 border-b border-hairline-invert py-8 transition-opacity duration-500 hover:opacity-60 lg:grid-cols-12 lg:py-10"
              >
                <p className="label accord-signal-invert opacity-60 lg:col-span-1">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="display-md lg:col-span-3">{component.name}</h3>
                <p className="max-w-[52ch] text-base leading-relaxed opacity-70 lg:col-span-6 lg:col-start-6">
                  {component.body}
                </p>
                <span className="label hidden items-center justify-end lg:col-span-1 lg:col-start-12 lg:flex">
                  <Arrow />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 05 — CONVENED BY VOSTAD · the credibility, stated once. Facts match
          the homepage Mission section — nothing new is claimed. */}
      <Section label="Convened by Vostad">
        <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-6">
            <Reveal>
              <p className="label accord-signal opacity-45">Convened by Vostad</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="display-lg mt-8 max-w-[14ch]">
                Built on more than a decade of convening.
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-5 lg:col-start-8 lg:pt-4">
            <Reveal delay={120}>
              <p className="lede opacity-80">
                Vostad has convened decision-makers, experts and institutions across industries and
                more than 50 countries since 2014, and has run its financial-infrastructure
                programme since 2018.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <p className="mt-6 text-base leading-relaxed opacity-75">
                Financial Rails is the next expression of that experience — focused on the
                infrastructure through which money moves, and on the institutions that operate it.
              </p>
            </Reveal>
          </div>
        </div>

        <div className="mt-16 lg:mt-20">
          <LogoMarquee logos={CLIENT_LOGOS} />
        </div>
      </Section>

      {/* 06 — WHO IT IS FOR · recognition, not an audience list. */}
      <Section label="Who It Is For" tone="bone">
        <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="label accord-signal opacity-45">Who It Is For</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="display-lg mt-8 max-w-[22ch]">
                If you build, fund, regulate or operate financial infrastructure, you belong in the
                conversation.
              </h2>
            </Reveal>
          </div>
        </div>

        <div className="mt-16 border-t border-hairline lg:mt-20">
          {AUDIENCES.map((audience, i) => (
            <Reveal key={audience.name} delay={i * 80}>
              <div className="grid items-baseline gap-x-8 gap-y-3 border-b border-hairline py-8 lg:grid-cols-12 lg:py-10">
                <p className="label accord-signal opacity-60 lg:col-span-1">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="display-md lg:col-span-3">{audience.name}</h3>
                <p className="max-w-[52ch] text-base leading-relaxed opacity-70 lg:col-span-7 lg:col-start-6">
                  {audience.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 07 — FINAL CTA · the institutional close. Nothing after this. */}
      <FinalCta
        title="The next financial system will be built by people."
        body="Financial Rails brings those people together."
        actions={[
          { label: "Explore Our Forums", to: "/forums" },
          { label: "Get Involved", to: "/contact" },
        ]}
      />
    </>
  );
}
