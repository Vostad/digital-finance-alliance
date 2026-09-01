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
              group: ["**/server/db/client", "@/server/db/client"],
              message:
                "Do not import the raw `db` handle. Use scopedQuery(ctx) from @/server/auth/scoped — it applies the visibility filter that authorization depends on.",
            },
            {
              group: ["**/server/auth/supabase.server", "@/server/auth/supabase.server"],
              message:
                "The service-role Supabase client bypasses RLS and can mint a session for any user. Use the helpers in @/server/auth instead of reaching for it directly.",
            },
            {
              group: ["**/server/env.server", "@/server/env.server"],
              message:
                "Secrets are read in one place. If you need a value from the environment, expose it through a server function rather than importing serverEnv here.",
            },
          ],
        },
      ],
    },
  },

  eslintPluginPrettier,
);
