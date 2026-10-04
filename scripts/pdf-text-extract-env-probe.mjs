/**
 * Test-only probe: report child env key names, never values.
 */
const sentinelNames = [
  "OPENAI_API_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SITEPM_EXTRACTOR_DATABASE_URL",
  "DATABASE_URL",
];

const keys = Object.keys(process.env).sort();
const sentinelPresent = {};
for (const name of sentinelNames) {
  sentinelPresent[name] = Object.hasOwn(process.env, name);
}

process.stdout.write(
  JSON.stringify({
    keys,
    sentinelPresent,
    optionEnvPresent: Object.hasOwn(process.env, "SITEPM_PDF_EXTRACT_OPTIONS"),
  }),
);
