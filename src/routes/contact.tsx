import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { Section } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { Action, Faq, FinalCta, TagList, TitleBlock } from "@/components/site/primitives";

/** The widths that exist on disk for the hero photograph. */
const HERO_WIDTHS = [480, 768, 1024, 1400];

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Digital Finance Alliance — Forums, Partnerships, Council" },
      {
        name: "description",
        content:
          "Get in touch about attending a forum, partnerships, speaking opportunities, DF30 or Digital Assets Council membership.",
      },
      { property: "og:title", content: "Contact Digital Finance Alliance" },
      {
        property: "og:description",
        content: "Let's shape the future of digital assets together.",
      },
    ],
  }),
  component: Contact,
});

const OPTIONS = ["Attend a Forum", "Partnerships & Sponsorships", "Speaking", "General Enquiries"];

const TEAMS = [
  {
    title: "Attend a Forum",
    body: "Questions about registration, upcoming forums or delegate participation.",
    cta: "Contact the Events Team",
  },
  {
    title: "Partnerships & Sponsorships",
    body: "Partner with Digital Finance Alliance to connect with senior decision-makers across markets.",
    cta: "Contact Partnerships",
  },
  {
    title: "Speaker Opportunities",
    body: "Share your expertise at an upcoming Digital Finance Alliance forum.",
    cta: "Contact the Programme Team",
  },
  {
    title: "DF30",
    body: "Nominations, submissions and partnership enquiries for DF30.",
    cta: "Contact the DF30 Team",
  },
  {
    title: "Digital Assets Council",
    body: "Membership enquiries and strategic partnerships.",
    cta: "Contact the Council",
  },
  {
    title: "Media & Press",
    body: "Media interviews, press enquiries and speaking requests.",
    cta: "Contact Media Relations",
  },
];

const INTERESTS = [
  "Attending a Forum",
  "Partnerships & Sponsorships",
  "Speaking",
  "DF30",
  "Digital Assets Council",
  "Media & Press",
  "General Enquiry",
];

const FAQS = [
  {
    q: "How quickly will I receive a response?",
    a: "Our team aims to respond to all enquiries within two business days.",
  },
  {
    q: "Do you work internationally?",
    a: "Yes. Digital Finance Alliance convenes executive forums and programmes globally.",
  },
  {
    q: "Can my organization become a partner?",
    a: "Yes. We welcome strategic partnerships with organizations aligned with our mission.",
  },
  {
    q: "How can I become a speaker?",
    a: "Submit a speaker enquiry and our programme committee will review your profile for upcoming forums.",
  },
  {
    q: "Where are your forums held?",
    a: "Digital Finance Alliance hosts executive forums in leading international business hubs. Event locations are announced on each forum page.",
  },
];

const FIELD =
  "w-full border-0 border-b border-hairline bg-transparent py-4 text-base text-ink outline-none transition-colors duration-300 placeholder:text-ink/35 focus:border-ink";

