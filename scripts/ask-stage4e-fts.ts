/**
 * Stage 4E-B opt-in PostgreSQL FTS benchmark.
 * SKIP when SITEPM_BENCH_* retrieval env is absent.
 * Does not generate or execute fixture SQL. Does not use service role.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ASK_CHUNK_MODEL_CAP } from "@/lib/ask-evidence";
import {
  RP001_4EB_SENTINEL_CHUNK_ID,
  RP001_4EB_SENTINEL_DOCUMENT_ID,
  RP001_4EB_SENTINEL_EXTRACTION_ID,
  STAGE4E_FTS_ONE_FIXTURE_PER_DATABASE,
  STAGE4E_FTS_PROOF_BOUNDARY,
  buildRp001DocumentIdMap,
  classifyBenchEnv,
  emailsMatch,
  fixtureIntegrityBlocksRecall,
  classifyFixtureIntegrity,
  isUuid,
  parseStage4eFtsRpcHit,
} from "@/lib/ask-stage4e-fts";
import {
  STAGE4E_RECALL_CUTOFFS,
  classifyDeterministicFailure,
  conflictPairStatus,
  findEvaluatorLeakage,
  findVerbatimExpectedAnswers,
  goldFound,
  goldLocatorKey,
  goldMissing,
  laterThanAsOf,
  mapHitsToEvaluatorRefs,
  mean,
  parseStage4eGroundTruth,
  recallAtK,
  temporalViolations,
  uniqueGoldLocators,
  type Stage4eGoldLocator,
  type Stage4eGroundTruth,
  type Stage4eHitRef,
} from "@/lib/ask-stage4e-score";
import { DOCUMENT_CHUNK_RETRIEVAL_CAP } from "@/lib/document-chunk-retrieval";
import type { DocumentChunkHit } from "@/lib/document-intelligence-types";
import { RP001_ROOT, loadRp001Register } from "@/lib/rp001-corpus";

const LIFECYCLE_CAVEAT =
  "RP001 4E-B database fixture bypasses the production PDF upload/Storage preservation path. Its ready document rows exist only to satisfy the existing derived-evidence/FTS schema and must not be interpreted as proof of upload or preservation behavior.";

function applyEnvLine(line: string, target: Record<string, string>) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return;
  }
  const withoutExport = trimmed.startsWith("export ")
    ? trimmed.slice(7).trim()
    : trimmed;
  const eq = withoutExport.indexOf("=");
  if (eq <= 0) {
    return;
  }
  const name = withoutExport.slice(0, eq).trim();
  let value = withoutExport.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (name && !target[name]) {
    target[name] = value;
  }
}

function envFromLocal() {
  const map: Record<string, string> = {};
  try {
    const text = readFileSync(".env.local", "utf8");
    for (const line of text.split(/\r?\n/)) {
      applyEnvLine(line, map);
    }
  } catch {
    return map;
  }
  return map;
}

function benchEnv(name: string) {
  const local = envFromLocal();
  return (process.env[name] || local[name] || "").trim();
}

const url = benchEnv("SITEPM_BENCH_URL");
const anonKey = benchEnv("SITEPM_BENCH_ANON_KEY");
const email = benchEnv("SITEPM_BENCH_EMAIL");
const password = benchEnv("SITEPM_BENCH_PASSWORD");
const projectId = benchEnv("SITEPM_BENCH_PROJECT_ID");
const foreignEmail = benchEnv("SITEPM_BENCH_FOREIGN_EMAIL");
const foreignPassword = benchEnv("SITEPM_BENCH_FOREIGN_PASSWORD");

const envDecision = classifyBenchEnv((name) => benchEnv(name));
if (envDecision.kind === "skip") {
  console.log(
    `SKIP Stage 4E-B PostgreSQL FTS benchmark: ${envDecision.missing.join(", ")} not provided.`,
  );
  console.log(STAGE4E_FTS_PROOF_BOUNDARY);
  process.exit(0);
}
if (envDecision.kind === "partial") {
  console.error(
    `FAIL 4E-B: partial SITEPM_BENCH_* environment; missing ${envDecision.missing.join(", ")}`,
  );
  process.exit(1);
}

if (!isUuid(projectId)) {
  console.error("FAIL 4E-B: SITEPM_BENCH_PROJECT_ID is not a UUID");
  process.exit(1);
}

let failed = 0;
function assert(name: string, condition: boolean) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`PASS ${name}`);
}

function failInfrastructure(reason: string): never {
  console.error(`FAIL 4E-B: ${reason}`);
  process.exit(1);
}

function writeDenied(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }
  const message = String(error.message ?? "");
  return (
    error.code === "42501" ||
    error.code === "PGRST301" ||
    error.code === "PGRST204" ||
    error.code === "PGRST202" ||
    /permission denied/i.test(message) ||
    /not found/i.test(message) ||
    /could not find the function/i.test(message) ||
    /row-level security/i.test(message) ||
    /schema cache/i.test(message)
  );
}

function writerBodyRan(error: { message?: string } | null) {
  const message = String(error?.message ?? "");
  return (
    /Extraction parent document does not exist/i.test(message) ||
    /Extraction parent document must be ready/i.test(message) ||
    /Extraction source_sha256 must match/i.test(message)
  );
}

function clientFor(accessToken: string) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

type SignedInIdentity = {
  accessToken: string;
  userId: string;
  email: string | null;
};

async function passwordSession(
  userEmail: string,
  userPassword: string,
): Promise<SignedInIdentity> {
  const auth = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.signInWithPassword({
    email: userEmail,
    password: userPassword,
  });
  const user = data.user;
  const session = data.session;
  if (error || !session || !user?.id) {
    throw new Error("sign-in failed");
  }
  return {
    accessToken: session.access_token,
    userId: user.id,
    email: user.email ?? null,
  };
}

function mapHit(row: unknown, expectedProject: string): DocumentChunkHit {
  const hit = parseStage4eFtsRpcHit(row);
  if (hit.project_id !== expectedProject) {
    throw new Error("Chunk retrieval escaped the authorized project.");
  }
  return hit;
}

async function searchChunks(
  client: SupabaseClient,
  query: string,
  asOf: string | null,
) {
  const rpcArgs = {
    p_project_id: projectId,
    p_query: query,
    p_as_of: asOf,
    p_limit: DOCUMENT_CHUNK_RETRIEVAL_CAP,
  };
  const forbidden = [
    "expected_answer",
    "authoritative_sources",
    "intentional_unknowns",
    "rubric",
    "hard_failures",
  ];
  for (const key of Object.keys(rpcArgs)) {
    if (forbidden.includes(key)) {
      throw new Error("evaluator fields must not be sent to FTS");
    }
  }
  const { data, error } = await client.rpc(
    "search_project_document_chunks",
    rpcArgs,
  );
  if (error) {
    throw error;
  }
  const rows = data ?? [];
  if (!Array.isArray(rows)) {
    throw new Error("Chunk retrieval returned a non-array.");
  }
  if (rows.length > DOCUMENT_CHUNK_RETRIEVAL_CAP) {
    throw new Error("Chunk retrieval exceeded the hard result cap.");
  }
  return rows.map((row) => mapHit(row, projectId));
}

function uniqueLocatorKeys(refs: Stage4eHitRef[]) {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const ref of refs) {
    const key = goldLocatorKey(ref.document, ref.locator);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

function positionsForGold(gold: Stage4eGoldLocator[], hits: Stage4eHitRef[]) {
  return gold.map((item) => {
    const index = hits.findIndex(
      (hit) => hit.document === item.document && hit.locator === item.locator,
    );
    return {
      locator: goldLocatorKey(item.document, item.locator),
      rpc_order_position: index === -1 ? null : index + 1,
    };
  });
}

console.log(STAGE4E_FTS_PROOF_BOUNDARY);
console.log(LIFECYCLE_CAVEAT);
console.log(STAGE4E_FTS_ONE_FIXTURE_PER_DATABASE);

const truth = parseStage4eGroundTruth(
  JSON.parse(readFileSync(join(RP001_ROOT, "ground-truth.json"), "utf8")),
);
const { byDocumentId, bySource } = buildRp001DocumentIdMap();
const fixtureDocumentIds = [...bySource.values()];

let benchIdentity: SignedInIdentity;
let foreignIdentity: SignedInIdentity;
try {
  benchIdentity = await passwordSession(email, password);
  foreignIdentity = await passwordSession(foreignEmail, foreignPassword);
} catch {
  console.error("FAIL 4E-B: authentication failed");
  process.exit(1);
}

if (!emailsMatch(benchIdentity.email, email)) {
  failInfrastructure("benchmark session identity does not match SITEPM_BENCH_EMAIL");
}
if (!emailsMatch(foreignIdentity.email, foreignEmail)) {
  failInfrastructure("foreign session identity does not match SITEPM_BENCH_FOREIGN_EMAIL");
}
if (benchIdentity.userId === foreignIdentity.userId) {
  failInfrastructure("benchmark user identity must differ from foreign user identity");
}
assert("benchmark session identity verified", true);
assert("foreign session identity verified", true);
assert("benchmark and foreign identities are distinct", true);

const bench = clientFor(benchIdentity.accessToken);
const foreign = clientFor(foreignIdentity.accessToken);
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function persistedIds(data: unknown): string[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((row) =>
      row && typeof row === "object" && "id" in row ? String((row as { id: unknown }).id) : "",
    )
    .filter((id) => isUuid(id));
}

async function deleteExactSentinel(
  table: "document_extractions" | "document_chunks",
  id: string,
) {
  await bench.from(table).delete().eq("id", id);
}

async function expectJwtWriteDenied(
  label: string,
  result: { error: { code?: string; message?: string } | null; data: unknown },
  cleanup:
    | { table: "document_extractions" | "document_chunks"; id: string }
    | null,
) {
  const ids = persistedIds(result.data);
  if (ids.length > 0) {
    if (cleanup) {
      await deleteExactSentinel(cleanup.table, cleanup.id);
    }
    failInfrastructure(`${label}: unexpected JWT mutation persisted`);
  }
  if (!result.error || writeDenied(result.error)) {
    console.log(`PASS ${label}`);
    return;
  }
  failInfrastructure(`${label}: JWT write reached the database`);
}

console.log("=== fixture integrity (not Recall) ===");
const { data: fixtureDocs, error: fixtureError } = await bench
  .from("documents")
  .select("id, filename, sha256, content_type, status, project_id")
  .eq("project_id", projectId)
  .in("id", fixtureDocumentIds);

if (fixtureError) {
  failInfrastructure("fixture documents not selectable by bench JWT");
}
const docs = fixtureDocs ?? [];
if (docs.length === 0) {
  failInfrastructure("fixture missing entirely");
}
if (docs.length !== 15) {
  failInfrastructure("fixture parent rows incomplete");
}
if (
  !docs.every(
    (row) =>
      row.status === "ready" &&
      row.content_type === "text/markdown" &&
      String(row.filename).endsWith("-BENCHMARK-MARKDOWN.pdf") &&
      byDocumentId.has(row.id),
  )
) {
  failInfrastructure("adapter documents are not ready markdown-identity rows");
}
const register = loadRp001Register();
if (
  !docs.every((row) => {
    const sourceId = byDocumentId.get(row.id);
    const meta = register.documents.find((item) => item.id === sourceId);
    return Boolean(meta && row.sha256 === meta.sha256);
  })
) {
  failInfrastructure("adapter sha256 does not match RP001 Markdown source hashes");
}
assert("15 benchmark adapter documents present", true);

const { data: fixtureExts, error: extError } = await bench
  .from("document_extractions")
  .select("id, document_id")
  .in("document_id", fixtureDocumentIds);
if (extError) {
  failInfrastructure("fixture extractions not selectable by bench JWT");
}
const extractionDocIds = new Set((fixtureExts ?? []).map((row) => row.document_id));
if (extractionDocIds.size !== 15) {
  failInfrastructure(
    "parent documents exist but derived extractions were never installed; this is not a Recall 0 result",
  );
}
assert("15 benchmark extractions present", true);

const { data: fixtureChunks, error: chunkError } = await bench
  .from("document_chunks")
  .select("document_id, locator")
  .in("document_id", fixtureDocumentIds);
if (chunkError) {
  failInfrastructure("fixture chunks not selectable by bench JWT");
}
const locatorsByDocument = new Map<string, Set<string>>();
for (const row of fixtureChunks ?? []) {
  const sourceId = byDocumentId.get(row.document_id);
  if (!sourceId) {
    failInfrastructure("chunk document_id is not a mapped RP001 adapter id");
  }
  const locators = locatorsByDocument.get(sourceId) ?? new Set<string>();
  locators.add(row.locator);
  locatorsByDocument.set(sourceId, locators);
}
const missingLocators = register.documents.some((meta) => {
  const present = locatorsByDocument.get(meta.id);
  return meta.locators.some((locator) => !present?.has(locator));
});
const integrity = classifyFixtureIntegrity({
  documentCount: docs.length,
  extractionDocumentIds: extractionDocIds.size,
  missingLocators,
});
if (fixtureIntegrityBlocksRecall(integrity)) {
  if (integrity === "missing") {
    failInfrastructure("fixture missing entirely");
  }
  if (integrity === "incomplete_parents") {
    failInfrastructure("fixture parent rows incomplete");
  }
  failInfrastructure(
    "parent documents exist but derived extractions/chunks were never installed; this is not a Recall 0 result",
  );
}
assert("expected RP001 locators present on derived chunks", true);
console.log(
  "PASS fixture integrity: 15 documents, 15 extractions, expected locators (distinct from retrieval metrics)",
);

const fakeSha = "a".repeat(64);
const { data: insertExtRows, error: insertExt } = await bench
  .from("document_extractions")
  .insert({
    id: RP001_4EB_SENTINEL_EXTRACTION_ID,
    document_id: RP001_4EB_SENTINEL_DOCUMENT_ID,
    source_sha256: fakeSha,
    extractor_name: "forged",
    extractor_version: "0",
    content_kind: "markdown",
    extracted_text: "no",
  })
  .select("id");
await expectJwtWriteDenied(
  "bench JWT cannot INSERT document_extractions",
  { error: insertExt, data: insertExtRows },
  { table: "document_extractions", id: RP001_4EB_SENTINEL_EXTRACTION_ID },
);
const { data: updatedExt, error: updateExt } = await bench
  .from("document_extractions")
  .update({ extracted_text: "no" })
  .eq("id", RP001_4EB_SENTINEL_EXTRACTION_ID)
  .select("id");
await expectJwtWriteDenied(
  "bench JWT cannot UPDATE document_extractions",
  { error: updateExt, data: updatedExt },
  { table: "document_extractions", id: RP001_4EB_SENTINEL_EXTRACTION_ID },
);
const { data: deletedExt, error: deleteExt } = await bench
  .from("document_extractions")
  .delete()
  .eq("id", RP001_4EB_SENTINEL_EXTRACTION_ID)
  .select("id");
await expectJwtWriteDenied(
  "bench JWT cannot DELETE document_extractions",
  { error: deleteExt, data: deletedExt },
  { table: "document_extractions", id: RP001_4EB_SENTINEL_EXTRACTION_ID },
);

const { data: insertChunkRows, error: insertChunk } = await bench
  .from("document_chunks")
  .insert({
    id: RP001_4EB_SENTINEL_CHUNK_ID,
    document_id: RP001_4EB_SENTINEL_DOCUMENT_ID,
    extraction_id: RP001_4EB_SENTINEL_EXTRACTION_ID,
    source_sha256: fakeSha,
    locator: "SENTINEL",
    locator_type: "section",
    body: "forged",
    content_kind: "markdown",
  })
  .select("id");
await expectJwtWriteDenied(
  "bench JWT cannot INSERT document_chunks",
  { error: insertChunk, data: insertChunkRows },
  { table: "document_chunks", id: RP001_4EB_SENTINEL_CHUNK_ID },
);
const { data: updatedChunk, error: updateChunk } = await bench
  .from("document_chunks")
  .update({ body: "forged" })
  .eq("id", RP001_4EB_SENTINEL_CHUNK_ID)
  .select("id");
await expectJwtWriteDenied(
  "bench JWT cannot UPDATE document_chunks",
  { error: updateChunk, data: updatedChunk },
  { table: "document_chunks", id: RP001_4EB_SENTINEL_CHUNK_ID },
);
const { data: deletedChunk, error: deleteChunk } = await bench
  .from("document_chunks")
  .delete()
  .eq("id", RP001_4EB_SENTINEL_CHUNK_ID)
  .select("id");
await expectJwtWriteDenied(
  "bench JWT cannot DELETE document_chunks",
  { error: deleteChunk, data: deletedChunk },
  { table: "document_chunks", id: RP001_4EB_SENTINEL_CHUNK_ID },
);

const { data: writerData, error: writer } = await bench.rpc(
  "replace_ready_document_extraction",
  {
    p_document_id: RP001_4EB_SENTINEL_DOCUMENT_ID,
    p_source_sha256: fakeSha,
    p_extractor_name: "sitepm.md.section",
    p_extractor_version: "4b.1",
    p_content_kind: "markdown",
    p_extracted_text: "should not persist",
    p_source_issued_on: "2027-01-08",
    p_source_effective_on: null,
    p_chunks: [],
  },
);
if (writerData) {
  failInfrastructure("replace_ready_document_extraction unexpectedly returned");
}
if (!writeDenied(writer) || writerBodyRan(writer)) {
  failInfrastructure("bench JWT executed replace_ready_document_extraction");
}
assert("bench JWT cannot execute replace_ready_document_extraction", true);
assert("owner writer body did not run for JWT", true);

const { error: anonRpc } = await anon.rpc("search_project_document_chunks", {
  p_project_id: projectId,
  p_query: "manifold",
  p_as_of: null,
  p_limit: 25,
});
assert("anon cannot execute search RPC", writeDenied(anonRpc));

try {
  const foreignHits = await searchChunks(foreign, "manifold", null);
  assert("foreign JWT retrieves zero benchmark evidence", foreignHits.length === 0);
} catch (error) {
  assert("foreign JWT cannot retrieve benchmark project", writeDenied(error as { code?: string; message?: string }));
}

const { data: missingData, error: missingError } = await bench.rpc(
  "search_project_document_chunks",
  {
    p_project_id: "00000000-0000-4000-8000-ffffffffffff",
    p_query: "manifold",
    p_as_of: null,
    p_limit: 25,
  },
);
assert(
  "missing/foreign project id is safe empty",
  !missingError && Array.isArray(missingData) && missingData.length === 0,
);

let rpcOk = false;
try {
  await searchChunks(bench, "manifold", null);
  rpcOk = true;
} catch (error) {
  const message = String((error as { message?: string }).message ?? error);
  if (/could not find the function/i.test(message) || /PGRST202/i.test(message)) {
    console.error("FAIL 4E-B: search_project_document_chunks unavailable");
    process.exit(1);
  }
  console.error(`FAIL 4E-B: bench search RPC error: ${message}`);
  process.exit(1);
}
assert("bench JWT can execute search RPC", rpcOk);

function scoreMode(
  gold: Stage4eGoldLocator[],
  hits: DocumentChunkHit[],
  rpcAsOf: string | null,
  questionAsOf: string,
) {
  const refs = mapHitsToEvaluatorRefs(hits, byDocumentId);
  const leak = findEvaluatorLeakage(refs.map((hit) => hit.document).join(" "));
  const bodyText = hits.map((hit) => hit.body).join("\n");
  if (findEvaluatorLeakage(bodyText).length > 0) {
    throw new Error("evaluator leakage in retrieved bodies");
  }
  if (findVerbatimExpectedAnswers(bodyText, truth.questions).length > 0) {
    throw new Error("expected_answer leaked into retrieved bodies");
  }
  void leak;
  const at25 = refs.slice(0, 25);
  const at8 = refs.slice(0, ASK_CHUNK_MODEL_CAP);
  const recall: Record<string, number> = {};
  const goldRetrieved: Record<string, string[]> = {};
  const goldMiss: Record<string, string[]> = {};
  for (const cutoff of STAGE4E_RECALL_CUTOFFS) {
    const window = refs.slice(0, cutoff);
    recall[`@${cutoff}`] = recallAtK(gold, refs, cutoff);
    goldRetrieved[`@${cutoff}`] = goldFound(gold, window).map((item) =>
      goldLocatorKey(item.document, item.locator),
    );
    goldMiss[`@${cutoff}`] = goldMissing(gold, window).map((item) =>
      goldLocatorKey(item.document, item.locator),
    );
  }
  const goldKeys = new Set(
    gold.map((item) => goldLocatorKey(item.document, item.locator)),
  );
  return {
    as_of: rpcAsOf,
    hit_count: refs.length,
    recall,
    gold_retrieved: goldRetrieved,
    gold_missing: goldMiss,
    retrieved_locators_in_rpc_order: uniqueLocatorKeys(at25),
    rpc_order_positions: positionsForGold(gold, refs),
    non_gold_locators: uniqueLocatorKeys(at25).filter((key) => !goldKeys.has(key)),
    gold_in_25: goldFound(gold, at25).length,
    gold_in_8: goldFound(gold, at8).length,
    lost_in_budget: goldFound(gold, at25)
      .filter((item) => goldMissing([item], at8).length === 1)
      .map((item) => goldLocatorKey(item.document, item.locator)),
    survival_25_to_8:
      goldFound(gold, at25).length === 0
        ? null
        : goldFound(gold, at8).length / goldFound(gold, at25).length,
    temporal_violations: rpcAsOf
      ? temporalViolations(at25, rpcAsOf)
      : [],
    later_than_question_as_of: at25
      .filter((hit) => laterThanAsOf(hit.source_issued_on, questionAsOf))
      .map((hit) => goldLocatorKey(hit.document, hit.locator)),
  };
}

const questions = [];
for (const question of truth.questions) {
  const gold = uniqueGoldLocators(question.authoritative_sources);
  if (
    question.expected_answer &&
    question.question.includes(question.expected_answer)
  ) {
    throw new Error("question text must not contain expected_answer");
  }
  let evalHits: DocumentChunkHit[];
  let productHits: DocumentChunkHit[];
  try {
    evalHits = await searchChunks(bench, question.question, question.as_of);
    productHits = await searchChunks(bench, question.question, null);
  } catch (error) {
    const message = String((error as { message?: string }).message ?? error);
    failInfrastructure(`RPC validation or retrieval failed: ${message}`);
  }
  let evalMode;
  let productMode;
  try {
    evalMode = scoreMode(gold, evalHits, question.as_of, question.as_of);
    productMode = scoreMode(gold, productHits, null, question.as_of);
  } catch (error) {
    const message = String((error as { message?: string }).message ?? error);
    failInfrastructure(`evaluator mapping/validation failed: ${message}`);
  }
  const evalAt25 = mapHitsToEvaluatorRefs(evalHits, byDocumentId).slice(0, 25);
  const evalAt8 = evalAt25.slice(0, ASK_CHUNK_MODEL_CAP);
  const conflict =
    question.id === "Q01" || question.id === "Q09"
      ? conflictPairStatus(evalAt25, evalAt8, "RP001-D15", ["S1", "S3"])
      : null;
  const flags: string[] = [];
  if (question.id === "Q01") {
    flags.push("FIXTURE_CONCERN_Q01");
  }
  if (question.id === "Q14") {
    flags.push("FIXTURE_CONCERN_Q14_FORWARD_POINTER");
  }
  if (evalMode.hit_count === 0) {
    flags.push("EMPTY_RETRIEVAL_TEMPORAL_MASKED");
  }
  const d14 = evalAt25.find(
    (hit) => hit.document === "RP001-D14" && hit.locator === "S2",
  );
  if (question.id === "Q14" && d14) {
    const body = evalHits.find(
      (hit) =>
        byDocumentId.get(hit.document_id) === "RP001-D14" && hit.locator === "S2",
    )?.body;
    if (body?.includes("RP001-D15")) {
      flags.push("D14_S2_FORWARD_POINTER_IN_RETRIEVED_BODY");
    }
  }
  questions.push({
    id: question.id,
    question: question.question,
    as_of: question.as_of,
    gold_locators: gold.map((item) => goldLocatorKey(item.document, item.locator)),
    eval_as_of: evalMode,
    product_like_asOf_null: productMode,
    conflict_pair: conflict,
    primary_failure: classifyDeterministicFailure({
      goldExtracted: true,
      goldMissingAt25: evalMode.gold_missing["@25"]?.length ?? gold.length,
      goldMissingAt8: evalMode.gold_missing["@8"]?.length ?? gold.length,
      evalAsOfViolations: evalMode.temporal_violations.length,
    }),
    secondary_flags: flags,
  });
}

const q03 = questions.find((item) => item.id === "Q03");
const q14 = questions.find((item) => item.id === "Q14");
const q01 = questions.find((item) => item.id === "Q01");
const q09 = questions.find((item) => item.id === "Q09");

const recallMeansEval = Object.fromEntries(
  STAGE4E_RECALL_CUTOFFS.map((cutoff) => [
    `@${cutoff}`,
    mean(questions.map((item) => item.eval_as_of.recall[`@${cutoff}`] ?? 0)),
  ]),
);
const recallMeansProduct = Object.fromEntries(
  STAGE4E_RECALL_CUTOFFS.map((cutoff) => [
    `@${cutoff}`,
    mean(
      questions.map((item) => item.product_like_asOf_null.recall[`@${cutoff}`] ?? 0),
    ),
  ]),
);
const survivalRates = questions
  .map((item) => item.eval_as_of.survival_25_to_8)
  .filter((value): value is number => typeof value === "number");

const q14EvalLocators = q14?.eval_as_of.retrieved_locators_in_rpc_order ?? [];
const q14ProductLocators =
  q14?.product_like_asOf_null.retrieved_locators_in_rpc_order ?? [];
const q14Empty = (q14?.eval_as_of.hit_count ?? 0) === 0;

const report = {
  slice: "4E-B",
  retrieval_kind:
    "POSTGRESQL FTS BENCHMARK — search_project_document_chunks — AUTHENTICATED JWT / RLS — RP001 BENCHMARK DATABASE ADAPTER — NOT PRODUCTION UPLOAD / STORAGE / PDF EXTRACTION VALIDATION — not a full production Ask benchmark",
  lifecycle_caveat: LIFECYCLE_CAVEAT,
  one_fixture_per_database: STAGE4E_FTS_ONE_FIXTURE_PER_DATABASE,
  rank_note:
    "RPC does not return ts_rank_cd. Positions are 1-based RPC ORDER POSITION.",
  fixture_integrity:
    "15 documents, 15 extractions, expected locators visible to bench JWT — distinct from Recall@k",
  retrieval: {
    eval_as_of_mean_recall: recallMeansEval,
    product_like_mean_recall: recallMeansProduct,
  },
  budget: {
    model_cap: ASK_CHUNK_MODEL_CAP,
    mean_survival_25_to_8:
      survivalRates.length === 0 ? null : mean(survivalRates),
    questions_with_budget_loss: questions
      .filter((item) => item.eval_as_of.lost_in_budget.length > 0)
      .map((item) => item.id),
    q01_conflict_pair: q01?.conflict_pair ?? null,
    q09_conflict_pair: q09?.conflict_pair ?? null,
  },
  temporal: {
    q03: {
      as_of: q03?.as_of,
      eval_hit_count: q03?.eval_as_of.hit_count,
      eval_later_issued: q03?.eval_as_of.later_than_question_as_of,
      product_like_later_issued: q03?.product_like_asOf_null.later_than_question_as_of,
      eval_empty_masked: q03?.eval_as_of.hit_count === 0,
    },
    q14: {
      as_of: q14?.as_of,
      eval_empty_masked: q14Empty,
      d15_under_eval_as_of: q14EvalLocators.some((key) =>
        key.startsWith("RP001-D15#"),
      ),
      d14_s2_under_eval_as_of: q14EvalLocators.includes("RP001-D14#S2"),
      d15_under_product_like: q14ProductLocators.some((key) =>
        key.startsWith("RP001-D15#"),
      ),
      flags: q14?.secondary_flags ?? [],
    },
  },
  questions,
};

console.log("");
console.log("=== Stage 4E-B scorecard (PostgreSQL FTS; not Ask; not upload) ===");
console.log(
  "eval_as_of mean Recall@1/3/5/8/25:",
  STAGE4E_RECALL_CUTOFFS.map((cutoff) =>
    Number(recallMeansEval[`@${cutoff}`] ?? 0).toFixed(3),
  ).join(" / "),
);
console.log(
  "product_like mean Recall@1/3/5/8/25:",
  STAGE4E_RECALL_CUTOFFS.map((cutoff) =>
    Number(recallMeansProduct[`@${cutoff}`] ?? 0).toFixed(3),
  ).join(" / "),
);
for (const item of questions) {
  console.log(
    [
      item.id,
      `hits=${item.eval_as_of.hit_count}`,
      `R@8=${item.eval_as_of.recall["@8"]?.toFixed(2)}`,
      `R@25=${item.eval_as_of.recall["@25"]?.toFixed(2)}`,
      `fail=${item.primary_failure ?? "null"}`,
    ].join(" "),
  );
}

console.log("");
console.log("STAGE4E_FTS_BASELINE_JSON");
console.log(JSON.stringify(report, null, 2));

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4e-fts: infrastructure ok (retrieval quality is diagnostic)");
