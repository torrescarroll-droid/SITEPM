/**
 * Stage 4E retrieval Experiment 1 — hosted SHADOW evaluator.
 * NOT production retrieval. Does not mutate hosted rows.
 * JWT → RLS → existing search_project_document_chunks (one call per subquery).
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ASK_CHUNK_MODEL_CAP } from "@/lib/ask-evidence";
import {
  STAGE4E_FTS_EXPERIMENT1_CANDIDATE_CAP,
  STAGE4E_FTS_EXPERIMENT1_LABEL,
  STAGE4E_FTS_EXPERIMENT1_MAX_SUBQUERIES,
  decomposeStage4eFtsExperiment1Question,
  mergeStage4eFtsExperiment1HitsDetailed,
} from "@/lib/ask-stage4e-fts-experiment1";
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
const ARTIFACT_PATH = "artifacts/ask-stage4e-fts/experiment1-last-run.json";

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

const envDecision = classifyBenchEnv((name) => benchEnv(name));
if (envDecision.kind === "skip") {
  console.log(
    `SKIP Stage 4E Experiment 1: ${envDecision.missing.join(", ")} not provided.`,
  );
  process.exit(0);
}
if (envDecision.kind === "partial") {
  console.error(
    `FAIL Experiment 1: partial SITEPM_BENCH_* environment; missing ${envDecision.missing.join(", ")}`,
  );
  process.exit(1);
}

if (!isUuid(projectId)) {
  console.error("FAIL Experiment 1: SITEPM_BENCH_PROJECT_ID is not a UUID");
  process.exit(1);
}

function failInfrastructure(reason: string): never {
  console.error(`FAIL Experiment 1: ${reason}`);
  process.exit(1);
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
  questions: Array<{
    id: string;
    hit_count: number;
    gold_retrieved_at_25: string[];
  }>;
};

console.log(STAGE4E_FTS_EXPERIMENT1_LABEL);
console.log("Production RPC unchanged. Evaluator-only multi-query shadow.");
console.log(`Immutable baseline SHA-256 ${baselineSha}`);
console.log(
  `Fan-out max ${STAGE4E_FTS_EXPERIMENT1_MAX_SUBQUERIES}; candidate cap ${STAGE4E_FTS_EXPERIMENT1_CANDIDATE_CAP}; budget ${ASK_CHUNK_MODEL_CAP}`,
);

const truth = parseStage4eGroundTruth(
  JSON.parse(readFileSync(join(RP001_ROOT, "ground-truth.json"), "utf8")),
);
const { byDocumentId, bySource } = buildRp001DocumentIdMap();
const fixtureDocumentIds = [...bySource.values()];

let benchIdentity;
try {
  benchIdentity = await passwordSession(email, password);
} catch {
  failInfrastructure("authentication failed");
}
if (!emailsMatch(benchIdentity.email, email)) {
  failInfrastructure("benchmark session identity does not match SITEPM_BENCH_EMAIL");
}

const bench = clientFor(benchIdentity.accessToken);

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
  failInfrastructure("fixture integrity blocks Experiment 1 scoring");
}
console.log(
  "PASS fixture integrity: 15/15/expected locators (SELECT only; no writes)",
);

function scoreMerged(
  gold: Stage4eGoldLocator[],
  hits: DocumentChunkHit[],
  rpcAsOf: string | null,
  questionAsOf: string,
  subqueryCount: number,
  subqueries: Array<{ query: string; origin: string }>,
  matchCountByChunk: Map<string, number>,
) {
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
  const hitsPerGold = foundGold.map((item) => {
    const hit = hits.find(
      (candidate) =>
        byDocumentId.get(candidate.document_id) === item.document &&
        candidate.locator === item.locator,
    );
    return {
      locator: goldLocatorKey(item.document, item.locator),
      subquery_match_count: hit ? (matchCountByChunk.get(hit.chunk_id) ?? 1) : 0,
    };
  });
  return {
    as_of: rpcAsOf,
    subquery_count: subqueryCount,
    subqueries,
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
) {
  const subqueries = decomposeStage4eFtsExperiment1Question(questionText);
  const sources = [];
  for (let index = 0; index < subqueries.length; index += 1) {
    const subquery = subqueries[index];
    const hits = await searchChunks(bench, subquery.query, asOf);
    sources.push({
      subqueryIndex: index,
      query: subquery.query,
      hits,
    });
  }
  const merged = mergeStage4eFtsExperiment1HitsDetailed(sources);
  const matchCountByChunk = new Map(
    merged.meta.map((item) => [item.chunk_id, item.matchCount]),
  );
  return { subqueries, merged, matchCountByChunk };
}

type QuestionRow = {
  id: string;
  question: string;
  as_of: string;
  gold_locators: string[];
  generated_subqueries: Array<{ query: string; origin: string }>;
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
    const evalRetrieved = await retrieveMerged(question.question, question.as_of);
    const productRetrieved = await retrieveMerged(question.question, null);
    if (
      JSON.stringify(evalRetrieved.subqueries) !==
      JSON.stringify(productRetrieved.subqueries)
    ) {
      throw new Error("subquery generation must not depend on as_of");
    }
    const evalMode = scoreMerged(
      gold,
      evalRetrieved.merged.hits,
      question.as_of,
      question.as_of,
      evalRetrieved.subqueries.length,
      evalRetrieved.subqueries,
      evalRetrieved.matchCountByChunk,
    );
    const productMode = scoreMerged(
      gold,
      productRetrieved.merged.hits,
      null,
      question.as_of,
      productRetrieved.subqueries.length,
      productRetrieved.subqueries,
      productRetrieved.matchCountByChunk,
    );
    const evalAt25 = mapHitsToEvaluatorRefs(
      evalRetrieved.merged.hits,
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
      const body = evalRetrieved.merged.hits.find(
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
  return JSON.stringify(
    questions.map((item) => ({
      id: item.id,
      subqueries: item.generated_subqueries,
      eval: {
        locators: item.eval_as_of.retrieved_locators_in_merge_order,
        recall: item.eval_as_of.recall,
        hits: item.eval_as_of.hit_count,
      },
      product: {
        locators: item.product_like_asOf_null.retrieved_locators_in_merge_order,
        recall: item.product_like_asOf_null.recall,
        hits: item.product_like_asOf_null.hit_count,
      },
    })),
  );
}

console.log("=== Experiment 1 pass 1 ===");
const pass1 = await runPass();
console.log("=== Experiment 1 pass 2 (repeatability) ===");
const pass2 = await runPass();
if (repeatabilityCore(pass1) !== repeatabilityCore(pass2)) {
  console.error("FAIL Experiment 1: nondeterminism between identical hosted passes");
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
const nonGold8A = questions.map((item) => item.eval_as_of.non_gold_at_8);
const nonGold8B = questions.map((item) => item.product_like_asOf_null.non_gold_at_8);
const nonGold25A = questions.map((item) => item.eval_as_of.non_gold_at_25);
const nonGold25B = questions.map(
  (item) => item.product_like_asOf_null.non_gold_at_25,
);

const q14EvalLocators = q14?.eval_as_of.retrieved_locators_in_merge_order ?? [];
const q14ProductLocators =
  q14?.product_like_asOf_null.retrieved_locators_in_merge_order ?? [];

const report = {
  slice: "4E-EXPERIMENT-1",
  label: STAGE4E_FTS_EXPERIMENT1_LABEL,
  not_production_retrieval: true,
  production_rpc: "search_project_document_chunks",
  production_rpc_unchanged: true,
  max_subqueries: STAGE4E_FTS_EXPERIMENT1_MAX_SUBQUERIES,
  candidate_cap: STAGE4E_FTS_EXPERIMENT1_CANDIDATE_CAP,
  evidence_budget: ASK_CHUNK_MODEL_CAP,
  merge_algorithm:
    "dedupe chunk_id; sort matchCount DESC, best RPC position ASC, first subquery index ASC, then document_id/locator/part_index/chunk_id ASC; cap 25",
  decomposition:
    "literal question only: hyphen construction phrases (skip date-like), remaining non-stop non-numeric tokens as non-overlapping bigrams plus leftover unigram, fan-out 6",
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
      mean_unique_candidates: mean(uniqueA),
      mean_non_gold_at_8: mean(nonGold8A),
      mean_non_gold_at_25: mean(nonGold25A),
      max_non_gold_at_25: Math.max(...nonGold25A, 0),
    },
    mode_b: {
      zero_hit_questions: zeroHitB,
      no_gold_at_25: noGoldB,
      budget_miss_count: budgetB.length,
      questions_with_budget_loss: budgetB.map((item) => item.id),
      mean_unique_candidates: mean(uniqueB),
      mean_non_gold_at_8: mean(nonGold8B),
      mean_non_gold_at_25: mean(nonGold25B),
      max_non_gold_at_25: Math.max(...nonGold25B, 0),
    },
  },
  comparison_to_immutable_baseline: {
    mode_a_recall_baseline: baseline.mode_a.mean_recall,
    mode_a_recall_experiment: recallMeansEval,
    mode_b_recall_baseline: baseline.mode_b.mean_recall,
    mode_b_recall_experiment: recallMeansProduct,
    baseline_zero_hit: baseline.zero_hit_question_count,
    experiment_zero_hit_mode_a: zeroHitA,
    experiment_zero_hit_mode_b: zeroHitB,
    baseline_no_gold_at_25: baseline.no_gold_at_25_question_count,
    experiment_no_gold_at_25_mode_a: noGoldA,
    experiment_no_gold_at_25_mode_b: noGoldB,
    baseline_budget_misses: baseline.budget_miss_count,
    experiment_budget_misses_mode_a: budgetA.length,
    experiment_budget_misses_mode_b: budgetB.length,
  },
  budget: {
    model_cap: ASK_CHUNK_MODEL_CAP,
    q01_conflict_pair: q01?.conflict_pair ?? null,
    q09_conflict_pair: q09?.conflict_pair ?? null,
  },
  temporal: {
    q03: {
      as_of: q03?.as_of,
      eval_hit_count: q03?.eval_as_of.hit_count,
      product_hit_count: q03?.product_like_asOf_null.hit_count,
      eval_later_issued: q03?.eval_as_of.later_than_question_as_of,
      product_like_later_issued: q03?.product_like_asOf_null.later_than_question_as_of,
      eval_empty_masked: q03?.eval_as_of.hit_count === 0,
    },
    q14: {
      as_of: q14?.as_of,
      eval_empty_masked: (q14?.eval_as_of.hit_count ?? 0) === 0,
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
  controls: {
    q05: {
      eval: q05?.eval_as_of,
      product: q05?.product_like_asOf_null,
    },
    q13: {
      eval: q13?.eval_as_of,
      product: q13?.product_like_asOf_null,
    },
    q18: {
      eval: q18?.eval_as_of,
      product: q18?.product_like_asOf_null,
    },
  },
  questions,
};

console.log("");
console.log("=== Stage 4E Experiment 1 scorecard (SHADOW; not Ask) ===");
console.log("Mode A mean Recall@1/3/5/8/25:", formatRecall(recallMeansEval));
console.log("Mode B mean Recall@1/3/5/8/25:", formatRecall(recallMeansProduct));
console.log(
  `Mode A zero-hit=${zeroHitA} no-gold@25=${noGoldA} budget-miss=${budgetA.length} mean unique=${mean(uniqueA).toFixed(2)} mean non-gold@8=${mean(nonGold8A).toFixed(2)} mean/max non-gold@25=${mean(nonGold25A).toFixed(2)}/${Math.max(...nonGold25A, 0)}`,
);
console.log(
  `Mode B zero-hit=${zeroHitB} no-gold@25=${noGoldB} budget-miss=${budgetB.length} mean unique=${mean(uniqueB).toFixed(2)} mean non-gold@8=${mean(nonGold8B).toFixed(2)} mean/max non-gold@25=${mean(nonGold25B).toFixed(2)}/${Math.max(...nonGold25B, 0)}`,
);
console.log(
  "Baseline Mode A:",
  formatRecall(baseline.mode_a.mean_recall),
  "Mode B:",
  formatRecall(baseline.mode_b.mean_recall),
);
for (const item of questions) {
  console.log(
    [
      item.id,
      `subs=${item.generated_subqueries.map((sub) => `"${sub.query}"`).join(" | ")}`,
      `A hits=${item.eval_as_of.hit_count} gold25=${item.eval_as_of.gold_in_25} gold8=${item.eval_as_of.gold_in_8} R@8=${item.eval_as_of.recall["@8"]?.toFixed(2)} R@25=${item.eval_as_of.recall["@25"]?.toFixed(2)}`,
      `B hits=${item.product_like_asOf_null.hit_count} gold25=${item.product_like_asOf_null.gold_in_25}`,
    ].join(" "),
  );
}

console.log("");
console.log("STAGE4E_FTS_EXPERIMENT1_JSON");
console.log(JSON.stringify(report, null, 2));

mkdirSync("artifacts/ask-stage4e-fts", { recursive: true });
writeFileSync(ARTIFACT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote gitignored ${ARTIFACT_PATH}`);
console.log("ask-stage4e-fts-experiment1: shadow run complete (no production change)");
