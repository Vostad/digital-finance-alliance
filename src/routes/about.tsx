import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { LogoMarquee } from "@/components/site/LogoMarquee";
import { Action, Arrow, FinalCta } from "@/components/site/primitives";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Digital Finance Alliance — Why We Exist, What We Do, Who Is Behind It" },
      {
        name: "description",
        content:
          "Digital Finance Alliance convenes the institutions building digital asset infrastructure and the leaders deploying it across the world's financial system.",
      },
      { property: "og:title", content: "About Digital Finance Alliance" },
      {
        property: "og:description",
        content:
          "Money is going programmable. Assets are becoming liquid. Digital Finance Alliance brings the people making those decisions into the same room.",
      },
    ],
  }),
  component: About,
});

/* ------------------------------------------------------------------ data -- */

/** The closing argument of Why Digital Finance Alliance — four words, one thesis. */
const WHY_CLOSING = ["The infrastructure.", "The institutions.", "The capital.", "The people."];

/** What the Alliance does, in three verbs. Not services — functions. */
const PILLARS = [
  {
    name: "Convene",
    body: "Bring together the people building, regulating, financing and deploying digital assets.",
  },
  {
    name: "Connect",
    body: "Create the relationships and private conversations that lead to strategic opportunities.",
  },
  {
    name: "Inform",
    body: "Surface the intelligence, signals and ideas shaping the next phase of digital assets.",
  },
];

/** The four components of the platform. Each links to its real page. */
const PLATFORM = [
  {
    name: "Forums",
    body: "Invitation-only forums focused on the infrastructure and institutions shaping digital assets.",
    to: "/forums",
  },
  {
    name: "Council",
    body: "A network of senior leaders and experts helping shape the questions Digital Finance Alliance explores.",
    to: "/council",
  },
  {
    name: "Intel",
    body: "Original research, intelligence and perspectives on the forces reshaping digital assets.",
    to: "/insights",
  },
  {
    /* The retired DA30 recognition programme is superseded by Digital Finance
       DF30, the platform's editorial index; this pillar now names and links
       the live property. */
    name: "DF30",
    body: "An editorial index recognising the people building, transforming and governing the next financial system.",
    to: "/df30",
  },
];

/** Who it is for — recognition, not an audience list. */
const AUDIENCES = [
  {
    name: "Asset Owners",
    body: "Funds, treasuries, corporates and institutions bringing real assets on-chain.",
  },
  {
    name: "Financial Institutions",
    body: "Banks, asset managers, exchanges and market infrastructure providers deploying digital assets.",
  },
  {
    name: "Technology Builders",
    body: "The platforms, protocols and companies building digital asset infrastructure.",
  },
  {
    name: "Regulators & Policymakers",
    body: "The authorities shaping the rules under which digital assets operate.",
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
                About Digital Finance Alliance
              </span>
            </div>
          </div>

          <div className="px-6 py-24 md:px-12 md:py-32 lg:px-16 lg:py-36">
            <Reveal>
              <p className="label mb-10 opacity-50">About Digital Finance Alliance</p>
            </Reveal>
            <Reveal delay={60}>
              {/* display-xl written out so a mobile-only fluid floor can hold
                  the two authored lines: "AI IS GOING PHYSICAL." must not
                  fracture at narrow widths, so below sm the size tracks the
                  viewport instead of stopping at the utility's 2.25rem floor. */}
              <h1 className="font-display text-[clamp(0.9rem,4.7vw,2rem)] font-extrabold uppercase leading-[0.86] tracking-[-0.03em] break-words sm:text-[clamp(2rem,4.6vw,5.75rem)] lg:text-[clamp(2rem,4.2vw,5.75rem)]">
                {" "}
                Money is going programmable.
                <br />
                Assets are becoming liquid.
              </h1>
            </Reveal>
            <Reveal delay={140}>
              <p className="lede mt-10 max-w-2xl border-t border-hairline pt-8 opacity-80">
                {" "}
                Digital Finance Alliance convenes the institutions building digital asset
                infrastructure and the leaders deploying it across the world's financial system.
              </p>
            </Reveal>
            <Reveal delay={220} className="mt-12">
              <Action to="/forums">Explore Our Forums</Action>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 02 — WHY AI ACCORD EXISTS · the argument for the institution. */}
      <Section label="Why Digital Finance Alliance">
        <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-6">
            <Reveal>
              <p className="label accord-signal opacity-45">Why Digital Finance Alliance</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="display-lg mt-8 max-w-[14ch]">
                {" "}
                Digital assets are no longer just a trading story.
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-5 lg:col-start-8 lg:pt-4">
            <Reveal delay={120}>
              <p className="lede opacity-80">Digital assets are becoming infrastructure.</p>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-6 text-base leading-relaxed opacity-75">
                {" "}
                Tokenization, stablecoins, institutional custody and settlement are moving into the
                core of the financial system.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-6 text-base leading-relaxed opacity-75">
                {" "}
                At the same time, real-world assets — funds, bonds, deposits and commodities — are
                beginning to move on-chain.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <p className="mt-6 text-base leading-relaxed opacity-75">
                The decisions being made now will shape how that transformation unfolds.
              </p>
            </Reveal>
            <Reveal delay={280} className="mt-10 border-t border-hairline pt-8">
              <p className="display-sm">
                {" "}
                Digital Finance Alliance exists to bring the people making those decisions into the
                same room.
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

      {/* 03 — WHAT AI ACCORD DOES · three functions, one sentence each. */}
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
              {" "}
              Digital Finance Alliance creates high-trust environments where decision-makers can
              meet, exchange intelligence, form partnerships and move important conversations toward
              action.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-x-8 gap-y-10 sm:grid-cols-3 lg:mt-20">
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
                {" "}
                Four ways we bring the digital asset economy together.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={120} className="lg:col-span-4 lg:col-start-9 lg:pt-6">
            <p className="lede opacity-75">
              {" "}
              Digital Finance Alliance is not one event. It is an institutional platform with four
              distinct components.
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
                Since 2014, Vostad has brought together decision-makers, experts and institutions
                across industries and more than 50 countries.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <p className="mt-6 text-base leading-relaxed opacity-75">
                {" "}
                Digital Finance Alliance is the next expression of that experience — focused on the
                forces reshaping money, markets and the institutional adoption of digital assets.
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
                {" "}
                If you are building the digital asset economy, you belong in the conversation.
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
        body="Digital Finance Alliance brings those people together."
        actions={[
          { label: "Explore Our Forums", to: "/forums" },
          { label: "Get Involved", to: "/contact" },
        ]}
      />
    </>
  );
}
