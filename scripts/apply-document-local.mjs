/** Apply only to a validated loopback stack after managed Auth/Storage initialization. No reset. */
import { isolatedEnvironment } from "./isolated-environment.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postgres from "postgres";
const e = isolatedEnvironment(),
  sql = postgres(e.DB_URL, { max: 1, onnotice: () => {} });
try {
  if (process.argv.includes("--bootstrap")) {
    assert(
      (await sql`select to_regclass('public.companies') as t`)[0].t === null,
      "Bootstrap requires an empty application schema; no reset is performed",
    );
    for (const file of [
      "19700101000000_local_baseline.sql",
      "20261008054310_field_report_atomic_save.sql",
    ]) {
      await sql.unsafe(readFileSync("supabase/migrations/" + file, "utf8"));
      console.log("PASS isolated baseline " + file);
    }
  }
  let verifyLegacy;
  for (const file of process.argv.includes("--documents-only")
    ? ["20261009010546_document_management.sql"]
    : [
        "20261008163441_construction_scheduling.sql",
        "20261008201434_scheduling_integrity_boundary.sql",
        "20261009010546_document_management.sql",
      ]) {
    if (
      file.includes("document_management") &&
      process.argv.includes("--legacy-fixture")
    )
      verifyLegacy = await (
        await import("./document-legacy-fixture.mjs")
      ).legacyFixture(e);
    await sql.unsafe(readFileSync("supabase/migrations/" + file, "utf8"));
    console.log("PASS isolated migration " + file);
  }
  if (verifyLegacy) await verifyLegacy();
} finally {
  await sql.end();
}
