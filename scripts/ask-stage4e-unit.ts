/**
 * Stage 4E-A deterministic offline RP001 benchmark.
 * Evaluator plane: reads ground-truth.json / source-register.json.
 * System under test: sources/ via extractRp001Corpus + searchExtractedChunksOffline
 * + budgetDocumentChunkHits. Does not call production Ask or a model.
 *
 * Infrastructure failures exit 1. Weak recall/budget/temporal results are reported
 * and do not fail this slice.
 */

import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  ASK_CHUNK_MODEL_CAP,
  assembleAskEvidencePack,
  budgetDocumentChunkHits,
  documentChunkEvidenceItem,
} from "@/lib/ask-evidence";
import {
  STAGE4E_BUDGET_CAP,
  STAGE4E_RECALL_CUTOFFS,
  STAGE4E_RETRIEVAL_LABEL,
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
import {
  flattenExtractionDraftsToHits,
  searchExtractedChunksOffline,
} from "@/lib/document-chunk-retrieval";
import type { ProjectRecord } from "@/lib/projects";
import {
  RP001_EVALUATOR_FILES,
  RP001_ROOT,
  assertEligibleRp001SourcePath,
  extractRp001Corpus,
  listEligibleRp001SourceFiles,
  loadRp001Register,
} from "@/lib/rp001-corpus";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const D15 = "RP001-D15";
const CONFLICT_LOCATORS: [string, string] = ["S1", "S3"];

let failed = 0;
function assert(name: string, condition: boolean) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`PASS ${name}`);
}

function documentIdFor(sourceId: string) {
  return `00000000-0000-4000-8000-${sourceId.replace(/\D/g, "").padStart(12, "0").slice(-12)}`;
}

function loadGroundTruth(): Stage4eGroundTruth {
  const raw = JSON.parse(
    readFileSync(join(RP001_ROOT, "ground-truth.json"), "utf8"),
  ) as unknown;
  return parseStage4eGroundTruth(raw);
}

const project: ProjectRecord = {
  id: PROJECT,
  company_id: COMPANY,
  name: "RP001 4E-A benchmark project",
  client_name: null,
  address: null,
  status: "active",
  start_date: null,
  target_completion_date: null,
  description: null,
};

const register = loadRp001Register();
const truth = loadGroundTruth();
const sourceIdByDocumentId = new Map<string, string>();
for (const doc of register.documents) {
  sourceIdByDocumentId.set(documentIdFor(doc.id), doc.id);
}

const issuedOnByDocument = new Map(
  register.documents.map((doc) => [doc.id, doc.issued_on]),
);

assert("exactly 15 registered source documents", register.documents.length === 15);
assert("exactly 18 benchmark questions load", truth.questions.length === 18);
assert(
  "ground truth marked evaluation-only / never ingest",
  truth.evaluation_only === true &&
    truth.never_ingest_as_project_evidence === true,
);

const eligibleFiles = listEligibleRp001SourceFiles();
assert("exactly 15 eligible source files", eligibleFiles.length === 15);
const expectedNames = new Set(
  register.documents.map((doc) => basename(doc.path)),
);
assert(
  "eligible files match the register",
  eligibleFiles.every((filePath) => expectedNames.has(basename(filePath))) &&
    expectedNames.size === 15,
);

let denied = 0;
for (const name of RP001_EVALUATOR_FILES) {
  try {
    assertEligibleRp001SourcePath(join(RP001_ROOT, name), RP001_ROOT);
  } catch {
    denied += 1;
  }
}
assert(
  "evaluator files are denied from runtime corpus",
  denied === RP001_EVALUATOR_FILES.length,
);

const drafts = extractRp001Corpus({
  documentIdFor,
  companyId: COMPANY,
  projectId: PROJECT,
});
assert("extraction returned 15 documents", drafts.length === 15);

