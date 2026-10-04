/**
 * Stage 4E retrieval Experiment 3 — hosted SHADOW evaluator.
 * NOT production retrieval. Does not mutate hosted rows.
 * JWT → RLS → existing search_project_document_chunks (one call per subquery).
 * Union-all Exp2 subquery hits, then gold-free Σ 1/H_q ranking, then cap 25.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ASK_CHUNK_MODEL_CAP } from "@/lib/ask-evidence";
import {
  STAGE4E_FTS_EXPERIMENT2_MAX_SUBQUERIES,
  frozenStage4eFtsExperiment2Lexicons,
  type Stage4eFtsExperiment2Subquery,
} from "@/lib/ask-stage4e-fts-experiment2";
import {
  STAGE4E_FTS_EXPERIMENT3_CANDIDATE_CAP,
  STAGE4E_FTS_EXPERIMENT3_LABEL,
  STAGE4E_FTS_EXPERIMENT3_MAX_APPEARANCES,
  decomposeStage4eFtsExperiment3Question,
  rankStage4eFtsExperiment3Union,
} from "@/lib/ask-stage4e-fts-experiment3";
import {
  buildRp001DocumentIdMap,
  classifyBenchEnv,
  classifyFixtureIntegrity,
  emailsMatch,
  fixtureIntegrityBlocksRecall,
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
  type Stage4eHitRef,
} from "@/lib/ask-stage4e-score";
import { DOCUMENT_CHUNK_RETRIEVAL_CAP } from "@/lib/document-chunk-retrieval";
import type { DocumentChunkHit } from "@/lib/document-intelligence-types";
import { RP001_ROOT, loadRp001Register } from "@/lib/rp001-corpus";

const BASELINE_PATH =
  "docs/reference-projects/001/evaluations/stage4e-b-fts-baseline-v1.json";
const BASELINE_SHA256 =
  "f6395382a05c4e80cd3db2dd8db32eb8bd24a416c25a5ad89bbf6a1762439a1a";
const EXP1_ARTIFACT = "artifacts/ask-stage4e-fts/experiment1-last-run.json";
const EXP2_ARTIFACT = "artifacts/ask-stage4e-fts/experiment2-last-run.json";
const ARTIFACT_PATH = "artifacts/ask-stage4e-fts/experiment3-last-run.json";

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
    `SKIP Stage 4E Experiment 3: ${envDecision.missing.join(", ")} not provided.`,
  );
  process.exit(0);
}
if (envDecision.kind === "partial") {
  console.error(
    `FAIL Experiment 3: partial SITEPM_BENCH_* environment; missing ${envDecision.missing.join(", ")}`,
  );
  process.exit(1);
}

if (!isUuid(projectId)) {
  console.error("FAIL Experiment 3: SITEPM_BENCH_PROJECT_ID is not a UUID");
  process.exit(1);
}

function failInfrastructure(reason: string): never {
  console.error(`FAIL Experiment 3: ${reason}`);
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
    /permission denied/i.test(message) ||
    /row-level security/i.test(message)
  );
}

function clientFor(accessToken: string) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function passwordSession(userEmail: string, userPassword: string) {
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
      merged_order_position: index === -1 ? null : index + 1,
    };
  });
}

const frozenLexicons = frozenStage4eFtsExperiment2Lexicons();
console.log(STAGE4E_FTS_EXPERIMENT3_LABEL);
console.log("FROZEN_EXPERIMENT2_LEXICONS");
console.log(JSON.stringify(frozenLexicons, null, 2));

const baselineBytes = readFileSync(BASELINE_PATH);
const baselineSha = createHash("sha256").update(baselineBytes).digest("hex");
if (baselineSha !== BASELINE_SHA256) {
  failInfrastructure("immutable baseline artifact bytes changed; STOP");
}
const baseline = JSON.parse(baselineBytes.toString("utf8")) as {
  mode_a: { mean_recall: Record<string, number> };
  mode_b: { mean_recall: Record<string, number> };
  zero_hit_question_count: number;
  no_gold_at_25_question_count: number;
  budget_miss_count: number;
};

let experiment1Compare: {
  eval_as_of_mean_recall: Record<string, number>;
  product_like_mean_recall: Record<string, number>;
  diagnostics: {
    mode_a: {
      zero_hit_questions: number;
      no_gold_at_25: number;
      budget_miss_count: number;
      mean_non_gold_at_8: number;
      mean_non_gold_at_25: number;
      max_non_gold_at_25: number;
    };
    mode_b: {
      zero_hit_questions: number;
      no_gold_at_25: number;
      budget_miss_count: number;
      mean_non_gold_at_8: number;
      mean_non_gold_at_25: number;
      max_non_gold_at_25: number;
    };
  };
} | null = null;
try {
  const exp1 = JSON.parse(readFileSync(EXP1_ARTIFACT, "utf8"));
  experiment1Compare = {
    eval_as_of_mean_recall: exp1.retrieval.eval_as_of_mean_recall,
    product_like_mean_recall: exp1.retrieval.product_like_mean_recall,
    diagnostics: exp1.diagnostics,
  };
} catch {
  experiment1Compare = null;
}

let experiment2Compare: {
  eval_as_of_mean_recall: Record<string, number>;
  product_like_mean_recall: Record<string, number>;
  diagnostics: {
    mode_a: {
      zero_hit_questions: number;
      no_gold_at_25: number;
      budget_miss_count: number;
      mean_non_gold_at_8: number;
      mean_non_gold_at_25: number;
      max_non_gold_at_25: number;
    };
    mode_b: {
      zero_hit_questions: number;
      no_gold_at_25: number;
      budget_miss_count: number;
      mean_non_gold_at_8: number;
      mean_non_gold_at_25: number;
      max_non_gold_at_25: number;
    };
  };
} | null = null;
try {
  const exp2 = JSON.parse(readFileSync(EXP2_ARTIFACT, "utf8"));
  experiment2Compare = {
    eval_as_of_mean_recall: exp2.retrieval.eval_as_of_mean_recall,
    product_like_mean_recall: exp2.retrieval.product_like_mean_recall,
    diagnostics: exp2.diagnostics,
  };
} catch {
  experiment2Compare = null;
}

console.log("Production RPC unchanged. Evaluator-only multi-query shadow.");
console.log(`Immutable baseline SHA-256 ${baselineSha}`);
console.log(
  `Fan-out max ${STAGE4E_FTS_EXPERIMENT2_MAX_SUBQUERIES}; max appearances ${STAGE4E_FTS_EXPERIMENT3_MAX_APPEARANCES}; candidate cap ${STAGE4E_FTS_EXPERIMENT3_CANDIDATE_CAP}; budget ${ASK_CHUNK_MODEL_CAP}`,
);

const truth = parseStage4eGroundTruth(
  JSON.parse(readFileSync(join(RP001_ROOT, "ground-truth.json"), "utf8")),
);
const { byDocumentId, bySource } = buildRp001DocumentIdMap();
const fixtureDocumentIds = [...bySource.values()];

let benchIdentity;
let foreignIdentity;
try {
  benchIdentity = await passwordSession(email, password);
  foreignIdentity = await passwordSession(foreignEmail, foreignPassword);
} catch {
  failInfrastructure("authentication failed");
}
if (!emailsMatch(benchIdentity.email, email)) {
  failInfrastructure("benchmark session identity does not match SITEPM_BENCH_EMAIL");
}
if (benchIdentity.userId === foreignIdentity.userId) {
  failInfrastructure("benchmark user identity must differ from foreign user identity");
}

const bench = clientFor(benchIdentity.accessToken);
const foreign = clientFor(foreignIdentity.accessToken);

const { data: fixtureDocs, error: fixtureError } = await bench
  .from("documents")
  .select("id, filename, sha256, content_type, status, project_id")
  .eq("project_id", projectId)
  .in("id", fixtureDocumentIds);
if (fixtureError) {
  failInfrastructure("fixture documents not selectable by bench JWT");
}
const docs = fixtureDocs ?? [];
if (docs.length !== 15) {
  failInfrastructure("fixture parent rows incomplete");
}
const register = loadRp001Register();
if (
  !docs.every((row) => {
    const sourceId = byDocumentId.get(row.id);
    const meta = register.documents.find((item) => item.id === sourceId);
    return Boolean(
      meta &&
        row.status === "ready" &&
        row.content_type === "text/markdown" &&
        row.sha256 === meta.sha256,
    );
  })
) {
  failInfrastructure("adapter documents are not the reviewed RP001 fixture");
}

const { data: fixtureExts, error: extError } = await bench
  .from("document_extractions")
  .select("id, document_id")
  .in("document_id", fixtureDocumentIds);
if (extError) {
  failInfrastructure("fixture extractions not selectable by bench JWT");
}
const extractionDocIds = new Set((fixtureExts ?? []).map((row) => row.document_id));
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
  failInfrastructure("fixture integrity blocks Experiment 3 scoring");
}
console.log(
  "PASS fixture integrity: 15/15/expected locators (SELECT only; no writes)",
);

try {
  const foreignHits = await searchChunks(foreign, "manifold", null);
  if (foreignHits.length !== 0) {
    failInfrastructure("foreign JWT retrieved benchmark evidence");
  }
  console.log("PASS foreign JWT retrieves zero benchmark evidence");
} catch (error) {
  if (!writeDenied(error as { code?: string; message?: string })) {
    failInfrastructure("foreign JWT search failed unexpectedly");
  }
  console.log("PASS foreign JWT cannot retrieve benchmark project");
}

function scoreMerged(
  gold: Stage4eGoldLocator[],
  rankedHits: DocumentChunkHit[],
  rpcAsOf: string | null,
  questionAsOf: string,
  subqueries: Stage4eFtsExperiment2Subquery[],
  perSubquery: Array<{
    query: string;
    family: string;
    signal: string;
    hit_count: number;
    gold: string[];
    non_gold: number;
  }>,
  pool: {
    appearances: number;
    unique_pool_size: number;
    ranked: Array<{
      hit: DocumentChunkHit;
      score: number;
      contributing_queries: Array<{
        query: string;
        h_q: number;
        contribution: number;
      }>;
    }>;
  },
) {
  const poolHits = pool.ranked.map((item) => item.hit);
  const poolRefs = mapHitsToEvaluatorRefs(poolHits, byDocumentId);
  const hits = rankedHits;
  const refs = mapHitsToEvaluatorRefs(hits, byDocumentId);
  const bodyText = hits.map((hit) => hit.body).join("\n");
  if (findEvaluatorLeakage(bodyText).length > 0) {
    throw new Error("evaluator leakage in retrieved bodies");
  }
  if (findVerbatimExpectedAnswers(bodyText, truth.questions).length > 0) {
    throw new Error("expected_answer leaked into retrieved bodies");
  }
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
  const locators = uniqueLocatorKeys(at25);
  const nonGold = locators.filter((key) => !goldKeys.has(key));
  const nonGold8 = uniqueLocatorKeys(at8).filter((key) => !goldKeys.has(key));
  const foundGold = goldFound(gold, at25);
  const goldInPool = goldFound(gold, poolRefs);
  const scoreByChunk = new Map(
    pool.ranked.map((item) => [item.hit.chunk_id, item]),
  );
  const hitsPerGold = gold.map((item) => {
    const poolIndex = poolRefs.findIndex(
      (hit) => hit.document === item.document && hit.locator === item.locator,
    );
    const hit = poolHits.find(
      (candidate) =>
        byDocumentId.get(candidate.document_id) === item.document &&
        candidate.locator === item.locator,
    );
    const ranked = hit ? scoreByChunk.get(hit.chunk_id) : undefined;
    return {
      locator: goldLocatorKey(item.document, item.locator),
      pool_position: poolIndex === -1 ? null : poolIndex + 1,
      score: ranked?.score ?? null,
      contributing_queries: ranked?.contributing_queries ?? [],
    };
  });
  return {
    as_of: rpcAsOf,
    subquery_count: subqueries.length,
    subqueries,
    per_subquery: perSubquery,
    appearances: pool.appearances,
    unique_pool_size: pool.unique_pool_size,
    gold_in_pool: goldInPool.length,
    gold_in_pool_locators: goldInPool.map((item) =>
      goldLocatorKey(item.document, item.locator),
    ),
    lost_pool_to_25: goldInPool
      .filter((item) => goldMissing([item], at25).length === 1)
      .map((item) => goldLocatorKey(item.document, item.locator)),
    unique_retrieved_chunks: hits.length,
    gold_retrieved_count: foundGold.length,
    non_gold_retrieved_count: nonGold.length,
    non_gold_at_8: nonGold8.length,
    non_gold_at_25: nonGold.length,
    hit_count: refs.length,
    recall,
    gold_retrieved: goldRetrieved,
    gold_missing: goldMiss,
    retrieved_locators_in_merge_order: locators,
    merged_order_positions: positionsForGold(gold, refs),
    pool_order_positions: positionsForGold(gold, poolRefs),
    pool_locators_in_rank_order: uniqueLocatorKeys(poolRefs),
    non_gold_locators: nonGold,
    hits_per_gold: hitsPerGold,
    gold_in_25: foundGold.length,
    gold_in_8: goldFound(gold, at8).length,
    lost_in_budget: foundGold
      .filter((item) => goldMissing([item], at8).length === 1)
      .map((item) => goldLocatorKey(item.document, item.locator)),
    survival_25_to_8:
      foundGold.length === 0
        ? null
        : goldFound(gold, at8).length / foundGold.length,
    temporal_violations: rpcAsOf ? temporalViolations(at25, rpcAsOf) : [],
    later_than_question_as_of: at25
      .filter((hit) => laterThanAsOf(hit.source_issued_on, questionAsOf))
      .map((hit) => goldLocatorKey(hit.document, hit.locator)),
  };
}

async function retrieveMerged(
  questionText: string,
  asOf: string | null,
  gold: Stage4eGoldLocator[],
) {
  const subqueries = decomposeStage4eFtsExperiment3Question(questionText);
  const goldKeys = new Set(
    gold.map((item) => goldLocatorKey(item.document, item.locator)),
  );
  const sources = [];
  const perSubquery = [];
  for (let index = 0; index < subqueries.length; index += 1) {
    const subquery = subqueries[index];
    const hits = await searchChunks(bench, subquery.query, asOf);
    const refs = mapHitsToEvaluatorRefs(hits, byDocumentId);
    const goldHits = uniqueLocatorKeys(refs).filter((key) => goldKeys.has(key));
    perSubquery.push({
      query: subquery.query,
      family: subquery.family,
      signal: subquery.signal,
      hit_count: hits.length,
      gold: goldHits,
      non_gold: hits.length - goldHits.length,
    });
    sources.push({
      subqueryIndex: index,
      query: subquery.query,
      hits,
    });
  }
  const ranked = rankStage4eFtsExperiment3Union(sources);
  return { subqueries, ranked, perSubquery };
}

type QuestionRow = {
  id: string;
  question: string;
  as_of: string;
  gold_locators: string[];
  generated_subqueries: Stage4eFtsExperiment2Subquery[];
  eval_as_of: ReturnType<typeof scoreMerged>;
  product_like_asOf_null: ReturnType<typeof scoreMerged>;
  conflict_pair: ReturnType<typeof conflictPairStatus> | null;
  primary_failure: ReturnType<typeof classifyDeterministicFailure>;
  secondary_flags: string[];
};

async function runPass(): Promise<QuestionRow[]> {
  const questions: QuestionRow[] = [];
  for (const question of truth.questions) {
    const gold = uniqueGoldLocators(question.authoritative_sources);
    const evalRetrieved = await retrieveMerged(
      question.question,
      question.as_of,
      gold,
    );
    const productRetrieved = await retrieveMerged(
      question.question,
      null,
      gold,
    );
    if (
      JSON.stringify(evalRetrieved.subqueries) !==
      JSON.stringify(productRetrieved.subqueries)
    ) {
      throw new Error("subquery generation must not depend on as_of");
    }
    const evalMode = scoreMerged(
      gold,
      evalRetrieved.ranked.hits,
      question.as_of,
      question.as_of,
      evalRetrieved.subqueries,
      evalRetrieved.perSubquery,
      evalRetrieved.ranked,
    );
    const productMode = scoreMerged(
      gold,
      productRetrieved.ranked.hits,
      null,
      question.as_of,
      productRetrieved.subqueries,
      productRetrieved.perSubquery,
      productRetrieved.ranked,
    );
    const evalAt25 = mapHitsToEvaluatorRefs(
      evalRetrieved.ranked.hits,
      byDocumentId,
    ).slice(0, 25);
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
      const body = evalRetrieved.ranked.hits.find(
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
      generated_subqueries: evalRetrieved.subqueries,
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
  return questions;
}

function repeatabilityCore(questions: QuestionRow[]) {
  return JSON.stringify({
    lexicons: frozenLexicons,
    questions: questions.map((item) => ({
      id: item.id,
      subqueries: item.generated_subqueries,
      eval: {
        locators: item.eval_as_of.retrieved_locators_in_merge_order,
        recall: item.eval_as_of.recall,
        hits: item.eval_as_of.hit_count,
        pool: item.eval_as_of.unique_pool_size,
        scores: item.eval_as_of.hits_per_gold,
      },
      product: {
        locators: item.product_like_asOf_null.retrieved_locators_in_merge_order,
        recall: item.product_like_asOf_null.recall,
        hits: item.product_like_asOf_null.hit_count,
        pool: item.product_like_asOf_null.unique_pool_size,
        scores: item.product_like_asOf_null.hits_per_gold,
      },
    })),
  });
}

console.log("=== Experiment 3 pass 1 ===");
const pass1 = await runPass();
console.log("=== Experiment 3 pass 2 (repeatability) ===");
const pass2 = await runPass();
if (repeatabilityCore(pass1) !== repeatabilityCore(pass2)) {
  console.error("FAIL Experiment 3: nondeterminism between identical hosted passes");
  process.exit(1);
}
console.log("PASS repeatability: two hosted passes identical");

const questions = pass1;
const q03 = questions.find((item) => item.id === "Q03");
const q14 = questions.find((item) => item.id === "Q14");
const q01 = questions.find((item) => item.id === "Q01");
const q05 = questions.find((item) => item.id === "Q05");
const q09 = questions.find((item) => item.id === "Q09");
const q13 = questions.find((item) => item.id === "Q13");
const q18 = questions.find((item) => item.id === "Q18");
const q02 = questions.find((item) => item.id === "Q02");

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

function formatRecall(means: Record<string, number>) {
  return STAGE4E_RECALL_CUTOFFS.map((cutoff) =>
    Number(means[`@${cutoff}`] ?? 0).toFixed(3),
  ).join(" / ");
}

const zeroHitA = questions.filter((item) => item.eval_as_of.hit_count === 0).length;
const zeroHitB = questions.filter(
  (item) => item.product_like_asOf_null.hit_count === 0,
).length;
const noGoldA = questions.filter((item) => item.eval_as_of.gold_in_25 === 0).length;
const noGoldB = questions.filter(
  (item) => item.product_like_asOf_null.gold_in_25 === 0,
).length;
const budgetA = questions.filter((item) => item.eval_as_of.lost_in_budget.length > 0);
const budgetB = questions.filter(
  (item) => item.product_like_asOf_null.lost_in_budget.length > 0,
);
const uniqueA = questions.map((item) => item.eval_as_of.unique_retrieved_chunks);
const uniqueB = questions.map(
  (item) => item.product_like_asOf_null.unique_retrieved_chunks,
);
const poolA = questions.map((item) => item.eval_as_of.unique_pool_size);
const poolB = questions.map((item) => item.product_like_asOf_null.unique_pool_size);
const poolLossA = questions.filter((item) => item.eval_as_of.lost_pool_to_25.length > 0);
const poolLossB = questions.filter(
  (item) => item.product_like_asOf_null.lost_pool_to_25.length > 0,
);
const nonGold8A = questions.map((item) => item.eval_as_of.non_gold_at_8);
const nonGold8B = questions.map((item) => item.product_like_asOf_null.non_gold_at_8);
const nonGold25A = questions.map((item) => item.eval_as_of.non_gold_at_25);
const nonGold25B = questions.map(
  (item) => item.product_like_asOf_null.non_gold_at_25,
);

const q14EvalLocators = q14?.eval_as_of.retrieved_locators_in_merge_order ?? [];
const q14ProductLocators =
  q14?.product_like_asOf_null.retrieved_locators_in_merge_order ?? [];

function locatorTrack(row: QuestionRow | undefined, key: string) {
  const pool = row?.eval_as_of.pool_locators_in_rank_order ?? [];
  const top25 = row?.eval_as_of.retrieved_locators_in_merge_order ?? [];
  const poolIndex = pool.indexOf(key);
  const capIndex = top25.indexOf(key);
  return {
    locator: key,
    in_full_union: poolIndex !== -1,
    position_before_cap: poolIndex === -1 ? null : poolIndex + 1,
    position_in_top25: capIndex === -1 ? null : capIndex + 1,
    in_top25: capIndex !== -1,
    in_top8: capIndex !== -1 && capIndex < ASK_CHUNK_MODEL_CAP,
  };
}

function conflictPositions(row: QuestionRow | undefined) {
  return {
    d15_s1: locatorTrack(row, "RP001-D15#S1"),
    d15_s3: locatorTrack(row, "RP001-D15#S3"),
  };
}

const goldLostPoolTo25A = questions.reduce(
  (sum, item) => sum + item.eval_as_of.lost_pool_to_25.length,
  0,
);
const goldLostPoolTo25B = questions.reduce(
  (sum, item) => sum + item.product_like_asOf_null.lost_pool_to_25.length,
  0,
);
const goldLost25To8A = questions.reduce(
  (sum, item) => sum + item.eval_as_of.lost_in_budget.length,
  0,
);
const goldLost25To8B = questions.reduce(
  (sum, item) => sum + item.product_like_asOf_null.lost_in_budget.length,
  0,
);

const frozenHistory = {
  baseline_mode_a: "0.046 / 0.046 / 0.046 / 0.046 / 0.046",
  experiment1_mode_a: "0.243 / 0.465 / 0.522 / 0.580 / 0.630",
  experiment2_mode_a: "0.212 / 0.498 / 0.619 / 0.724 / 0.850",
  experiment2_mode_b: "0.212 / 0.498 / 0.619 / 0.696 / 0.850",
};

const report = {
  slice: "4E-EXPERIMENT-3",
  label: STAGE4E_FTS_EXPERIMENT3_LABEL,
  not_production_retrieval: true,
  production_rpc: "search_project_document_chunks",
  production_rpc_unchanged: true,
  query_generation: "frozen Experiment 2 decomposeStage4eFtsExperiment2Question",
  frozen_lexicons: frozenLexicons,
  max_subqueries: STAGE4E_FTS_EXPERIMENT2_MAX_SUBQUERIES,
  max_appearances: STAGE4E_FTS_EXPERIMENT3_MAX_APPEARANCES,
  candidate_cap: STAGE4E_FTS_EXPERIMENT3_CANDIDATE_CAP,
  evidence_budget: ASK_CHUNK_MODEL_CAP,
  inverse_frequency_formula:
    "score(chunk) = SUM 1/H_q over generated subqueries q that returned the chunk; skip H_q = 0; H_q = RPC row count for that subquery call; gold/family/authority are not inputs",
  ordering:
    "inverse-frequency score DESC, then document_id ASC, locator ASC, part_index ASC, chunk_id ASC; cap 25 after ranking; first 8 = evidence budget",
  repeatability: "two identical hosted passes",
  hosted_rows_mutated: false,
  baseline_path: BASELINE_PATH,
  baseline_sha256: baselineSha,
  retrieval: {
    eval_as_of_mean_recall: recallMeansEval,
    product_like_mean_recall: recallMeansProduct,
  },
  diagnostics: {
    mode_a: {
      zero_hit_questions: zeroHitA,
      no_gold_at_25: noGoldA,
      budget_miss_count: budgetA.length,
      questions_with_budget_loss: budgetA.map((item) => item.id),
      questions_with_pool_to_25_loss: poolLossA.map((item) => item.id),
      gold_lost_pool_to_25: goldLostPoolTo25A,
      gold_lost_25_to_8: goldLost25To8A,
      mean_unique_candidates_after_cap: mean(uniqueA),
      mean_unique_pool_before_cap: mean(poolA),
      max_unique_pool_before_cap: Math.max(...poolA, 0),
      mean_non_gold_at_8: mean(nonGold8A),
      mean_non_gold_at_25: mean(nonGold25A),
      max_non_gold_at_25: Math.max(...nonGold25A, 0),
    },
    mode_b: {
      zero_hit_questions: zeroHitB,
      no_gold_at_25: noGoldB,
      budget_miss_count: budgetB.length,
      questions_with_budget_loss: budgetB.map((item) => item.id),
      questions_with_pool_to_25_loss: poolLossB.map((item) => item.id),
      gold_lost_pool_to_25: goldLostPoolTo25B,
      gold_lost_25_to_8: goldLost25To8B,
      mean_unique_candidates_after_cap: mean(uniqueB),
      mean_unique_pool_before_cap: mean(poolB),
      max_unique_pool_before_cap: Math.max(...poolB, 0),
      mean_non_gold_at_8: mean(nonGold8B),
      mean_non_gold_at_25: mean(nonGold25B),
      max_non_gold_at_25: Math.max(...nonGold25B, 0),
    },
  },
  frozen_history: frozenHistory,
  four_way_comparison: {
    baseline: {
      mode_a_recall: baseline.mode_a.mean_recall,
      mode_b_recall: baseline.mode_b.mean_recall,
      zero_hit: baseline.zero_hit_question_count,
      no_gold_at_25: baseline.no_gold_at_25_question_count,
      budget_misses: baseline.budget_miss_count,
    },
    experiment1: experiment1Compare,
    experiment2: experiment2Compare,
    experiment3: {
      mode_a_recall: recallMeansEval,
      mode_b_recall: recallMeansProduct,
      zero_hit_mode_a: zeroHitA,
      zero_hit_mode_b: zeroHitB,
      no_gold_at_25_mode_a: noGoldA,
      no_gold_at_25_mode_b: noGoldB,
      budget_misses_mode_a: budgetA.length,
      budget_misses_mode_b: budgetB.length,
    },
  },
  required_cases: {
    q01_conflict: {
      pair: q01?.conflict_pair ?? null,
      positions: conflictPositions(q01),
      d13_s1: locatorTrack(q01, "RP001-D13#S1"),
      d13_s2: locatorTrack(q01, "RP001-D13#S2"),
    },
    q09_conflict: { pair: q09?.conflict_pair ?? null, positions: conflictPositions(q09) },
    q02: {
      subqueries: q02?.generated_subqueries,
      gold_tracks: (q02?.gold_locators ?? []).map((key) => locatorTrack(q02, key)),
      eval: q02?.eval_as_of,
    },
    q03_temporal: {
      as_of: q03?.as_of,
      eval_hit_count: q03?.eval_as_of.hit_count,
      product_hit_count: q03?.product_like_asOf_null.hit_count,
      eval_pool_size: q03?.eval_as_of.unique_pool_size,
      product_pool_size: q03?.product_like_asOf_null.unique_pool_size,
      eval_later_issued: q03?.eval_as_of.later_than_question_as_of,
      product_like_later_issued: q03?.product_like_asOf_null.later_than_question_as_of,
      eval_gold_positions: q03?.eval_as_of.merged_order_positions,
      product_gold_positions: q03?.product_like_asOf_null.merged_order_positions,
      eval_pool_gold_positions: q03?.eval_as_of.pool_order_positions,
    },
    q14: {
      as_of: q14?.as_of,
      d14_s2: locatorTrack(q14, "RP001-D14#S2"),
      d14_s2_under_eval: q14EvalLocators.includes("RP001-D14#S2"),
      d15_under_eval: q14EvalLocators.some((key) => key.startsWith("RP001-D15#")),
      d15_under_product: q14ProductLocators.some((key) =>
        key.startsWith("RP001-D15#"),
      ),
      flags: q14?.secondary_flags ?? [],
    },
    q05: q05?.eval_as_of,
    q13: q13?.eval_as_of,
    q18: q18?.eval_as_of,
  },
  questions,
};

console.log("");
console.log("=== Stage 4E Experiment 3 scorecard (SHADOW; not Ask) ===");
console.log("Mode A mean Recall@1/3/5/8/25:", formatRecall(recallMeansEval));
console.log("Mode B mean Recall@1/3/5/8/25:", formatRecall(recallMeansProduct));
console.log(
  `Mode A zero-hit=${zeroHitA} no-gold@25=${noGoldA} pool→25 gold loss=${goldLostPoolTo25A} 25→8 gold loss=${goldLost25To8A} mean/max pool=${mean(poolA).toFixed(2)}/${Math.max(...poolA, 0)} mean unique@25=${mean(uniqueA).toFixed(2)} mean non-gold@8=${mean(nonGold8A).toFixed(2)} mean/max non-gold@25=${mean(nonGold25A).toFixed(2)}/${Math.max(...nonGold25A, 0)}`,
);
console.log(
  `Mode B zero-hit=${zeroHitB} no-gold@25=${noGoldB} pool→25 gold loss=${goldLostPoolTo25B} 25→8 gold loss=${goldLost25To8B} mean/max pool=${mean(poolB).toFixed(2)}/${Math.max(...poolB, 0)} mean unique@25=${mean(uniqueB).toFixed(2)} mean non-gold@8=${mean(nonGold8B).toFixed(2)} mean/max non-gold@25=${mean(nonGold25B).toFixed(2)}/${Math.max(...nonGold25B, 0)}`,
);
console.log("Frozen baseline Mode A:", frozenHistory.baseline_mode_a);
console.log("Frozen Experiment 1 Mode A:", frozenHistory.experiment1_mode_a);
console.log("Frozen Experiment 2 Mode A:", frozenHistory.experiment2_mode_a);
console.log("Frozen Experiment 2 Mode B:", frozenHistory.experiment2_mode_b);
if (experiment1Compare) {
  console.log(
    "Experiment 1 artifact Mode A:",
    formatRecall(experiment1Compare.eval_as_of_mean_recall),
  );
}
if (experiment2Compare) {
  console.log(
    "Experiment 2 artifact Mode A:",
    formatRecall(experiment2Compare.eval_as_of_mean_recall),
  );
}
for (const item of questions) {
  console.log(
    [
      item.id,
      `subs=${item.generated_subqueries.map((sub) => `${sub.query}[${sub.family}/${sub.signal}]`).join(" | ")}`,
      `H_q=${item.eval_as_of.per_subquery.map((sub) => sub.hit_count).join(",")}`,
      `pool=${item.eval_as_of.unique_pool_size} app=${item.eval_as_of.appearances} A@25=${item.eval_as_of.hit_count} goldPool=${item.eval_as_of.gold_in_pool} gold25=${item.eval_as_of.gold_in_25} gold8=${item.eval_as_of.gold_in_8} R@8=${item.eval_as_of.recall["@8"]?.toFixed(2)} R@25=${item.eval_as_of.recall["@25"]?.toFixed(2)} ng8=${item.eval_as_of.non_gold_at_8} ng25=${item.eval_as_of.non_gold_at_25}`,
    ].join(" "),
  );
}

console.log("");
console.log("STAGE4E_FTS_EXPERIMENT3_JSON");
console.log(JSON.stringify(report, null, 2));

mkdirSync("artifacts/ask-stage4e-fts", { recursive: true });
writeFileSync(ARTIFACT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote gitignored ${ARTIFACT_PATH}`);
console.log("ask-stage4e-fts-experiment3: shadow run complete (no production change)");
