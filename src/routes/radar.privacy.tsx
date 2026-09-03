import { createFileRoute } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { RadarShell } from "@/components/radar/Shell";
import { T } from "@/components/radar/primitives";

/**
 * THE PRIVACY NOTICE — scoped to Rails Radar, and only to Rails Radar.
 *
 * Written because Radar collects an email address on two forms and the footer
 * has to link somewhere real. A footer link that goes nowhere on a page that
 * collects personal data is worse than no link at all.
 *
 * It deliberately does NOT claim to be the platform's general privacy policy.
 * Financial Rails has no privacy route yet — the site footer renders "Privacy
 * Policy" as inert text — and inventing a site-wide policy here would be
 * asserting commitments on behalf of the whole institution.
 */
export const Route = createFileRoute("/radar/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Rails Radar" },
      {
        name: "description",
        content:
          "What Rails Radar collects when you submit a source or report an inaccuracy, why, and how long it is kept.",
      },
    ],
    links: [{ rel: "canonical", href: "https://financialrails.org/radar/privacy" }],
  }),
  component: Privacy,
});

const SECTIONS = [
  {
    h: "What is collected",
    p: "Two forms on Rails Radar collect personal data: “Submit a source” and “Report inaccuracy”. Both collect the email address you enter, the source URL and notes you provide, and the browser user-agent string sent with the request. Nothing else is requested and nothing else is stored.",
  },
  {
    h: "Your IP address is not stored",
    p: "A one-way hash of your IP address is stored so that a flood of automated submissions can be rate-limited. The address itself is never written down and the hash cannot be reversed to recover it.",
  },
  {
    h: "What the email address is used for",
    p: "Verification follow-up on your submission, and nothing else. If a source needs clarifying, we may reply. It is not shared with third parties, not sold, not added to a mailing list, and not used to contact you about anything other than the submission you made.",
  },
  {
    h: "What happens to a submission",
    p: "It is placed in a queue and reviewed by an editor. It is never published, and it never overwrites a field on the site — an editor confirms the source independently and enters any resulting record themselves. Submissions are not displayed publicly at any point.",
  },
  {
    h: "Retention",
    p: "Submissions and the email addresses attached to them are kept while the claim is being verified and afterwards as a record of where a published figure came from. Ask us to delete yours and we will, using the contact route below.",
  },
  {
    h: "The rest of the site",
    p: "This notice covers Rails Radar only. Other parts of financialrails.org collect data through their own forms and are not described here.",
  },
];

function Privacy() {
  return (
    <RadarShell trail={[{ label: "Rails Radar", to: "/radar" }, { label: "Privacy" }]}>
      <h1 className={cn(T.page, "text-ink")}>Privacy — Rails Radar</h1>
      <p className={cn(T.body, "mt-4 max-w-2xl text-ink/60")}>
        Rails Radar publishes structural data about payment infrastructure. Browsing it requires no
        account and collects no personal data. Two forms collect an email address, and this is what
        happens to it.
      </p>

      <dl className="mt-10 max-w-2xl divide-y divide-hairline border-y border-hairline">
        {SECTIONS.map((s) => (
          <div key={s.h} className="py-5">
            <dt className={cn(T.heading, "text-ink")}>{s.h}</dt>
            <dd className={cn(T.body, "mt-2 text-ink/70")}>{s.p}</dd>
          </div>
        ))}
      </dl>

      <p className={cn(T.body, "mt-8 max-w-2xl text-ink/70")}>
        To ask what is held about you or to have it deleted, use the{" "}
        <a
          href="/contact"
          className="underline underline-offset-4 hover:text-[var(--accord-orange-deep)]"
        >
          contact route
        </a>
        .
      </p>
    </RadarShell>
  );
}