const locatorInventory = register.documents.map((doc) => {
  const draft = drafts.find(
    (item) => item.document_id === documentIdFor(doc.id),
  );
  const locators = doc.locators.map((locator) => {
    const chunks = (draft?.chunks ?? []).filter(
      (chunk) => chunk.locator === locator,
    );
    return {
      document: doc.id,
      locator,
      chunk_count: chunks.length,
      part_indexes: chunks.map((chunk) => chunk.part_index),
      survived: chunks.length > 0,
    };
  });
  const extractedLocators = [...new Set((draft?.chunks ?? []).map((c) => c.locator))];
  const unexpected = extractedLocators.filter(
    (locator) => !doc.locators.includes(locator),
  );
  const missing = locators.filter((item) => !item.survived).map((item) => item.locator);
  const duplicates = locators.filter((item) => {
    const parts = item.part_indexes;
    return new Set(parts).size !== parts.length;
  });
  return {
    document: doc.id,
    locators,
    missing,
    unexpected,
    duplicate_part_index: duplicates.map((item) => item.locator),
  };
});

const missingLocators = locatorInventory.flatMap((item) =>
  item.missing.map((locator) => goldLocatorKey(item.document, locator)),
);
assert("all registered locators survived extraction", missingLocators.length === 0);
assert(
  "no unexpected locators after extraction",
  locatorInventory.every((item) => item.unexpected.length === 0),
);

const allHits = flattenExtractionDraftsToHits(drafts);
const allBodies = drafts
  .flatMap((draft) => [draft.extracted_text, ...draft.chunks.map((c) => c.body)])
  .join("\n");
const leakage = findEvaluatorLeakage(allBodies);
const leakedAnswers = findVerbatimExpectedAnswers(allBodies, truth.questions);
assert(
  "evaluator-only GT markers are not in extracted source bodies",
  leakage.length === 0,
);
assert(
  "verbatim expected_answer strings are not in extracted source bodies",
  leakedAnswers.length === 0,
);

const filenameByDocumentId = new Map(
  register.documents.map((doc) => [documentIdFor(doc.id), basename(doc.path)]),
);
const samplePack = assembleAskEvidencePack({
  project,
  tasks: [],
  fieldLogs: [],
  documents: [],
  documentChunks: budgetDocumentChunkHits(allHits).map((hit) =>
    documentChunkEvidenceItem(
      PROJECT,
      hit,
      filenameByDocumentId.get(hit.document_id) ?? "document",
    ),
  ),
});
const packText = JSON.stringify(samplePack);
assert(
  "ground truth does not enter a sample evidence pack",
  findEvaluatorLeakage(packText).length === 0 &&
    findVerbatimExpectedAnswers(packText, truth.questions).length === 0 &&
    !packText.includes("never_ingest_as_project_evidence"),
);

const d15InstructionVoice = allHits.some(
  (hit) =>
    sourceIdByDocumentId.get(hit.document_id) === D15 &&
    hit.locator === "S3" &&
    hit.body.includes("Answer must disclose conflicting recollection"),
);
assert(
  "D15 S3 evaluator-like prose remains a runtime source characteristic",
  d15InstructionVoice,
);

