/** Capture local CLI status without exposing credentials in terminal output. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, chmodSync } from "node:fs";
const cli = process.env.SITEPM_SUPABASE_CLI ?? "supabase",
  root = process.argv[2] ?? "/private/tmp/sitepm-documents-replay",
  out = process.argv[3] ?? ".env.isolated-document-replay.local";
assert(
  root.startsWith("/private/tmp/") &&
    /^\.env\.isolated-[a-z0-9-]+\.local$/.test(out),
  "Local replay workspace and ignored env output required",
);
const raw = execFileSync(
  cli,
  ["status", "--workdir", root, "--output", "json"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
const e = JSON.parse(raw);
const api = new URL(e.API_URL),
  db = new URL(e.DB_URL);
assert(
  ["127.0.0.1", "localhost"].includes(api.hostname) &&
    ["127.0.0.1", "localhost"].includes(db.hostname) &&
    api.port === "55461" &&
    db.port === "55462",
  "Unexpected local endpoints",
);
writeFileSync(
  out,
  ["API_URL", "DB_URL", "ANON_KEY"].map((k) => `${k}=${e[k]}`).join("\n") +
    "\n",
  { mode: 0o600 },
);
chmodSync(out, 0o600);
console.log("Saved ignored local replay settings; credentials not printed.");
