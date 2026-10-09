/** Provision restricted credentials ONLY on an explicitly validated fresh local stack. */
import { isolatedEnvironment } from "./isolated-environment.mjs";
import { randomBytes } from "node:crypto";
import { appendFileSync, chmodSync } from "node:fs";
import postgres from "postgres";
const e = isolatedEnvironment();
const sql = postgres(e.DB_URL, { max: 1 });
try {
  for (const [role, key] of [
    ["sitepm_document_verifier", "DOCUMENT_DATABASE_URL"],
    ["sitepm_extractor", "EXTRACTOR_DATABASE_URL"],
  ]) {
    const password = randomBytes(32).toString("hex");
    await sql.unsafe(`alter role ${role} login password '${password}'`);
    const url = new URL(e.DB_URL);
    url.username = role;
    url.password = password;
    appendFileSync(
      process.env.SITEPM_ISOLATED_ENV ?? ".env.isolated.local",
      `\n${key}=${url.href}\n`,
    );
  }
  appendFileSync(
    process.env.SITEPM_ISOLATED_ENV ?? ".env.isolated.local",
    "APP_PORT=3108\n",
  );
  chmodSync(process.env.SITEPM_ISOLATED_ENV ?? ".env.isolated.local", 0o600);
  console.log(
    "Configured local-only restricted document/extractor credentials. No credentials printed.",
  );
} finally {
  await sql.end();
}