function Contact() {
  return (
    <>
      <PageHero
        meta="Contact"
        eyebrow="Contact"
        title="Let's Shape the Future of Digital Assets Together."
        lede="Whether you're interested in attending a forum, partnering with Digital Finance Alliance or speaking at one of our events, we'd love to hear from you."
        seed="aiaccord-contact"
        /* Replaces the seeded picsum.photos placeholder with the project's own
           photograph. The master is a native 1400x1867 — exactly the 3:4 the
           placeholder's frame held — so the ratio is carried over explicitly
           and the frame crops nothing. */
        image={{
          src: "/media/home/contact-hero-1024.jpg",
          srcSet: HERO_WIDTHS.map((w) => `/media/home/contact-hero-${w}.jpg ${w}w`).join(", "),
          avifSrcSet: HERO_WIDTHS.map((w) => `/media/home/contact-hero-${w}.avif ${w}w`).join(", "),
          sizes: "(min-width: 1024px) calc(37.95vw - 37px), 100vw",
          ratio: "3 / 4",
          alt: "Two delegates talking beside a touchscreen display at a conference",
        }}
      />

      <Section label="Contact Options" tone="bone">
        <div className="grid grid-cols-1 border-t border-hairline sm:grid-cols-2 lg:grid-cols-4 lg:border-t-0">
          {OPTIONS.map((option, index) => (
            <Reveal
              key={option}
              delay={index * 70}
              className="border-b border-hairline py-8 sm:px-8 sm:first:pl-0 lg:border-b-0 lg:border-l lg:first:border-l-0 lg:first:pl-0"
            >
              <span className="label opacity-40">{String(index + 1).padStart(2, "0")}</span>
              <p className="display-sm mt-5">{option}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section label="How Can We Help?">
        <TitleBlock eyebrow="How Can We Help?" title="Choose the Right Team" />
        <div className="mt-16 grid border-l border-t border-hairline sm:grid-cols-2 lg:grid-cols-3">
          {TEAMS.map((team, index) => (
            <Reveal
              key={team.title}
              delay={(index % 3) * 70}
              className="flex flex-col justify-between border-b border-r border-hairline p-8 md:p-10"
            >
              <div>
                <span className="label opacity-40">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="display-sm mt-10 max-w-[18ch]">{team.title}</h3>
                <p className="mt-5 max-w-[40ch] text-sm opacity-70">{team.body}</p>
              </div>
              <a
                href="mailto:hello@digitalassetsaccord.org"
                className="group label mt-10 inline-flex items-center gap-3 transition-opacity duration-500 hover:opacity-60"
              >
                {team.cta}
                <span
                  aria-hidden
                  className="inline-block transition-transform duration-500 group-hover:translate-x-1.5"
                >
                  →
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section label="Send Us a Message" tone="bone">
        <div className="grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Reveal>
              <p className="label opacity-50">Send Us a Message</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="display-lg mt-8 max-w-[10ch]">We're Here to Help</h2>
            </Reveal>
            <Reveal delay={140} className="mt-16 border-t border-hairline pt-8">
              <p className="label opacity-50">Global Office</p>
              <p className="display-sm mt-6">DIGITAL FINANCE ALLIANCE</p>
              <p className="mt-3 text-base opacity-70">Dubai, United Arab Emirates</p>
              <p className="mt-6 text-base">
                <a
                  href="mailto:hello@digitalassetsaccord.org"
                  className="underline-offset-4 hover:underline"
                >
                  hello@digitalassetsaccord.org
                </a>
              </p>
              <p className="mt-1 text-base opacity-70">+971 XX XXX XXXX</p>
            </Reveal>
            <Reveal delay={200} className="mt-12 border-t border-hairline pt-8">
              <p className="label opacity-50">Connect With Us</p>
              <ul className="mt-6 space-y-2 text-base">
                {["LinkedIn", "YouTube", "X", "Newsletter"].map((item) => (
                  <li key={item}>
                    <a href="#" className="underline-offset-4 hover:underline">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <div className="lg:col-span-8">
            <Reveal delay={100}>
              <form
                className="grid gap-x-10 gap-y-2 sm:grid-cols-2"
                onSubmit={(e) => e.preventDefault()}
              >
                <label className="block">
                  <span className="label opacity-50">Full Name</span>
                  <input type="text" name="name" className={FIELD} placeholder="Your full name" />
                </label>
                <label className="block">
                  <span className="label opacity-50">Organization</span>
                  <input
                    type="text"
                    name="organization"
                    className={FIELD}
                    placeholder="Company name"
                  />
                </label>
                <label className="block">
                  <span className="label opacity-50">Job Title</span>
                  <input type="text" name="title" className={FIELD} placeholder="Your role" />
                </label>
                <label className="block">
                  <span className="label opacity-50">Business Email</span>
                  <input
                    type="email"
                    name="email"
                    className={FIELD}
                    placeholder="name@company.com"
                  />
                </label>
                <label className="block">
                  <span className="label opacity-50">Country</span>
                  <input type="text" name="country" className={FIELD} placeholder="Country" />
                </label>
                <label className="block">
                  <span className="label opacity-50">I'm Interested In</span>
                  <select name="interest" className={FIELD} defaultValue="">
                    <option value="" disabled>
                      Select an option
                    </option>
                    {INTERESTS.map((interest) => (
                      <option key={interest} value={interest}>
                        {interest}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="label opacity-50">Message</span>
                  <textarea
                    name="message"
                    rows={4}
                    className={FIELD}
                    placeholder="How can we help?"
                  />
                </label>
                <div className="sm:col-span-2 mt-8">
                  <button
                    type="submit"
                    className="group label inline-flex items-center gap-4 bg-ink px-7 py-4 text-paper transition-colors duration-500 hover:bg-accent"
                  >
                    Submit Enquiry
                    <span
                      aria-hidden
                      className="inline-block transition-transform duration-500 group-hover:translate-x-1.5"
                    >
                      →
                    </span>
                  </button>
                </div>
              </form>
            </Reveal>
          </div>
        </div>
      </Section>

      <Section label="Interest Areas">
        <TitleBlock eyebrow="Enquiry Types" title="What Would You Like to Explore?" />
        <div className="mt-16">
          <TagList items={INTERESTS} />
        </div>
      </Section>

      <Section label="FAQ" tone="ink">
        <TitleBlock
          eyebrow="Frequently Asked Questions"
          title="Frequently Asked Questions"
          size="md"
        />
        <div className="mt-14">
          <Faq items={FAQS} tone="dark" />
        </div>
      </Section>

      <FinalCta
        title="Every Conversation Starts With a Simple Message."
        body="Whether you're looking to learn, collaborate, partner or lead, we're ready to help you take the next step."
        actions={[{ label: "Send an Enquiry", to: "/contact" }]}
      />
    </>
  );
}
