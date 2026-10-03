/**
 * Deterministic Stage 4E-B infrastructure tests.
 * Does not authenticate, generate SQL, or seed hosted data.
 */

import { spawnSync } from "node:child_process";
import { mapHitsToEvaluatorRefs } from "@/lib/ask-stage4e-score";
import {
  RP001_4EB_SENTINEL_CHUNK_ID,
  RP001_4EB_SENTINEL_DOCUMENT_ID,
  RP001_4EB_SENTINEL_EXTRACTION_ID,
  STAGE4E_FTS_ONE_FIXTURE_PER_DATABASE,
  STAGE4E_FTS_REQUIRED_ENV,
  buildRp001DocumentIdMap,
  classifyBenchEnv,
  classifyFixtureIntegrity,
  emailsMatch,
  fixtureIntegrityBlocksRecall,
  mutationUsesLocatorOnlyFilter,
  parseStage4eFtsRpcHit,
  rp001BenchmarkDocumentUuid,
  sentinelIdsCollideWithFixture,
} from "@/lib/ask-stage4e-fts";

let failed = 0;
function assert(name: string, condition: boolean) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`PASS ${name}`);
}

function readMap(values: Record<string, string>) {
  return (name: string) => values[name] ?? "";
}

assert(
  "all blank/absent env is SKIP",
  classifyBenchEnv(readMap({})).kind === "skip",
);
assert(
  "partial env is FAIL/partial",
  classifyBenchEnv(readMap({ SITEPM_BENCH_URL: "https://example.invalid" })).kind ===
    "partial",
);
assert(
  "partial env reports missing names only",
  classifyBenchEnv(readMap({ SITEPM_BENCH_URL: "https://example.invalid" })).kind ===
    "partial" &&
    classifyBenchEnv(readMap({ SITEPM_BENCH_URL: "https://example.invalid" })).kind ===
      "partial" &&
    (
      classifyBenchEnv(readMap({ SITEPM_BENCH_URL: "https://example.invalid" })) as {
        missing: string[];
      }
    ).missing.includes("SITEPM_BENCH_PASSWORD") &&
    !(
      classifyBenchEnv(readMap({ SITEPM_BENCH_URL: "https://example.invalid" })) as {
        missing: string[];
      }
    ).missing.includes("https://example.invalid"),
);
assert(
  "whitespace-only values are missing",
  classifyBenchEnv(
    readMap(Object.fromEntries(STAGE4E_FTS_REQUIRED_ENV.map((name) => [name, "  "]))),
  ).kind === "skip",
);
assert(
  "complete env is ready",
  classifyBenchEnv(
    readMap({
      SITEPM_BENCH_URL: "https://example.invalid",
      SITEPM_BENCH_ANON_KEY: "anon",
      SITEPM_BENCH_EMAIL: "bench@example.invalid",
      SITEPM_BENCH_PASSWORD: "secret",
      SITEPM_BENCH_PROJECT_ID: "00000000-0000-4000-8000-ffffffffffff",
      SITEPM_BENCH_FOREIGN_EMAIL: "foreign@example.invalid",
      SITEPM_BENCH_FOREIGN_PASSWORD: "secret2",
    }),
  ).kind === "ready",
);
assert(
  "does not treat SUPABASE_URL as a bench substitute",
  classifyBenchEnv(
    readMap({
      SUPABASE_URL: "https://real.example",
      NEXT_PUBLIC_SUPABASE_URL: "https://real.example",
    }),
  ).kind === "skip",
);

assert("emailsMatch is case-insensitive", emailsMatch("A@B.com", "a@b.com"));
assert("emailsMatch fails closed on missing email", !emailsMatch(null, "a@b.com"));
assert(
  "distinct identities compare unequal",
  "user-a" !== "user-b" && !emailsMatch("bench@example.invalid", "foreign@example.invalid"),
);

assert("sentinel IDs do not collide with fixture document UUIDs", !sentinelIdsCollideWithFixture());
assert(
  "sentinel document is not D01",
  RP001_4EB_SENTINEL_DOCUMENT_ID !== rp001BenchmarkDocumentUuid("RP001-D01"),
);
assert(
  "locator-only mutation filter is rejected by helper",
  mutationUsesLocatorOnlyFilter({ locator: "S1" }),
);
assert(
  "exact sentinel id filter is not locator-only",
  !mutationUsesLocatorOnlyFilter({ id: RP001_4EB_SENTINEL_CHUNK_ID }),
);
assert("sentinel extraction id is a distinct UUID", RP001_4EB_SENTINEL_EXTRACTION_ID !== RP001_4EB_SENTINEL_DOCUMENT_ID);
assert("sentinel chunk id is a distinct UUID", RP001_4EB_SENTINEL_CHUNK_ID !== RP001_4EB_SENTINEL_DOCUMENT_ID);

assert(
  "missing fixture is not Recall 0",
  fixtureIntegrityBlocksRecall(classifyFixtureIntegrity({
    documentCount: 0,
    extractionDocumentIds: 0,
    missingLocators: true,
  })),
);
assert(
  "parents without extractions is not Recall 0",
  classifyFixtureIntegrity({
    documentCount: 15,
    extractionDocumentIds: 0,
    missingLocators: true,
  }) === "missing_derived" &&
    fixtureIntegrityBlocksRecall("missing_derived"),
);
assert(
  "complete fixture proceeds",
  classifyFixtureIntegrity({
    documentCount: 15,
    extractionDocumentIds: 15,
    missingLocators: false,
  }) === "ok" && !fixtureIntegrityBlocksRecall("ok"),
);

