/**
 * Deterministic Stage 4E-B infrastructure tests.
 * Does not authenticate or seed hosted data. Generator spawn writes local
 * artifacts/ask-stage4e-fts only (no hosted mutation).
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

const FROZEN_FTS_BASELINE_PATH =
  "docs/reference-projects/001/evaluations/stage4e-b-fts-baseline-v1.json";
const FROZEN_MEAN_RECALL = 0.046296296296296294;
const frozenBaseline = JSON.parse(
  readFileSync(FROZEN_FTS_BASELINE_PATH, "utf8"),
) as {
  schema?: string;
  version?: string;
  overwrite_policy?: string;
  label?: string;
  measurement_code_sha?: string;
  baseline_record_sha?: string;
  fixture?: { sha256?: string; byte_size?: number };
  question_count?: number;
  mode_a?: { mean_recall?: Record<string, number> };
  mode_b?: { mean_recall?: Record<string, number> };
  mode_a_equals_mode_b?: boolean;
  zero_hit_question_count?: number;
  no_gold_at_25_question_count?: number;
  budget_miss_count?: number;
  before_retrieval_tuning?: boolean;
  questions?: Array<{
    id?: string;
    hit_count?: number;
    gold_in_25?: number;
    retrieved_rpc_order?: string[];
    missing_gold_at_25?: string[];
    primary_failure?: string;
  }>;
};
const frozenQuestions = frozenBaseline.questions ?? [];
const frozenIds = frozenQuestions.map((item) => item.id);
const expectedIds = [
  "Q01",
  "Q02",
  "Q03",
  "Q04",
  "Q05",
  "Q06",
  "Q07",
  "Q08",
  "Q09",
  "Q10",
  "Q11",
  "Q12",
  "Q13",
  "Q14",
  "Q15",
  "Q16",
  "Q17",
  "Q18",
];
const frozenMeanA = frozenBaseline.mode_a?.mean_recall ?? {};
const frozenMeanB = frozenBaseline.mode_b?.mean_recall ?? {};
assert(
  "frozen FTS baseline v1 is versioned and overwrite-protected",
  frozenBaseline.schema === "sitepm.ask.stage4e_b.fts_baseline.v1" &&
    frozenBaseline.version === "v1" &&
    (frozenBaseline.overwrite_policy ?? "").includes("DO NOT OVERWRITE") &&
    (frozenBaseline.label ?? "").includes("BEFORE RETRIEVAL TUNING") &&
    frozenBaseline.before_retrieval_tuning === true,
);
assert(
  "frozen FTS baseline records exact measurement and fixture SHAs",
  frozenBaseline.measurement_code_sha ===
    "969d8863ffcad11fd06d87bb21b3a6c0926ab264" &&
    frozenBaseline.baseline_record_sha ===
      "4bcf7fed0a3e1ae03f337a999a183b2b93e3cbe1" &&
    frozenBaseline.fixture?.sha256 ===
      "b8cd1d336508a7266b83023469741b576fa656ec777055a03ec73c7a27fe3978" &&
    frozenBaseline.fixture?.byte_size === 91067,
);
assert(
  "frozen FTS baseline has 18 unique question IDs",
  frozenBaseline.question_count === 18 &&
    frozenIds.length === 18 &&
    new Set(frozenIds).size === 18 &&
    expectedIds.every((id, index) => frozenIds[index] === id),
);
assert(
  "frozen FTS baseline macro Recall@k matches 0.046 both modes",
  frozenBaseline.mode_a_equals_mode_b === true &&
    ["@1", "@3", "@5", "@8", "@25"].every(
      (cutoff) =>
        frozenMeanA[cutoff] === FROZEN_MEAN_RECALL &&
        frozenMeanB[cutoff] === FROZEN_MEAN_RECALL,
    ),
);
assert(
  "frozen FTS baseline hit/gold/budget counts",
  frozenBaseline.zero_hit_question_count === 15 &&
    frozenBaseline.no_gold_at_25_question_count === 16 &&
    frozenBaseline.budget_miss_count === 0 &&
    frozenQuestions.filter((item) => item.hit_count === 0).length === 15 &&
    frozenQuestions.filter((item) => item.gold_in_25 === 0).length === 16,
);
const frozenQ05 = frozenQuestions.find((item) => item.id === "Q05");
const frozenQ13 = frozenQuestions.find((item) => item.id === "Q13");
const frozenQ18 = frozenQuestions.find((item) => item.id === "Q18");
assert(
  "frozen FTS baseline Q05/Q13/Q18 retrieval facts",
  frozenQ05?.hit_count === 1 &&
    frozenQ05.gold_in_25 === 0 &&
    frozenQ05.retrieved_rpc_order?.[0] === "RP001-D09#S3" &&
    frozenQ13?.hit_count === 1 &&
    frozenQ13.gold_in_25 === 1 &&
    frozenQ13.retrieved_rpc_order?.[0] === "RP001-D03#S2" &&
    frozenQ13.missing_gold_at_25?.[0] === "RP001-D12#S3" &&
    frozenQ18?.hit_count === 1 &&
    frozenQ18.gold_in_25 === 1 &&
    frozenQ18.retrieved_rpc_order?.[0] === "RP001-D04#S1" &&
    frozenQuestions.every((item) => item.primary_failure === "RETRIEVAL"),
);

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
  // Present whitespace so the hosted runner cannot fall through to .env.local.
  for (const name of STAGE4E_FTS_REQUIRED_ENV) {
    env[name] = "   ";
  }
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) {
      env[key] = "   ";
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

const generateCompany = "00000000-0000-4000-8000-000000000001";
const generateProject = "00000000-0000-4000-8000-000000000002";
const generateEnv = { ...process.env };
delete generateEnv.SITEPM_BENCH_PASSWORD;
delete generateEnv.SITEPM_BENCH_FOREIGN_PASSWORD;
generateEnv.SITEPM_BENCH_FIXTURE = "RP001_4EB";
generateEnv.SITEPM_BENCH_COMPANY_ID = generateCompany;
generateEnv.SITEPM_BENCH_PROJECT_ID = generateProject;
const generated = spawnSync(
  process.execPath,
  ["scripts/run-generate-ask-stage4e-fts-sql.mjs"],
  { encoding: "utf8", env: generateEnv, timeout: 20000 },
);
assert("generator exits 0 for confirmed dummy tenant IDs", generated.status === 0);
if (generated.status !== 0) {
  console.error(generated.stdout + generated.stderr);
}
const generatedSql = readFileSync("artifacts/ask-stage4e-fts/fixture.sql", "utf8");
const generatedCleanup = readFileSync("artifacts/ask-stage4e-fts/cleanup.sql", "utf8");
const verifyAt = generatedSql.indexOf("do $verify$");
const commitAt = generatedSql.lastIndexOf("commit;");
const lastWriterAt = generatedSql.lastIndexOf(
  "select public.replace_ready_document_extraction(",
);
assert("generated SQL contains fail-closed $verify$ block", verifyAt > 0);
assert(
  "verification runs after writer calls and before COMMIT",
  lastWriterAt > 0 && verifyAt > lastWriterAt && commitAt > verifyAt,
);
assert(
  "verify raises if parent count is not 15",
  generatedSql.includes(
    "raise exception '4E-B verify: expected 15 bound ready adapter documents, found %'",
  ),
);
assert(
  "verify binds parents to configured company/project",
  generatedSql.includes(`d.company_id = '${generateCompany}'::uuid`) &&
    generatedSql.includes(`d.project_id = '${generateProject}'::uuid`),
);
assert(
  "verify checks parent SHA against expected source hashes",
  generatedSql.includes("d.sha256 is not distinct from expected.source_sha256"),
);
assert(
  "verify raises if extraction mappings are not 15",
  generatedSql.includes(
    "raise exception '4E-B verify: expected 15 bound extractions, found %'",
  ),
);
assert(
  "verify checks extraction metadata",
  generatedSql.includes("$ven$sitepm.md.section$ven$") &&
    generatedSql.includes("$vev$4b.1$vev$") &&
    generatedSql.includes("x.content_kind = 'markdown'"),
);
assert(
  "verify raises if unexpected extraction mappings exist",
  generatedSql.includes(
    "raise exception '4E-B verify: unexpected extraction mapping count %'",
  ),
);
assert(
  "verify raises if expected locators are missing",
  generatedSql.includes(
    "raise exception '4E-B verify: missing % expected document+locator chunks'",
  ),
);
assert(
  "verify raises if fixture chunks are unbound",
  generatedSql.includes(
    "raise exception '4E-B verify: % fixture chunks are unbound or identity-mismatched'",
  ),
);
assert(
  "verify includes RP001 document+locator coverage",
  generatedSql.includes("$loc_RP001_D01_S1$S1$loc_RP001_D01_S1$") &&
    generatedSql.includes("$loc_RP001_D10_P03$P03$loc_RP001_D10_P03$") &&
    generatedSql.includes("$loc_RP001_D15_S3$S3$loc_RP001_D15_S3$"),
);
assert(
  "generated SQL still has 15 parent inserts and 15 writer calls",
  (generatedSql.match(/insert into public\.documents/g) ?? []).length === 15 &&
    (generatedSql.match(/replace_ready_document_extraction\(/g) ?? []).length ===
      15,
);
assert(
  "cleanup remains exact-ID scoped",
  generatedCleanup.includes("delete from public.documents") &&
    !/like/i.test(generatedCleanup) &&
    !/truncate/i.test(generatedCleanup) &&
    generatedCleanup.includes(rp001BenchmarkDocumentUuid("RP001-D01")) &&
    generatedCleanup.includes("-- delete from public.projects"),
);

if (failed > 0) {
  console.error(`ask-stage4e-fts-unit: ${failed} failed`);
  process.exit(1);
}
console.log("ask-stage4e-fts-unit: ok");
