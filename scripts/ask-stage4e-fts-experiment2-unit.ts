/**
 * Stage 4E Experiment 2 — deterministic shadow-retrieval unit tests.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ASK_CHUNK_MODEL_CAP } from "@/lib/ask-evidence";
import { STAGE4E_FTS_REQUIRED_ENV } from "@/lib/ask-stage4e-fts";
import {
  decomposeStage4eFtsExperiment1Question,
  mergeStage4eFtsExperiment1Hits,
} from "@/lib/ask-stage4e-fts-experiment1";
import {
  STAGE4E_FTS_EXPERIMENT2_CANDIDATE_CAP,
  STAGE4E_FTS_EXPERIMENT2_MAX_SUBQUERIES,
  classifyStage4eFtsExperiment2Token,
  decomposeStage4eFtsExperiment2Question,
  frozenStage4eFtsExperiment2Lexicons,
  mergeStage4eFtsExperiment2Hits,
  stage4eFtsExperiment2BroadQueryCount,
  stage4eFtsExperiment2DecomposeArityIsQuestionOnly,
} from "@/lib/ask-stage4e-fts-experiment2";
import { goldFound, goldLocatorKey } from "@/lib/ask-stage4e-score";
import type { DocumentChunkHit } from "@/lib/document-intelligence-types";

let failed = 0;
function assert(name: string, condition: boolean) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`PASS ${name}`);
}

function hit(chunk: string, document = "d1", locator = "S1"): DocumentChunkHit {
  return {
    company_id: "c",
    project_id: "p",
    document_id: document,
    extraction_id: "e",
    chunk_id: chunk,
    source_sha256: "a".repeat(64),
    content_kind: "markdown",
    locator,
    locator_type: "section",
    part_index: 0,
    source_issued_on: null,
    source_effective_on: null,
    body: "body",
  };
}

assert(
  "decomposer arity is question-string only",
  stage4eFtsExperiment2DecomposeArityIsQuestionOnly(
    decomposeStage4eFtsExperiment2Question,
  ),
);

const lex = frozenStage4eFtsExperiment2Lexicons();
assert(
  "family classification uses closed lexicons",
  classifyStage4eFtsExperiment2Token("manifold") === "component" &&
    classifyStage4eFtsExperiment2Token("living") === "broad_location" &&
    classifyStage4eFtsExperiment2Token("installed") === "action_event" &&
    classifyStage4eFtsExperiment2Token("contract") === "document_business" &&
    classifyStage4eFtsExperiment2Token("says") === "weak_discourse" &&
    lex.broad_location.includes("living") &&
    lex.weak_discourse.includes("says"),
);

const q04 = decomposeStage4eFtsExperiment2Question(
  "Why does an early plan say RH-01 while the as-built says RH-02?",
);
assert(
  "weak-discourse tokens are not subqueries",
  q04.every((item) => item.query !== "say" && item.query !== "says") &&
    !q04.some((item) => item.query === "say says"),
);

const q02 = decomposeStage4eFtsExperiment2Question(
  "Who installed the radiant system, under which contract, and whom should the record direct service inquiries to?",
);
assert(
  "no arbitrary adjacent-bigram generation",
  !q02.some((item) =>
    ["installed radiant", "system contract", "record direct", "service inquiries"].includes(
      item.query,
    ),
  ) &&
    q02.some((item) => item.query === "radiant") &&
    q02.some((item) => item.query === "installed"),
);

const q01 = decomposeStage4eFtsExperiment2Question(
  "Where is the living-room radiant heating, which manifold serves it, and has it been serviced?",
);
assert(
  "at most one broad-location query",
  stage4eFtsExperiment2BroadQueryCount(q01) === 1 &&
    q01.filter((item) => item.query === "living room").length === 1,
);
assert(
  "fan-out is bounded",
  q01.length >= 2 && q01.length <= STAGE4E_FTS_EXPERIMENT2_MAX_SUBQUERIES,
);
assert(
  "hyphen location phrase is preserved as broad",
  q01.some(
    (item) =>
      item.query === "living room" &&
      item.family === "broad_location" &&
      item.signal === "broad",
  ),
);

const fallback = decomposeStage4eFtsExperiment2Question(
  "What is the foobar bazqux leftover?",
);
assert(
  "fallback joins leftover useful tokens from the literal question",
  fallback.length === 1 &&
    fallback[0].origin === "fallback_join" &&
    fallback[0].query === "foobar bazqux leftover" &&
    fallback[0].family === "fallback",
);

assert(
  "decomposer is not invoked with a question id argument",
  decomposeStage4eFtsExperiment2Question.length === 1,
);

const mergeHits = mergeStage4eFtsExperiment2Hits([
  {
    subqueryIndex: 0,
    query: "living room",
    signal: "broad",
    family: "broad_location",
    hits: [hit("loc-generic"), hit("loc-gold-late")],
  },
  {
    subqueryIndex: 1,
    query: "actuator",
    signal: "narrow",
    family: "component",
    hits: [hit("narrow-gold")],
  },
]);
assert(
  "narrow-vs-broad merge ranks narrow matches first",
  mergeHits[0].chunk_id === "narrow-gold" &&
    mergeHits[1].chunk_id === "loc-generic",
);

const dup = mergeStage4eFtsExperiment2Hits([
  {
    subqueryIndex: 0,
    query: "manifold",
    signal: "narrow",
    family: "component",
    hits: [hit("same")],
  },
  {
    subqueryIndex: 1,
    query: "serviced",
    signal: "narrow",
    family: "action_event",
    hits: [hit("same")],
  },
]);
assert("merge dedupes by chunk_id", dup.length === 1);

const many = mergeStage4eFtsExperiment2Hits([
  {
    subqueryIndex: 0,
    query: "system",
    signal: "narrow",
    family: "component",
    hits: Array.from({ length: 30 }, (_, i) => hit(`c${String(i).padStart(2, "0")}`)),
  },
]);
assert("merge cap is 25", many.length === STAGE4E_FTS_EXPERIMENT2_CANDIDATE_CAP);

const orderA = mergeStage4eFtsExperiment2Hits([
  {
    subqueryIndex: 0,
    query: "paint",
    signal: "narrow",
    family: "component",
    hits: [hit("b", "d-b"), hit("a", "d-a")],
  },
]);
const orderB = mergeStage4eFtsExperiment2Hits([
  {
    subqueryIndex: 0,
    query: "paint",
    signal: "narrow",
    family: "component",
    hits: [hit("b", "d-b"), hit("a", "d-a")],
  },
]);
assert(
  "merge ordering is deterministic",
  JSON.stringify(orderA.map((item) => item.chunk_id)) ===
    JSON.stringify(orderB.map((item) => item.chunk_id)),
);

const fakeHits = [
  ...Array.from({ length: 7 }, (_, i) => ({
    document: "RP001-D01",
    locator: `N${i}`,
    part_index: 0,
    source_issued_on: null,
  })),
  { document: "RP001-D03", locator: "S2", part_index: 0, source_issued_on: null },
  { document: "RP001-D12", locator: "S3", part_index: 0, source_issued_on: null },
];
const gold = [
  { document: "RP001-D03", locator: "S2" },
  { document: "RP001-D12", locator: "S3" },
];
const at8 = fakeHits.slice(0, ASK_CHUNK_MODEL_CAP);
const at25 = fakeHits.slice(0, 25);
assert(
  "first-8 analysis uses production budget cap 8",
  ASK_CHUNK_MODEL_CAP === 8 &&
    goldFound(gold, at8).length === 1 &&
    goldFound(gold, at25).length === 2 &&
    goldLocatorKey("RP001-D12", "S3") === "RP001-D12#S3",
);

const baselineBytes = readFileSync(
  "docs/reference-projects/001/evaluations/stage4e-b-fts-baseline-v1.json",
);
assert(
  "immutable baseline artifact bytes are unchanged",
  createHash("sha256").update(baselineBytes).digest("hex") ===
    "f6395382a05c4e80cd3db2dd8db32eb8bd24a416c25a5ad89bbf6a1762439a1a" &&
    baselineBytes.includes("DO NOT OVERWRITE"),
);

const exp1 = decomposeStage4eFtsExperiment1Question(
  "Where is the living-room radiant heating, which manifold serves it, and has it been serviced?",
);
assert(
  "Experiment 1 behavior remains unchanged",
  JSON.stringify(exp1.map((item) => item.query)) ===
    JSON.stringify([
      "living room",
      "radiant heating",
      "manifold serves",
      "serviced",
    ]) && mergeStage4eFtsExperiment1Hits.length === 1,
);

assert(
  "merge function does not take gold or question id",
  mergeStage4eFtsExperiment2Hits.length === 1,
);

function spawnExperiment2Hosted(envOverrides: Record<string, string | undefined>) {
  const env = { ...process.env };
  for (const name of STAGE4E_FTS_REQUIRED_ENV) {
    env[name] = "   ";
  }
  for (const [key, value] of Object.entries(envOverrides)) {
    env[key] = value === undefined ? "   " : value;
  }
  return spawnSync(
    process.execPath,
    ["scripts/run-ask-stage4e-fts-experiment2.mjs"],
    { encoding: "utf8", env, timeout: 20000 },
  );
}

const absent = spawnExperiment2Hosted({});
assert("experiment2 hosted all-absent SKIP exit 0", absent.status === 0);
assert(
  "experiment2 hosted all-absent prints SKIP",
  (absent.stdout + absent.stderr).includes("SKIP Stage 4E Experiment 2"),
);

if (failed > 0) {
  console.error(`ask-stage4e-fts-experiment2-unit: ${failed} failed`);
  process.exit(1);
}
console.log("ask-stage4e-fts-experiment2-unit: ok");
