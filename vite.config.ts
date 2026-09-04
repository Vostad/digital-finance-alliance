// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // PINNED. The wrapper defaults to `cloudflare-module`, but production is a
  // Vercel Node function and Workers cannot open the TCP socket the Postgres
  // driver needs. Left unpinned, a stray `wrangler deploy` ships a build that
  // cannot reach the database at all.
  nitro: { preset: "vercel" },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Honour an externally assigned port (e.g. the Claude Code preview's PORT
    // env var) so two sessions can run dev servers side by side. Without PORT
    // set, this resolves to 8080 — identical to the previous behaviour.
    server: { port: Number(process.env["PORT"]) || 8080 },
  },
});
