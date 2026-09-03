/**
 * THE CONTRIBUTION FORM — "Submit a source" and "Report inaccuracy".
 *
 * Both paths are the same form with a different `kind`, because they are the
 * same operation: someone tells us something, and an editor verifies it before
 * any of it becomes data.
 *
 * THE WORDING IS LOAD-BEARING. On success this says "Submitted for
 * verification", never "Added" and never "Thank you, updated". Nothing has been
 * added. Telling a contributor their claim is live when it is sitting in a
 * queue is how a verification-first product quietly stops being one.
 *
 * Two anti-bot measures, both invisible to a person: a honeypot field a human
 * never sees, and the time the form was on screen. Neither is mentioned to the
 * user and neither blocks a slow, careful contributor.
 */

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button, INPUT, T } from "./primitives";
import { submitSource } from "@/rpc/radar";

export function SubmitSource({
  kind,
  corridorSlug,
  providerSlug,
  routeId,
  subjectHint,
  title,
  blurb,
}: {
  kind: "source" | "inaccuracy";
  corridorSlug?: string;
  providerSlug?: string;
  routeId?: string;
  subjectHint?: string;
  title: string;
  blurb: string;
}) {
  const [openedAt] = useState(() => Date.now());
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState(subjectHint ?? "");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "done") {
    return (
      <div className="border border-hairline bg-bone p-6">
        <p className={cn(T.heading, "text-ink")}>Submitted for verification</p>
        <p className={cn(T.body, "mt-3 max-w-xl text-ink/60")}>
          An editor will check the source before anything is published. Nothing has been added to
          the record yet — that is deliberate. We may email you if the source needs clarifying.
        </p>
      </div>
    );
  }

  return (
    <form
      className="border border-hairline bg-bone p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setError(null);
        try {
          await submitSource({
            data: {
              kind,
              corridorSlug: corridorSlug ?? null,
              providerSlug: providerSlug ?? null,
              routeId: routeId ?? null,
              subjectNote: note || null,
              claimedSourceUrl: url || null,
              submitterEmail: email,
              message: message || null,
              honeypot: honeypot || null,
              elapsedMs: Date.now() - openedAt,
            },
          });
          setState("done");
        } catch (problem) {
          setState("error");
          setError(problem instanceof Error ? problem.message : "That did not send. Try again.");
        }
      }}
    >
      <p className={cn(T.heading, "text-ink")}>{title}</p>
      <p className={cn(T.body, "mt-2 max-w-xl text-ink/60")}>{blurb}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={cn(T.label, "accord-signal text-ink/55")}>
            {kind === "source" ? "Source URL" : "Source URL (if you have one)"}
          </span>
          <input
            className={cn(INPUT, "mt-2")}
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required={kind === "source"}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className={cn(T.label, "accord-signal text-ink/55")}>
            {kind === "source" ? "What does it document?" : "What is wrong?"}
          </span>
          <input
            className={cn(INPUT, "mt-2")}
            placeholder={
              kind === "source"
                ? "e.g. the operating hours for a named provider on this corridor"
                : "e.g. which field is incorrect, and what it should say"
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className={cn(T.label, "accord-signal text-ink/55")}>Anything else</span>
          <textarea
            className={cn(INPUT, "mt-2 min-h-[80px] resize-y")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className={cn(T.label, "accord-signal text-ink/55")}>Your email</span>
          <input
            className={cn(INPUT, "mt-2")}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <span className={cn(T.micro, "mt-2 block text-ink/45")}>
            Used only to follow up on this submission. Not shared with third parties, and not added
            to any list.
          </span>
        </label>
      </div>

      {/* A person never sees this. A bot fills it in. */}
      <div aria-hidden className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p className={cn(T.micro, "mt-4 text-[var(--accord-orange-deep)]")}>{error}</p>
      ) : null}

      <Button type="submit" className="mt-5" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Submit for verification"}
      </Button>
    </form>
  );
}
