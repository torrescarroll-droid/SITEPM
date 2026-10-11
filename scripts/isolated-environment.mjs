/** Local test environments only. Never accepts a hosted URL or an arbitrary database. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
export function isolatedEnvironment() {
  const env = parseEnv(
    readFileSync(
      process.env.SITEPM_ISOLATED_ENV ?? ".env.isolated.local",
      "utf8",
    ),
  );
  const api = new URL(env.API_URL),
    db = new URL(env.DB_URL);
  const loopback = (u) => ["localhost", "127.0.0.1"].includes(u.hostname);
  assert(
    loopback(api) &&
      loopback(db) &&
      api.protocol === "http:" &&
      ["postgres:", "postgresql:"].includes(db.protocol),
    "Local isolated endpoints required",
  );
  assert(
    [
      ["55431", "55432"],
      ["55441", "55442"],
      ["55451", "55452"],
      ["55461", "55462"],
    ].some(([a, d]) => api.port === a && db.port === d),
    "Unknown isolated port pair",
  );
  for (const [key, role] of [
    ["DOCUMENT_DATABASE_URL", "sitepm_document_verifier"],
    ["EXTRACTOR_DATABASE_URL", "sitepm_extractor"],
  ]) {
    if (!env[key]?.trim()) continue;
    const restricted = new URL(env[key]);
    assert(
      loopback(restricted) &&
        ["postgres:", "postgresql:"].includes(restricted.protocol) &&
        restricted.port === db.port &&
        restricted.pathname === db.pathname &&
        restricted.username === role,
      "Restricted test credentials must use the same isolated database and expected role",
    );
  }
  return env;
}