function retrieve(question: string, asOf: string | null) {
  return searchExtractedChunksOffline({
    hits: allHits,
    companyId: COMPANY,
    projectId: PROJECT,
    query: question,
    asOf,
  });
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

function forwardPointersInText(body: string, issuedOn: string | null) {
  if (!issuedOn) {
    return [];
  }
  const found = new Set<string>();
  for (const match of body.matchAll(/RP001-D\d{2}/g)) {
    const id = match[0];
    const targetIssued = issuedOnByDocument.get(id);
    if (targetIssued && targetIssued > issuedOn) {
      found.add(`${id} (issued ${targetIssued})`);
    }
  }
  return [...found];
}

const forwardPointerInventory = allHits
  .map((hit) => {
    const document = sourceIdByDocumentId.get(hit.document_id) ?? "?";
    const pointers = forwardPointersInText(hit.body, hit.source_issued_on);
    if (pointers.length === 0) {
      return null;
    }
    return {
      document,
      locator: hit.locator,
      source_issued_on: hit.source_issued_on,
      pointers,
    };
  })
  .filter((item): item is NonNullable<typeof item> => item !== null);

const d14S2 = allHits.find(
  (hit) =>
    sourceIdByDocumentId.get(hit.document_id) === "RP001-D14" &&
    hit.locator === "S2",
);
const d14ForwardPointer =
  Boolean(d14S2?.body.includes("RP001-D15")) &&
  Boolean(d14S2?.body.toLowerCase().includes("refer service record"));

type ModeReport = {
  as_of: string | null;
  hits: Stage4eHitRef[];
  recall: Record<string, number>;
  gold_retrieved: Record<string, Stage4eGoldLocator[]>;
  gold_missing: Record<string, Stage4eGoldLocator[]>;
  non_gold_locators: string[];
  gold_in_25: number;
  gold_in_8: number;
  lost_in_budget: Stage4eGoldLocator[];
  temporal_violations: Stage4eHitRef[];
};

function scoreMode(
  gold: Stage4eGoldLocator[],
  hits: DocumentChunkHit[],
  asOf: string | null,
): ModeReport {
  const refs = mapHitsToEvaluatorRefs(hits, sourceIdByDocumentId);
  const at25 = refs.slice(0, 25);
  const at8 = refs.slice(0, ASK_CHUNK_MODEL_CAP);
  const recall: Record<string, number> = {};
  const goldRetrieved: Record<string, Stage4eGoldLocator[]> = {};
  const goldMiss: Record<string, Stage4eGoldLocator[]> = {};
  for (const cutoff of STAGE4E_RECALL_CUTOFFS) {
    const window = refs.slice(0, cutoff);
    recall[`@${cutoff}`] = recallAtK(gold, refs, cutoff);
    goldRetrieved[`@${cutoff}`] = goldFound(gold, window);
    goldMiss[`@${cutoff}`] = goldMissing(gold, window);
  }
  const goldKeys = new Set(gold.map((item) => goldLocatorKey(item.document, item.locator)));
  return {
    as_of: asOf,
    hits: refs,
    recall,
    gold_retrieved: goldRetrieved,
    gold_missing: goldMiss,
    non_gold_locators: uniqueLocatorKeys(at25).filter((key) => !goldKeys.has(key)),
    gold_in_25: goldFound(gold, at25).length,
    gold_in_8: goldFound(gold, at8).length,
    lost_in_budget: goldFound(gold, at25).filter(
      (item) => !locatorPresent(item, at8),
    ),
    temporal_violations: asOf ? temporalViolations(at25, asOf) : [],
  };
}

function locatorPresent(gold: Stage4eGoldLocator, hits: Stage4eHitRef[]) {
  return hits.some(
    (hit) => hit.document === gold.document && hit.locator === gold.locator,
  );
}

const questions = truth.questions.map((question) => {
  const gold = uniqueGoldLocators(question.authoritative_sources);
  const goldExtracted = gold.every((item) => {
    const inventory = locatorInventory.find((row) => row.document === item.document);
    return inventory?.locators.some(
      (locator) => locator.locator === item.locator && locator.survived,
    );
  });
  const evalHits = retrieve(question.question, question.as_of);
  const productHits = retrieve(question.question, null);
  const evalMode = scoreMode(gold, evalHits, question.as_of);
  const productMode = scoreMode(gold, productHits, null);
  const evalAt25 = evalMode.hits.slice(0, 25);
  const evalAt8 = evalMode.hits.slice(0, STAGE4E_BUDGET_CAP);
  const conflict =
    question.id === "Q01" || question.id === "Q09"
      ? conflictPairStatus(evalAt25, evalAt8, D15, CONFLICT_LOCATORS)
      : null;

  const flags: string[] = [];
  if (question.id === "Q01") {
    flags.push("FIXTURE_CONCERN_Q01");
  }
  if (question.id === "Q14") {
    flags.push("FIXTURE_CONCERN_Q14_FORWARD_POINTER");
    if (d14ForwardPointer) {
      flags.push("D14_S2_CONTAINS_D15_FORWARD_POINTER");
    }
  }
  if (conflict?.classification === "BUDGET") {
    flags.push("CONFLICT_PAIR_BUDGET_LOSS");
  }
  if (conflict?.classification === "RETRIEVAL") {
    flags.push("CONFLICT_PAIR_RETRIEVAL_LOSS");
  }
  const productFuture = productMode.hits.filter((hit) =>
    laterThanAsOf(hit.source_issued_on, question.as_of),
  );
  if (productFuture.length > 0) {
    flags.push("PRODUCT_LIKE_FUTURE_ISSUED_EVIDENCE");
  }
  const evalRefs = evalMode.hits.slice(0, 25);
  if (
    evalRefs.some((hit) =>
      allHits.some(
        (raw) =>
          sourceIdByDocumentId.get(raw.document_id) === hit.document &&
          raw.locator === hit.locator &&
          raw.part_index === hit.part_index &&
          forwardPointersInText(raw.body, raw.source_issued_on).length > 0,
      ),
    )
  ) {
    flags.push("FORWARD_POINTER_IN_RETRIEVED_BODY");
  }
  if (
    evalAt25.some((hit) => hit.document === D15 && hit.locator === "S3")
  ) {
    flags.push("ADVERSARIAL_INSTRUCTION_VOICE_IN_SOURCE");
  }

  const primary_failure = classifyDeterministicFailure({
    goldExtracted,
    goldMissingAt25: evalMode.gold_missing["@25"]?.length ?? gold.length,
    goldMissingAt8: evalMode.gold_missing["@8"]?.length ?? gold.length,
    evalAsOfViolations: evalMode.temporal_violations.length,
  });

  return {
    id: question.id,
    question: question.question,
    as_of: question.as_of,
    epistemic_kind: question.epistemic_kind,
    gold_locators: gold.map((item) => goldLocatorKey(item.document, item.locator)),
    gold_locator_parts: gold.map((item) => {
      const row = locatorInventory
        .find((entry) => entry.document === item.document)
        ?.locators.find((locator) => locator.locator === item.locator);
      return {
        ...item,
        chunk_count: row?.chunk_count ?? 0,
        part_indexes: row?.part_indexes ?? [],
      };
    }),
    retrieval_label: STAGE4E_RETRIEVAL_LABEL,
    eval_as_of: {
      as_of: evalMode.as_of,
      recall: evalMode.recall,
      gold_retrieved: Object.fromEntries(
        Object.entries(evalMode.gold_retrieved).map(([k, v]) => [
          k,
          v.map((item) => goldLocatorKey(item.document, item.locator)),
        ]),
      ),
      gold_missing: Object.fromEntries(
        Object.entries(evalMode.gold_missing).map(([k, v]) => [
          k,
          v.map((item) => goldLocatorKey(item.document, item.locator)),
        ]),
      ),
      non_gold_locators: evalMode.non_gold_locators,
      hit_count: evalMode.hits.length,
      gold_in_25: evalMode.gold_in_25,
      gold_in_8: evalMode.gold_in_8,
      lost_in_budget: evalMode.lost_in_budget.map((item) =>
        goldLocatorKey(item.document, item.locator),
      ),
      survival_25_to_8:
        evalMode.gold_in_25 === 0
          ? null
          : evalMode.gold_in_8 / evalMode.gold_in_25,
      retrieved_locators_at_25: uniqueLocatorKeys(evalAt25),
      temporal_violations: evalMode.temporal_violations,
    },
    product_like_asOf_null: {
      as_of: null,
      hit_count: productMode.hits.length,
      recall: productMode.recall,
      gold_retrieved: Object.fromEntries(
        Object.entries(productMode.gold_retrieved).map(([k, v]) => [
          k,
          v.map((item) => goldLocatorKey(item.document, item.locator)),
        ]),
      ),
      gold_missing: Object.fromEntries(
        Object.entries(productMode.gold_missing).map(([k, v]) => [
          k,
          v.map((item) => goldLocatorKey(item.document, item.locator)),
        ]),
      ),
      non_gold_locators: productMode.non_gold_locators,
      gold_in_25: productMode.gold_in_25,
      gold_in_8: productMode.gold_in_8,
      lost_in_budget: productMode.lost_in_budget.map((item) =>
        goldLocatorKey(item.document, item.locator),
      ),
      retrieved_locators_at_25: uniqueLocatorKeys(productMode.hits.slice(0, 25)),
      later_than_question_as_of: productFuture.map((hit) =>
        goldLocatorKey(hit.document, hit.locator),
      ),
    },
    conflict_pair: conflict,
    primary_failure,
    secondary_flags: flags,
    fixture_concerns: flags.filter((flag) => flag.startsWith("FIXTURE_CONCERN_")),
  };
});

const q14 = questions.find((item) => item.id === "Q14");
const q03 = questions.find((item) => item.id === "Q03");
const q01 = questions.find((item) => item.id === "Q01");
const q09 = questions.find((item) => item.id === "Q09");

const q14EvalHits = q14?.eval_as_of.retrieved_locators_at_25 ?? [];
const q14ProductHits = q14?.product_like_asOf_null.retrieved_locators_at_25 ?? [];
const q14Temporal = {
  eval_as_of: q14?.as_of,
  d15_body_chunks_under_eval_as_of: q14EvalHits.some((key) =>
    key.startsWith("RP001-D15#"),
  ),
  d14_s2_under_eval_as_of: q14EvalHits.includes("RP001-D14#S2"),
  d14_s2_contains_forward_pointer_to_d15: d14ForwardPointer,
  d15_under_product_like_asOf_null: q14ProductHits.some((key) =>
    key.startsWith("RP001-D15#"),
  ),
  eval_temporal_violations: q14?.eval_as_of.temporal_violations.length ?? 0,
};

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

const budgetLossQuestions = questions.filter(
  (item) => item.eval_as_of.lost_in_budget.length > 0,
);
const emptyEvalRetrieval = questions.filter(
  (item) => item.eval_as_of.hit_count === 0,
);
const survivalRates = questions
  .map((item) => item.eval_as_of.survival_25_to_8)
  .filter((value): value is number => typeof value === "number");

const report = {
  slice: "4E-A",
  retrieval_kind: STAGE4E_RETRIEVAL_LABEL,
  not_started: ["4E-B PostgreSQL ts_rank_cd", "4E-C model-answer evaluation", "4F"],
  corpus: {
    registered_sources: register.documents.length,
    eligible_source_files: eligibleFiles.length,
    evaluator_files_denied: [...RP001_EVALUATOR_FILES],
    hash_integrity: "verified_by_extractRp001Corpus",
    questions: truth.questions.length,
    evaluator_leakage_in_bodies: leakage,
    verbatim_expected_answers_in_bodies: leakedAnswers,
  },
  extraction: {
    locator_inventory: locatorInventory,
    missing_locators: missingLocators,
    d15_s3_instruction_voice_in_runtime_source: d15InstructionVoice,
  },
  fixture_concerns: {
    FIXTURE_CONCERN_Q01:
      "Q01 gold mixes D02 S1 (RH-01 design/envelope), D13 (RH-02 installed), and D15 S1/S3 (service/conflict). epistemic_kind is documented_fact while the expected answer requires unresolved actuator-conflict disclosure.",
    FIXTURE_CONCERN_Q14_FORWARD_POINTER:
      "D14 S2 is issued on the Q14 as_of date and names RP001-D15, which is issued later. Not rewritten in 4E-A.",
    related_forward_pointers: forwardPointerInventory,
  },
  retrieval: {
    mode: "eval_as_of",
    label: STAGE4E_RETRIEVAL_LABEL,
    offline_matcher:
      "Existing searchExtractedChunksOffline: every normalized token of length >= 2 from the full question text must appear in locator+body. Natural-language questions typically match zero chunks. This is a measurement of the current matcher against the current questions, not a reason to change either in 4E-A.",
    mean_recall: recallMeansEval,
    product_like_asOf_null_mean_recall: recallMeansProduct,
    questions_with_empty_eval_hits: emptyEvalRetrieval.map((item) => item.id),
  },
  budget: {
    model_cap: STAGE4E_BUDGET_CAP,
    mean_survival_25_to_8: survivalRates.length === 0 ? null : mean(survivalRates),
    questions_with_budget_loss: budgetLossQuestions.map((item) => item.id),
    q01_conflict_pair: q01?.conflict_pair ?? null,
    q09_conflict_pair: q09?.conflict_pair ?? null,
  },
  temporal: {
    q03: {
      as_of: q03?.as_of,
      eval_recall: q03?.eval_as_of.recall,
      eval_missing: q03?.eval_as_of.gold_missing,
      eval_non_gold: q03?.eval_as_of.non_gold_locators,
      eval_temporal_violations: q03?.eval_as_of.temporal_violations,
      product_like_later_than_as_of:
        q03?.product_like_asOf_null.later_than_question_as_of,
      product_like_retrieved: q03?.product_like_asOf_null.retrieved_locators_at_25,
    },
    q14: q14Temporal,
  },
  questions,
};

console.log("");
console.log("=== Stage 4E-A scorecard (offline fixture; not ts_rank_cd) ===");
console.log(`Retrieval: ${STAGE4E_RETRIEVAL_LABEL}`);
console.log(
  "eval_as_of mean Recall@1/3/5/8/25:",
  STAGE4E_RECALL_CUTOFFS.map(
    (cutoff) => recallMeansEval[`@${cutoff}`]?.toFixed(3),
  ).join(" / "),
);
console.log(
  "product_like asOf:null mean Recall@1/3/5/8/25:",
  STAGE4E_RECALL_CUTOFFS.map(
    (cutoff) => recallMeansProduct[`@${cutoff}`]?.toFixed(3),
  ).join(" / "),
);
console.log(
  `Empty eval retrieval (0 hits): ${emptyEvalRetrieval.map((item) => item.id).join(", ") || "(none)"}`,
);
console.log(
  `Budget cap ${STAGE4E_BUDGET_CAP}; mean gold survival 25→8 (only questions with gold@25): ${survivalRates.length === 0 ? "n/a (no gold@25)" : mean(survivalRates).toFixed(3)}`,
);
console.log(
  "Questions with eval budget loss:",
  budgetLossQuestions.map((item) => item.id).join(", ") || "(none)",
);
console.log(
  "Q01 conflict pair D15 S1/S3:",
  JSON.stringify(q01?.conflict_pair?.classification),
);
console.log(
  "Q09 conflict pair D15 S1/S3:",
  JSON.stringify(q09?.conflict_pair?.classification),
);
console.log("Q14 temporal:", JSON.stringify(q14Temporal));
console.log("Forward pointers in sources:", JSON.stringify(forwardPointerInventory));
console.log("");
console.log("Per-question eval_as_of:");
for (const item of questions) {
  console.log(
    [
      item.id,
      `R@8=${item.eval_as_of.recall["@8"]?.toFixed(2)}`,
      `R@25=${item.eval_as_of.recall["@25"]?.toFixed(2)}`,
      `miss25=${item.eval_as_of.gold_missing["@25"]?.join("|") || "-"}`,
      `miss8=${item.eval_as_of.gold_missing["@8"]?.join("|") || "-"}`,
      `fail=${item.primary_failure ?? "null"}`,
      item.secondary_flags.join(",") || "-",
    ].join(" "),
  );
}

console.log("");
console.log("STAGE4E_BASELINE_JSON");
console.log(JSON.stringify(report, null, 2));

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4e-unit: infrastructure ok (benchmark quality is diagnostic, not a pass threshold)");
