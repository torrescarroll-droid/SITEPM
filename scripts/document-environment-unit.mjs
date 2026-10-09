/** Reject accidental hosted restricted credentials before any connection is made. */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isolatedEnvironment } from "./isolated-environment.mjs";
const dir = mkdtempSync(join(tmpdir(), "sitepm-document-env-")),
  file = join(dir, "fixture.env"),
  prior = process.env.SITEPM_ISOLATED_ENV;
const base =
  "API_URL=http://127.0.0.1:55461\nDB_URL=postgresql://postgres:synthetic@127.0.0.1:55462/postgres\n";
try {
  process.env.SITEPM_ISOLATED_ENV = file;
  for (const key of ["DOCUMENT_DATABASE_URL", "EXTRACTOR_DATABASE_URL"]) {
    const role =
      key === "DOCUMENT_DATABASE_URL"
        ? "sitepm_document_verifier"
        : "sitepm_extractor";
    for (const value of [
      `postgresql://${role}:synthetic@remote.example.test:55462/postgres`,
      `postgresql://${role}:synthetic@127.0.0.1:5432/postgres`,
      `postgresql://postgres:synthetic@127.0.0.1:55462/postgres`,
      `postgresql://${role}:synthetic@127.0.0.1:55462/other`,
    ]) {
      writeFileSync(file, base + key + "=" + value + "\n", { mode: 0o600 });
      assert.throws(() => isolatedEnvironment());
    }
    writeFileSync(
      file,
      base + key + `=postgresql://${role}:synthetic@127.0.0.1:55462/postgres\n`,
      { mode: 0o600 },
    );
    assert.doesNotThrow(() => isolatedEnvironment());
  }
  console.log(
    "PASS isolated test environment rejects hosted/wrong-port/wrong-database/privileged-role verifier and extractor credentials before connecting",
  );
} finally {
  if (prior === undefined) delete process.env.SITEPM_ISOLATED_ENV;
  else process.env.SITEPM_ISOLATED_ENV = prior;
  rmSync(dir, { recursive: true });
}
