import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { login } from "@/rpc/auth";

/**
 * The only screen Phase 1 ships.
 *
 * It exists to prove the session works end to end: sign in, resolve the context
 * from the database, and get told plainly when the account has been switched
 * off. Everything else — the pipeline, the boards, the forecast — is Phase 2.
 *
 * `noindex` because an internal admin surface has no business in a search
 * index, and this one sits on the same domain as a marketing site.
 */

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Financial Rails OS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login({ data: { email, password } });
      await router.navigate({ to: "/admin" });
    } catch (problem) {
      /* The server already collapses every failure to one message; anything
         unexpected must not leak a stack trace onto the page. */
      setError(
        problem instanceof Error && problem.message
          ? problem.message
          : "Something went wrong. Try again.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bone px-6 py-16">
      <div className="w-full max-w-[26rem]">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
          Financial Rails
        </p>
        <h1 className="mt-3 font-display text-[clamp(1.6rem,6vw,2rem)] font-extrabold uppercase leading-[0.94] tracking-[-0.028em] text-ink">
          Operating System
        </h1>

        <form onSubmit={onSubmit} className="mt-10 border-t border-hairline pt-8">
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/60">
              Email
            </span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full border border-hairline bg-paper px-4 py-3 text-[16px] text-ink outline-none focus:border-ink"
            />
          </label>

          <label className="mt-6 block">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/60">
              Password
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full border border-hairline bg-paper px-4 py-3 text-[16px] text-ink outline-none focus:border-ink"
            />
          </label>

          {error ? (
            <p
              role="alert"
              className="mt-6 border-l-2 border-ink pl-3 text-[15px] leading-[1.5] text-ink"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-8 inline-flex w-full items-center justify-center bg-ink px-6 py-4 font-mono text-[12px] uppercase tracking-[0.16em] text-paper transition-opacity disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-8 text-[14px] leading-[1.6] text-ink/55">
          Accounts are created by invitation. There is no sign-up.
        </p>
      </div>
    </div>
  );
}
