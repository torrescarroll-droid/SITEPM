/**
 * Stage 4E Experiment 4 — deterministic role-lite deferral unit tests.
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
  decomposeStage4eFtsExperiment2Question,
  frozenStage4eFtsExperiment2Lexicons,
  mergeStage4eFtsExperiment2Hits,
} from "@/lib/ask-stage4e-fts-experiment2";
import {
  rankStage4eFtsExperiment3Union,
  stage4eFtsExperiment3Contribution,
} from "@/lib/ask-stage4e-fts-experiment3";
import {
  STAGE4E_FTS_EXPERIMENT4_CANDIDATE_CAP,
  STAGE4E_FTS_EXPERIMENT4_DEFERRAL_FRAMES,
  STAGE4E_FTS_EXPERIMENT4_MAX_APPEARANCES,
  classifyStage4eFtsExperiment4Deferral,
  decomposeStage4eFtsExperiment4Question,
  normalizeStage4eFtsExperiment4Text,
  orderStage4eFtsExperiment4,
  rankStage4eFtsExperiment4Union,
  stage4eFtsExperiment4OrderArityIsLexicalOnly,
} from "@/lib/ask-stage4e-fts-experiment4";
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

function hit(chunk: string, document = "d1", body = "body"): DocumentChunkHit {
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
    body,
  };
}

const question =
  "Where is the living-room radiant heating, which manifold serves it, and has it been serviced?";
assert(
  "frozen Exp2 generator reuse",
  decomposeStage4eFtsExperiment4Question ===
    decomposeStage4eFtsExperiment2Question &&
    JSON.stringify(decomposeStage4eFtsExperiment4Question(question)) ===
      JSON.stringify(decomposeStage4eFtsExperiment2Question(question)),
);

const rare = [hit("rare", "d1", "assertive lengths A=246")];
const pointer = [
  hit(
    "ptr",
    "d2",
    "Engineer review requested; final acceptance and lengths are recorded in S2 of the as-built.",
  ),
];
const lexical = rankStage4eFtsExperiment3Union([
  { subqueryIndex: 0, query: "rare", hits: rare },
  { subqueryIndex: 1, query: "flood", hits: [pointer[0], ...Array.from({ length: 20 }, (_, i) => hit(`f${i}`))] },
]);
assert(
  "frozen Exp3 union behavior",
  lexical.unique_pool_size === 22 && lexical.appearances === 22,
);
assert(
  "frozen Exp3 lexical score",
  stage4eFtsExperiment3Contribution(5) === 0.2 &&
    lexical.ranked[0].hit.chunk_id === "rare",
);

assert(
  "detector normalization",
  normalizeStage4eFtsExperiment4Text("  ARE\nRecorded   IN  ") ===
    "are recorded in",
);

for (const frame of STAGE4E_FTS_EXPERIMENT4_DEFERRAL_FRAMES) {
  const classified = classifyStage4eFtsExperiment4Deferral(
    `The requested values ${frame} S2 of the later record.`,
  );
  assert(`frozen deferral pattern: ${frame}`, classified.is_deferral && classified.matched_frame === frame);
}

assert(
  "negative assertion: states quantities without relocation frame",
  !classifyStage4eFtsExperiment4Deferral(
    "Recorded installed lengths A=246 ft, B=239 ft per installer measure.",
  ).is_deferral,
);
assert(
  "negative assertion: conflict pole cites sibling without relocation frame",
  !classifyStage4eFtsExperiment4Deferral(
    'Owner email says both actuators were changed. This conflicts with the technician narrative in S1, which records only port 3 replacement.',
  ).is_deferral,
);
assert(
  "cross-reference that should NOT automatically imply deferral (see + locator)",
  !classifyStage4eFtsExperiment4Deferral(
    "See S2 and S3 for related tags. Product approval does not demonstrate that the product was installed.",
  ).is_deferral,
);
assert(
  "refer without copular recorded-in frame is not deferral",
  !classifyStage4eFtsExperiment4Deferral(
    "Refer S3 for closeout gaps. Kitchen stone is specified here.",
  ).is_deferral,
);
assert(
  "documented in this package without locator token is not deferral",
  !classifyStage4eFtsExperiment4Deferral(
    "No subsequent tubing modification is documented in this package through this handoff date.",
  ).is_deferral,
);

const mixed = rankStage4eFtsExperiment4Union([
  { subqueryIndex: 0, query: "rare", hits: pointer },
  {
    subqueryIndex: 1,
    query: "common",
    hits: [rare[0], ...Array.from({ length: 8 }, (_, i) => hit(`c${i}`))],
  },
]);
assert(
  "pointer remains in union",
  mixed.unique_pool_size === 10 &&
    mixed.ordered.some((item) => item.hit.chunk_id === "ptr"),
);
assert(
  "assertive-before-deferral ordering",
  mixed.hits[0].chunk_id !== "ptr" &&
    mixed.ordered.find((item) => item.hit.chunk_id === "ptr")?.is_deferral ===
      true &&
    mixed.ordered.find((item) => item.hit.chunk_id === "ptr")
      ?.lexical_position === 1 &&
    mixed.ordered[0].is_deferral === false,
);

const ties = orderStage4eFtsExperiment4([
  { hit: hit("b", "d-b", "assert"), score: 0.2, contributing_queries: [] },
  { hit: hit("a", "d-a", "assert"), score: 0.2, contributing_queries: [] },
]);
assert(
  "deterministic ties",
  ties.hits[0].chunk_id === "a" && ties.ordered[0].role_lite_position === 1,
);

const flood = rankStage4eFtsExperiment4Union(
  [
    {
      subqueryIndex: 0,
      query: "q",
      hits: [
        hit(
          "ptr",
          "d-z",
          "The lengths are recorded in S2 of another record.",
        ),
        ...Array.from({ length: 25 }, (_, i) =>
          hit(`n${String(i).padStart(2, "0")}`, `d${i}`, "assertive note"),
        ),
      ],
    },
  ],
  25,
);
assert(
  "cap25 after ordering keeps pointer in full ordered list",
  flood.ordered.length === 26 &&
    flood.hits.length === STAGE4E_FTS_EXPERIMENT4_CANDIDATE_CAP &&
    flood.hits.every((item) => item.chunk_id !== "ptr") &&
    flood.ordered[25].hit.chunk_id === "ptr",
);

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
    goldLocatorKey("RP001-D12", "S3") === "RP001-D12#S3",
);

assert(
  "no gold input",
  stage4eFtsExperiment4OrderArityIsLexicalOnly(orderStage4eFtsExperiment4) &&
    orderStage4eFtsExperiment4.length === 1,
);

const exp4Source = readFileSync("lib/ask-stage4e-fts-experiment4.ts", "utf8");
assert("no question IDs", !/\bQ(?:0[1-9]|1[0-8])\b/.test(exp4Source));
assert(
  "no RP001 IDs in detector implementation",
  !exp4Source.includes("RP001") &&
    !exp4Source.includes("D09") &&
    !exp4Source.includes("D13") &&
    !exp4Source.includes("D15"),
);
assert(
  "no source authority",
  !exp4Source.includes("as-built") && !exp4Source.includes("field log") && !exp4Source.includes("document_type"),
);
assert(
  "no chronology authority",
  !exp4Source.includes("source_issued_on") && !exp4Source.includes("newer"),
);
assert(
  "maximum appearances 150",
  STAGE4E_FTS_EXPERIMENT4_MAX_APPEARANCES === 150,
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
assert(
  "Experiment 3 unchanged",
  rankStage4eFtsExperiment3Union.length === 1 &&
    stage4eFtsExperiment3Contribution(20) === 0.05,
);

const baselineBytes = readFileSync(
  "docs/reference-projects/001/evaluations/stage4e-b-fts-baseline-v1.json",
);
assert(
  "baseline artifact unchanged",
  createHash("sha256").update(baselineBytes).digest("hex") ===
    "f6395382a05c4e80cd3db2dd8db32eb8bd24a416c25a5ad89bbf6a1762439a1a",
);

function spawnExperiment4Hosted(envOverrides: Record<string, string | undefined>) {
  const env = { ...process.env };
  for (const name of STAGE4E_FTS_REQUIRED_ENV) {
    env[name] = "   ";
  }
  for (const [key, value] of Object.entries(envOverrides)) {
    env[key] = value === undefined ? "   " : value;
  }
  return spawnSync(
    process.execPath,
    ["scripts/run-ask-stage4e-fts-experiment4.mjs"],
    { encoding: "utf8", env, timeout: 20000 },
  );
}

const absent = spawnExperiment4Hosted({});
assert("experiment4 hosted all-absent SKIP exit 0", absent.status === 0);
assert(
  "experiment4 hosted all-absent prints SKIP",
  (absent.stdout + absent.stderr).includes("SKIP Stage 4E Experiment 4"),
);

if (failed > 0) {
  console.error(`ask-stage4e-fts-experiment4-unit: ${failed} failed`);
  process.exit(1);
}
console.log("ask-stage4e-fts-experiment4-unit: ok");
