import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },

  /**
   * FINANCIAL RAILS OS — the authorization boundary, enforced by tooling.
   *
   * §37 requires every write to be checked server-side. The way that is kept
   * true over time is by making the unchecked path unavailable: application
   * code cannot import the raw database handle or the service-role client at
   * all, so querying unscoped is a lint error rather than an oversight.
   *
   * The scoped layer itself (src/server/auth, src/server/db) is exempt below —
   * it is the thing doing the scoping.
   */
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/server/auth/**",
      "src/server/db/**",
      "src/server/env.server.ts",
      // The test layer legitimately opens a raw connection — the integration
      // suite has to, in order to prove the scoped queries filter correctly
      // once Postgres executes them.
      "src/server/test/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
          patterns: [
            {
              regex: "(^|/)db/client$",
              message:
                "Do not import the raw `db` handle. Use scopedQuery(ctx) from @/server/auth/scoped — it applies the visibility filter that authorization depends on.",
            },
            {
              regex: "(^|/)auth/supabase\\.server$",
              message:
                "The service-role Supabase client bypasses RLS and can mint a session for any user. Use the helpers in @/server/auth instead of reaching for it directly.",
            },
            {
              regex: "(^|/)env\\.server$",
              message:
                "Secrets are read in one place. If you need a value from the environment, expose it through a server function rather than importing serverEnv here.",
            },
          ],
        },
      ],
    },
  },

  /**
   * RAILS RADAR — the server modules, allowlisted explicitly.
   *
   * These three files hold a raw database handle. They are listed by name so
   * the permission is INTENTIONAL rather than incidental: this block replaces
   * the boundary's rule for them outright, so the handle is granted by a
   * decision recorded here rather than by an accident of spelling. (The
   * boundary did once leak on spelling alone — its `group` globs matched
   * `@/server/db/client` and missed `../db/client`. They are anchored regexes
   * now, and this block is what still admits these three.)
   *
   * All three are fenced away from the CRM by the same three regexes. What
   * separates them is what they are allowed to DO, which lint cannot express
   * and the modules enforce themselves:
   *
   *   public.ts       reads only. No insert, update or delete anywhere in it.
   *   submissions.ts  writes only to radar_submissions, always status pending.
   *   admin.ts        reads and writes, every entry point behind requireAuth.
   */
  {
    files: ["src/server/radar/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          /**
           * REGEX, NOT `group`. This is deliberate and it is the whole reason
           * the fence works.
           *
           * A `group` glob is matched against the import string exactly as
           * written, and minimatch's `**` does not match a leading `../`. So
           * `**\/server/db/schema` catches `@/server/db/schema` and misses
           * `../db/schema` entirely — same module, same access, different
           * spelling. A regex anchored on the path tail catches every spelling.
           */
          patterns: [
            {
              regex: "(^|/)db/schema$",
              message:
                "Radar must not be able to name a CRM table. Import radar tables from ../db/radar; anything in schema.ts is out of scope.",
            },
            {
              regex: "(^|/)auth/supabase\\.server$",
              message:
                "The service-role client bypasses RLS and mints sessions. Radar has no use for it — admin writes authorize through requireAuth.",
            },
            {
              regex: "(^|/)domain/",
              message: "The CRM domain layer is not reachable from Radar. Radar's logic lives in src/server/radar.",
            },
          ],
        },
      ],
    },
  },

  /**
   * RAILS RADAR — the one public read path, allowlisted by name.
   *
   * This is an ADDITION to the boundary above, not a relaxation of it. The
   * blanket rule still applies to every other file in src/**, unchanged.
   *
   * src/server/radar/public.ts is the single module permitted to hold a raw
   * database handle for public, unauthenticated reads — Radar's corridor pages
   * are crawlable and have no session to scope by, which is an access class
   * `scopedQuery(ctx)` cannot express. So that one file gets the handle, and in
   * exchange it is fenced harder than the general rule fences anything:
   *
   *   · it may import ../db/radar        — the radar tables, and nothing else
   *   · it may NOT import ../db/schema   — so no CRM table can even be NAMED
   *   · it may NOT import the service-role client
   *   · it contains no write path at all
   *   · its published filter is a hardcoded literal, never a parameter
   *
   * The CRM ban is the important line. A module that cannot name `opportunities`
   * cannot query it, whatever a future edit intends.
   */
  {
    files: ["src/server/radar/public.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          /**
           * REGEX, NOT `group`. This is deliberate and it is the whole reason
           * the fence works.
           *
           * A `group` glob is matched against the import string exactly as
           * written, and minimatch's `**` does not match a leading `../`. So
           * `**\/server/db/schema` catches `@/server/db/schema` and misses
           * `../db/schema` entirely — same module, same access, different
           * spelling. A regex anchored on the path tail catches every spelling.
           */
          patterns: [
            {
              regex: "(^|/)db/schema$",
              message:
                "The public read module must not be able to name a CRM table. Import radar tables from ../db/radar; anything in schema.ts is out of scope for a public page.",
            },
            {
              regex: "(^|/)auth/supabase\\.server$",
              message:
                "The service-role client bypasses RLS and mints sessions. It has no business in a module that serves anonymous readers.",
            },
            {
              regex: "(^|/)domain/",
              message:
                "The CRM domain layer is not reachable from a public page. Radar's reads live in src/server/radar.",
            },
          ],
        },
      ],
    },
  },

  eslintPluginPrettier,
);
