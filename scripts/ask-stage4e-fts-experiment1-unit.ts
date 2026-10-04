/**
 * Stage 4E Experiment 1 — deterministic shadow-retrieval unit tests.
 * Does not authenticate or call hosted RPC.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ASK_CHUNK_MODEL_CAP } from "@/lib/ask-evidence";
import {
  STAGE4E_FTS_EXPERIMENT1_CANDIDATE_CAP,
  STAGE4E_FTS_EXPERIMENT1_MAX_SUBQUERIES,
  decomposeStage4eFtsExperiment1Question,
  mergeStage4eFtsExperiment1Hits,
  stage4eFtsExperiment1DecomposeArityIsQuestionOnly,
} from "@/lib/ask-stage4e-fts-experiment1";
import { STAGE4E_FTS_REQUIRED_ENV } from "@/lib/ask-stage4e-fts";
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

assert(
  "decomposer arity is question-string only",
  stage4eFtsExperiment1DecomposeArityIsQuestionOnly(
    decomposeStage4eFtsExperiment1Question,
  ),
);

const q01 =
  "Where is the living-room radiant heating, which manifold serves it, and has it been serviced?";
const q01a = decomposeStage4eFtsExperiment1Question(q01);
const q01b = decomposeStage4eFtsExperiment1Question(q01);
assert(
  "decomposition is deterministic",
  JSON.stringify(q01a) === JSON.stringify(q01b),
);
assert(
  "fan-out is bounded",
  q01a.length >= 2 &&
    q01a.length <= STAGE4E_FTS_EXPERIMENT1_MAX_SUBQUERIES &&
    q01a.every((item) => item.query.length > 0),
);
assert(
  "hyphenated construction phrase is preserved",
  q01a.some((item) => item.query === "living room"),
);
assert(
  "question scaffolding is not a subquery",
  !q01a.some((item) => /\b(where|which|who|would|can)\b/.test(item.query)),
);
assert(
  "decomposer is not invoked with a question id argument",
  decomposeStage4eFtsExperiment1Question.length === 1,
);

const q03 = decomposeStage4eFtsExperiment1Question(
  "As of 2027-02-20, which manifold was designed for the living room?",
);
assert(
  "ISO dates are not forced into every subquery",
  q03.every((item) => !/2027/.test(item.query) && !item.query.includes("02")),
);
assert(
  "construction tokens survive date stripping",
  q03.some((item) => item.query.includes("manifold")) &&
    q03.some((item) => item.query.includes("living") || item.query.includes("room")),
);

function hit(overrides: Partial<DocumentChunkHit> & { chunk_id: string }): DocumentChunkHit {
  return {
    company_id: "11111111-1111-4111-8111-111111111111",
    project_id: "22222222-2222-4222-8222-222222222222",
    document_id: "33333333-3333-4333-8333-333333333333",
    extraction_id: "44444444-4444-4444-8444-444444444444",
    source_sha256: "a".repeat(64),
    content_kind: "markdown",
    locator: "S1",
    locator_type: "section",
    part_index: 0,
    source_issued_on: "2027-01-08",
    source_effective_on: null,
    body: "body",
    ...overrides,
  };
}

const alpha = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const beta = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const extra = Array.from({ length: 30 }, (_, i) =>
  hit({
    chunk_id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    locator: `X${i}`,
  }),
);
const merged = mergeStage4eFtsExperiment1Hits([
  {
    subqueryIndex: 0,
    query: "living room",
    hits: [hit({ chunk_id: alpha, locator: "S1" }), extra[0]],
  },
  {
    subqueryIndex: 1,
    query: "manifold",
    hits: [
      extra[1],
      hit({ chunk_id: alpha, locator: "S1" }),
      hit({ chunk_id: beta, locator: "S3" }),
    ],
  },
]);
assert(
  "merge dedupes by chunk_id",
  merged.filter((item) => item.chunk_id === alpha).length === 1,
);
assert(
  "merge prefers chunks found by more subqueries",
  merged[0]?.chunk_id === alpha,
);
assert(
  "merge cap is 25",
  mergeStage4eFtsExperiment1Hits([
    { subqueryIndex: 0, query: "q", hits: extra },
  ]).length === STAGE4E_FTS_EXPERIMENT1_CANDIDATE_CAP,
);

const ordered = mergeStage4eFtsExperiment1Hits([
  {
    subqueryIndex: 0,
    query: "a",
    hits: extra,
  },
]);
const orderedAgain = mergeStage4eFtsExperiment1Hits([
  {
    subqueryIndex: 0,
    query: "a",
    hits: extra,
  },
]);
assert(
  "merge ordering is deterministic",
  JSON.stringify(ordered.map((item) => item.chunk_id)) ===
    JSON.stringify(orderedAgain.map((item) => item.chunk_id)),
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

assert(
  "merge function does not take gold or question id",
  mergeStage4eFtsExperiment1Hits.length === 1,
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

function spawnExperiment1Hosted(envOverrides: Record<string, string | undefined>) {
  const env = { ...process.env };
  for (const name of STAGE4E_FTS_REQUIRED_ENV) {
    env[name] = "   ";
  }
  for (const [key, value] of Object.entries(envOverrides)) {
    env[key] = value === undefined ? "   " : value;
  }
  return spawnSync(
    process.execPath,
    ["scripts/run-ask-stage4e-fts-experiment1.mjs"],
    { encoding: "utf8", env, timeout: 20000 },
  );
}

const absent = spawnExperiment1Hosted({});
assert("experiment1 hosted all-absent SKIP exit 0", absent.status === 0);
assert(
  "experiment1 hosted all-absent prints SKIP",
  (absent.stdout + absent.stderr).includes("SKIP Stage 4E Experiment 1"),
);

if (failed > 0) {
  console.error(`ask-stage4e-fts-experiment1-unit: ${failed} failed`);
  process.exit(1);
}
console.log("ask-stage4e-fts-experiment1-unit: ok");
