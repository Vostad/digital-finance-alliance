/**
 * Load the real .env. Node 22's loadEnvFile does what `node --env-file` does,
 * which vitest has no flag for.
 *
 * If .env is absent this fails loudly rather than falling through to whatever
 * happens to be in the ambient environment — running an integration suite
 * against an unknown database is worse than not running it.
 */
try {
  process.loadEnvFile(".env");
} catch {
  throw new Error(
    "The integration suite needs .env at the repository root. " +
      "Run `npm test` for the unit suite, which needs no credentials.",
  );
}

for (const name of ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY"]) {
  if (!process.env[name]) throw new Error(`.env is missing ${name}.`);
}
