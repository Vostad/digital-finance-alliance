import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";

import { logout, me } from "@/rpc/auth";

/**
 * Phase 1 stops here, deliberately.
 *
 * This is not a dashboard. It renders the AuthContext the server resolved on
 * this request — role, functions, event scope, commission grant — because that
 * is the thing Phase 1 built and the thing Gate 2 has to be able to see. No
 * pipeline, no boards, no numbers: there is no commercial data in the system.
 */

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Financial Rails OS" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  beforeLoad: async () => {
    /* Resolved on the server, from the users table, on every navigation.
       A deactivated account lands on the login screen on its next click. */
    const user = await me().catch(() => null);
    if (!user) throw redirect({ to: "/admin/login" });
    return { user };
  },
  loader: ({ context }) => context.user,
  component: AdminHome,
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-hairline py-4 sm:flex-row sm:items-baseline sm:gap-6">
      <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50 sm:w-44 sm:shrink-0">
        {label}
      </dt>
      <dd className="text-[16px] leading-[1.5] text-ink">{value}</dd>
    </div>
  );
}

function AdminHome() {
  const user = Route.useLoaderData();
  const router = useRouter();

  const ROLE_LABEL = {
    super_admin: "Super Admin",
    admin: "Admin",
    team_member: "Team Member",
  } as const;

  return (
    <div className="min-h-dvh bg-bone px-6 py-16 md:px-12 md:py-20">
      <div className="mx-auto w-full max-w-[52rem]">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
          Financial Rails OS
        </p>
        <h1 className="mt-3 font-display text-[clamp(1.6rem,6vw,2.2rem)] font-extrabold uppercase leading-[0.94] tracking-[-0.028em] text-ink">
          {user.fullName}
        </h1>

        <dl className="mt-10 border-t border-hairline">
          <Row label="Role" value={ROLE_LABEL[user.role]} />
          <Row label="Email" value={user.email} />
          <Row
            label="Functions"
            value={user.functions.length ? user.functions.join(", ") : "None assigned"}
          />
          <Row
            label="Event scope"
            value={
              user.role === "super_admin"
                ? "All events — unscoped"
                : user.eventScopeIds.length
                  ? `${user.eventScopeIds.length} event${user.eventScopeIds.length === 1 ? "" : "s"}`
                  : "None granted"
            }
          />
          <Row
            label="Commission visibility"
            value={user.canViewCommission ? "Granted" : "Own only"}
          />
          <Row label="Timezone" value={user.timezone} />
        </dl>

        <p className="mt-10 max-w-[56ch] text-[16px] leading-[1.6] text-ink/60">
          Phase 1 is the foundation only: schema, migrations, row-level security, sessions and
          server-side authorization. There is no commercial data in this system yet, and nothing
          here has been seeded.
        </p>

        <button
          type="button"
          onClick={async () => {
            await logout();
            await router.navigate({ to: "/admin/login" });
          }}
          className="mt-8 inline-flex items-center border border-ink px-6 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-ink"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
