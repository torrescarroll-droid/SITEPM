/**
 * Stage 4E Experiment 3 — deterministic inverse-frequency unit tests.
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
  STAGE4E_FTS_EXPERIMENT2_MAX_SUBQUERIES,
  decomposeStage4eFtsExperiment2Question,
  frozenStage4eFtsExperiment2Lexicons,
  mergeStage4eFtsExperiment2Hits,
} from "@/lib/ask-stage4e-fts-experiment2";
import {
  STAGE4E_FTS_EXPERIMENT3_CANDIDATE_CAP,
  STAGE4E_FTS_EXPERIMENT3_MAX_APPEARANCES,
  STAGE4E_FTS_EXPERIMENT3_MAX_SUBQUERIES,
  decomposeStage4eFtsExperiment3Question,
  rankStage4eFtsExperiment3Union,
  stage4eFtsExperiment3Contribution,
  stage4eFtsExperiment3HitCount,
  stage4eFtsExperiment3RankArityIsSourcesOnly,
} from "@/lib/ask-stage4e-fts-experiment3";
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

function hit(chunk: string, document = "d1"): DocumentChunkHit {
  return {
    company_id: "c",
    project_id: "p",
    document_id: document,
    extraction_id: "e",
    chunk_id: chunk,
    source_sha256: "a".repeat(64),
    content_kind: "markdown",
    locator: "S1",
    locator_type: "section",
    part_index: 0,
    source_issued_on: null,
    source_effective_on: null,
    body: "body",
  };
}

const question =
  "Where is the living-room radiant heating, which manifold serves it, and has it been serviced?";
assert(
  "reuse of Experiment 2 generation",
  JSON.stringify(decomposeStage4eFtsExperiment3Question(question)) ===
    JSON.stringify(decomposeStage4eFtsExperiment2Question(question)) &&
    decomposeStage4eFtsExperiment3Question ===
      decomposeStage4eFtsExperiment2Question,
);

const rare = [hit("rare")];
const common = Array.from({ length: 20 }, (_, i) => hit(`c${i}`));
assert("H_q calculation", stage4eFtsExperiment3HitCount(rare) === 1);
assert(
  "zero-hit query handling",
  stage4eFtsExperiment3Contribution(0) === 0 &&
    rankStage4eFtsExperiment3Union([
      { subqueryIndex: 0, query: "empty", hits: [] },
      { subqueryIndex: 1, query: "rare", hits: rare },
    ]).hits[0].chunk_id === "rare",
);
assert(
  "inverse-frequency contribution",
  stage4eFtsExperiment3Contribution(1) === 1 &&
    stage4eFtsExperiment3Contribution(5) === 0.2 &&
    stage4eFtsExperiment3Contribution(20) === 0.05,
);

const multi = rankStage4eFtsExperiment3Union([
  { subqueryIndex: 0, query: "rare", hits: [hit("both"), hit("only-rare")] },
  {
    subqueryIndex: 1,
    query: "common",
    hits: [hit("both"), ...common.slice(0, 9)],
  },
]);
const both = multi.ranked.find((item) => item.hit.chunk_id === "both");
assert(
  "multi-query contribution summation",
  both !== undefined &&
    Math.abs(both.score - (0.5 + 0.1)) < 1e-12 &&
    multi.hits[0].chunk_id === "both",
);

const dup = rankStage4eFtsExperiment3Union([
  { subqueryIndex: 0, query: "a", hits: [hit("same")] },
  { subqueryIndex: 1, query: "b", hits: [hit("same")] },
]);
assert("dedupe by chunk_id", dup.unique_pool_size === 1 && dup.appearances === 2);

const uncapped = rankStage4eFtsExperiment3Union(
  [
    {
      subqueryIndex: 0,
      query: "flood",
      hits: Array.from({ length: 25 }, (_, i) => hit(`f${String(i).padStart(2, "0")}`)),
    },
    {
      subqueryIndex: 1,
      query: "rare",
      hits: [hit("gold-rare", "d-z")],
    },
  ],
  25,
);
assert(
  "full union before cap",
  uncapped.unique_pool_size === 26 &&
    uncapped.appearances === 26 &&
    uncapped.hits.length === 25 &&
    uncapped.hits[0].chunk_id === "gold-rare" &&
    uncapped.ranked.length === 26,
);

assert(
  "maximum theoretical appearances 150",
  STAGE4E_FTS_EXPERIMENT3_MAX_APPEARANCES === 150 &&
    STAGE4E_FTS_EXPERIMENT3_MAX_SUBQUERIES ===
      STAGE4E_FTS_EXPERIMENT2_MAX_SUBQUERIES &&
    STAGE4E_FTS_EXPERIMENT3_MAX_SUBQUERIES * 25 === 150,
);

const orderA = rankStage4eFtsExperiment3Union([
  { subqueryIndex: 0, query: "q", hits: [hit("b", "d-b"), hit("a", "d-a")] },
]);
const orderB = rankStage4eFtsExperiment3Union([
  { subqueryIndex: 0, query: "q", hits: [hit("b", "d-b"), hit("a", "d-a")] },
]);
assert(
  "deterministic score ordering and tie breaking",
  orderA.hits[0].chunk_id === "a" &&
    JSON.stringify(orderA.hits.map((item) => item.chunk_id)) ===
      JSON.stringify(orderB.hits.map((item) => item.chunk_id)),
);

assert("cap25 after ranking", uncapped.hits.length === STAGE4E_FTS_EXPERIMENT3_CANDIDATE_CAP);

const fakeHits = [
  ...Array.from({ length: 7 }, (_, i) => ({
    document: "RP001-D01",
    locator: `N${i}`,
    part_index: 0,
    source_issued_on: null as string | null,
  })),
  { document: "RP001-D03", locator: "S2", part_index: 0, source_issued_on: null },
  { document: "RP001-D12", locator: "S3", part_index: 0, source_issued_on: null },
];
const gold = [
  { document: "RP001-D03", locator: "S2" },
  { document: "RP001-D12", locator: "S3" },
];
assert(
  "first8 analysis",
  ASK_CHUNK_MODEL_CAP === 8 &&
    goldFound(gold, fakeHits.slice(0, 8)).length === 1 &&
    goldFound(gold, fakeHits.slice(0, 25)).length === 2 &&
    goldLocatorKey("RP001-D12", "S3") === "RP001-D12#S3",
);

assert(
  "no gold input to ranking",
  stage4eFtsExperiment3RankArityIsSourcesOnly(rankStage4eFtsExperiment3Union) &&
    rankStage4eFtsExperiment3Union.length === 1,
);

assert(
  "no family weighting",
  !JSON.stringify(
    rankStage4eFtsExperiment3Union([
      { subqueryIndex: 0, query: "living room", hits: [hit("loc")] },
    ]).ranked,
  ).includes("broad_location"),
);

const exp1 = decomposeStage4eFtsExperiment1Question(question);
assert(
  "Experiment 1 unchanged",
  JSON.stringify(exp1.map((item) => item.query)) ===
    JSON.stringify([
      "living room",
      "radiant heating",
      "manifold serves",
      "serviced",
    ]) && mergeStage4eFtsExperiment1Hits.length === 1,
);

assert(
  "Experiment 2 unchanged",
  frozenStage4eFtsExperiment2Lexicons().weak_discourse.includes("says") &&
    mergeStage4eFtsExperiment2Hits.length === 1,
);

const baselineBytes = readFileSync(
  "docs/reference-projects/001/evaluations/stage4e-b-fts-baseline-v1.json",
);
assert(
  "baseline artifact unchanged",
  createHash("sha256").update(baselineBytes).digest("hex") ===
    "f6395382a05c4e80cd3db2dd8db32eb8bd24a416c25a5ad89bbf6a1762439a1a",
);

function spawnExperiment3Hosted(envOverrides: Record<string, string | undefined>) {
  const env = { ...process.env };
  for (const name of STAGE4E_FTS_REQUIRED_ENV) {
    env[name] = "   ";
  }
  for (const [key, value] of Object.entries(envOverrides)) {
    env[key] = value === undefined ? "   " : value;
  }
  return spawnSync(
    process.execPath,
    ["scripts/run-ask-stage4e-fts-experiment3.mjs"],
    { encoding: "utf8", env, timeout: 20000 },
  );
}

const absent = spawnExperiment3Hosted({});
assert("experiment3 hosted all-absent SKIP exit 0", absent.status === 0);
assert(
  "experiment3 hosted all-absent prints SKIP",
  (absent.stdout + absent.stderr).includes("SKIP Stage 4E Experiment 3"),
);

if (failed > 0) {
  console.error(`ask-stage4e-fts-experiment3-unit: ${failed} failed`);
  process.exit(1);
}
console.log("ask-stage4e-fts-experiment3-unit: ok");