const validHit = {
  company_id: RP001_4EB_SENTINEL_DOCUMENT_ID,
  project_id: "00000000-0000-4000-8000-000000000001",
  document_id: rp001BenchmarkDocumentUuid("RP001-D01"),
  extraction_id: RP001_4EB_SENTINEL_EXTRACTION_ID,
  chunk_id: RP001_4EB_SENTINEL_CHUNK_ID,
  source_sha256: "a".repeat(64),
  content_kind: "markdown",
  locator: "S1",
  locator_type: "section",
  part_index: 0,
  source_issued_on: "2027-01-08",
  source_effective_on: null,
  body: "body",
};

assert("valid RPC hit parses", parseStage4eFtsRpcHit(validHit).locator === "S1");

function rejects(name: string, row: unknown) {
  let threw = false;
  try {
    parseStage4eFtsRpcHit(row);
  } catch {
    threw = true;
  }
  assert(name, threw);
}

rejects("malformed chunk UUID rejected", { ...validHit, chunk_id: "not-a-uuid" });
rejects("malformed document UUID rejected", { ...validHit, document_id: "nope" });
rejects("malformed locator rejected", { ...validHit, locator: "  " });
rejects("malformed body rejected", { ...validHit, body: 12 });
rejects("malformed date rejected", { ...validHit, source_issued_on: "2027/01/08" });
rejects("malformed content_kind rejected", { ...validHit, content_kind: "pdf" });
rejects("malformed locator_type rejected", { ...validHit, locator_type: "heading" });
rejects("string part_index is not coerced", { ...validHit, part_index: "0" });

let mappingThrew = false;
try {
  mapHitsToEvaluatorRefs(
    [parseStage4eFtsRpcHit({ ...validHit, document_id: RP001_4EB_SENTINEL_DOCUMENT_ID })],
    buildRp001DocumentIdMap().byDocumentId,
  );
} catch {
  mappingThrew = true;
}
assert("unknown document UUID rejected", mappingThrew);

assert(
  "one-fixture-per-database copy is present",
  STAGE4E_FTS_ONE_FIXTURE_PER_DATABASE.includes("one RP001 4E-B fixture can exist per database"),
);

function spawnHosted(envOverrides: Record<string, string | undefined>) {
  const env = { ...process.env };
  for (const name of STAGE4E_FTS_REQUIRED_ENV) {
    delete env[name];
  }
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }
  return spawnSync(process.execPath, ["scripts/run-ask-stage4e-fts.mjs"], {
    encoding: "utf8",
    env,
    timeout: 20000,
  });
}

const completeDummy = {
  SITEPM_BENCH_URL: "https://example.invalid",
  SITEPM_BENCH_ANON_KEY: "anon-not-a-secret-for-review",
  SITEPM_BENCH_EMAIL: "bench@example.invalid",
  SITEPM_BENCH_PASSWORD: "unit-test-password-do-not-print",
  SITEPM_BENCH_PROJECT_ID: "00000000-0000-4000-8000-ffffffffffff",
  SITEPM_BENCH_FOREIGN_EMAIL: "foreign@example.invalid",
  SITEPM_BENCH_FOREIGN_PASSWORD: "unit-test-foreign-password",
};

const absent = spawnHosted({});
assert("hosted runner all-absent SKIP exit 0", absent.status === 0);
assert(
  "hosted runner all-absent prints SKIP",
  (absent.stdout + absent.stderr).includes("SKIP Stage 4E-B"),
);

const blank = spawnHosted(
  Object.fromEntries(STAGE4E_FTS_REQUIRED_ENV.map((name) => [name, "   "])),
);
assert("hosted runner blank-only SKIP exit 0", blank.status === 0);

const partial = spawnHosted({ SITEPM_BENCH_URL: "https://example.invalid" });
assert("hosted runner partial FAIL exit 1", partial.status === 1);
assert(
  "hosted runner partial names missing variables",
  (partial.stdout + partial.stderr).includes("SITEPM_BENCH_PASSWORD") &&
    !(partial.stdout + partial.stderr).includes("https://example.invalid"),
);

const malUuid = spawnHosted({
  ...completeDummy,
  SITEPM_BENCH_PROJECT_ID: "not-a-uuid",
});
assert("hosted runner malformed project UUID FAIL", malUuid.status === 1);

const malUrl = spawnHosted({
  ...completeDummy,
  SITEPM_BENCH_URL: "not-a-url",
});
assert("hosted runner malformed URL FAIL", malUrl.status === 1);
const malUrlOut = malUrl.stdout + malUrl.stderr;
assert(
  "hosted runner does not print passwords",
  !malUrlOut.includes(completeDummy.SITEPM_BENCH_PASSWORD) &&
    !malUrlOut.includes(completeDummy.SITEPM_BENCH_FOREIGN_PASSWORD),
);

if (failed > 0) {
  console.error(`ask-stage4e-fts-unit: ${failed} failed`);
  process.exit(1);
}
console.log("ask-stage4e-fts-unit: ok");
