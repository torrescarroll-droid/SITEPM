/**
 * Stage 4E-A evaluator plane only.
 * Must not be imported by production Ask, retrieval, or provider modules.
 * Ground truth stays here; runtime evidence objects stay separate.
 *
 * Offline fixture retrieval is NOT PostgreSQL ts_rank_cd proof.
 */

import { ASK_CHUNK_MODEL_CAP } from "@/lib/ask-evidence";
import { DOCUMENT_CHUNK_RETRIEVAL_CAP } from "@/lib/document-chunk-retrieval";
import type { DocumentChunkHit } from "@/lib/document-intelligence-types";

export const STAGE4E_RECALL_CUTOFFS = [1, 3, 5, 8, 25] as const;
export type Stage4eRecallCutoff = (typeof STAGE4E_RECALL_CUTOFFS)[number];

export type Stage4eGoldLocator = {
  document: string;
  locator: string;
};

export type Stage4ePrimaryFailure =
  | "CORPUS"
  | "EXTRACTION"
  | "RETRIEVAL"
  | "BUDGET"
  | "TEMPORAL"
  | null;

export type Stage4eHitRef = {
  document: string;
  locator: string;
  part_index: number;
  source_issued_on: string | null;
};

export type Stage4eGroundTruthQuestion = {
  id: string;
  question: string;
  as_of: string;
  expected_answer: string;
  epistemic_kind: string;
  authoritative_sources: Stage4eGoldLocator[];
  chronology_and_authority: string;
  intentional_unknowns: string[];
};

export type Stage4eGroundTruth = {
  schema_version: string;
  evaluation_only?: boolean;
  never_ingest_as_project_evidence?: boolean;
  cutoff?: string;
  hard_failures?: string[];
  rubric?: unknown;
  questions: Stage4eGroundTruthQuestion[];
};

export function goldLocatorKey(document: string, locator: string) {
  return `${document}#${locator}`;
}

export function uniqueGoldLocators(
  sources: Stage4eGoldLocator[],
): Stage4eGoldLocator[] {
  const seen = new Set<string>();
  const unique: Stage4eGoldLocator[] = [];
  for (const source of sources) {
    const key = goldLocatorKey(source.document, source.locator);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push({ document: source.document, locator: source.locator });
  }
  return unique;
}

export function locatorPresentInHits(
  gold: Stage4eGoldLocator,
  hits: Stage4eHitRef[],
) {
  return hits.some(
    (hit) => hit.document === gold.document && hit.locator === gold.locator,
  );
}

export function locatorsFromHits(
  hits: Stage4eHitRef[],
  cap: number,
): Stage4eHitRef[] {
  return hits.slice(0, cap);
}

export function goldFound(
  gold: Stage4eGoldLocator[],
  hits: Stage4eHitRef[],
): Stage4eGoldLocator[] {
  return gold.filter((item) => locatorPresentInHits(item, hits));
}

export function goldMissing(
  gold: Stage4eGoldLocator[],
  hits: Stage4eHitRef[],
): Stage4eGoldLocator[] {
  return gold.filter((item) => !locatorPresentInHits(item, hits));
}

export function recallAtK(
  gold: Stage4eGoldLocator[],
  hits: Stage4eHitRef[],
  k: number,
) {
  if (gold.length === 0) {
    return 1;
  }
  const window = locatorsFromHits(hits, k);
  return goldFound(gold, window).length / gold.length;
}

export function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function laterThanAsOf(
  sourceIssuedOn: string | null,
  asOf: string,
) {
  if (!sourceIssuedOn) {
    return false;
  }
  return sourceIssuedOn > asOf;
}

export function temporalViolations(
  hits: Stage4eHitRef[],
  asOf: string,
): Stage4eHitRef[] {
  return hits.filter((hit) => laterThanAsOf(hit.source_issued_on, asOf));
}

export function conflictPairStatus(
  hitsAt25: Stage4eHitRef[],
  hitsAt8: Stage4eHitRef[],
  document: string,
  locators: [string, string],
) {
  const in25 = locators.map((locator) =>
    locatorPresentInHits({ document, locator }, hitsAt25),
  );
  const in8 = locators.map((locator) =>
    locatorPresentInHits({ document, locator }, hitsAt8),
  );
  const both25 = in25.every(Boolean);
  const both8 = in8.every(Boolean);
  let classification: "ok" | "RETRIEVAL" | "BUDGET" = "ok";
  if (!both25) {
    classification = "RETRIEVAL";
  } else if (!both8) {
    classification = "BUDGET";
  }
  return {
    document,
    locators,
    in_25: { [locators[0]]: in25[0], [locators[1]]: in25[1] },
    in_8: { [locators[0]]: in8[0], [locators[1]]: in8[1] },
    both_in_25: both25,
    both_in_8: both8,
    classification,
  };
}

export function classifyDeterministicFailure(input: {
  goldExtracted: boolean;
  goldMissingAt25: number;
  goldMissingAt8: number;
  evalAsOfViolations: number;
}): Stage4ePrimaryFailure {
  if (!input.goldExtracted) {
    return "EXTRACTION";
  }
  if (input.goldMissingAt25 > 0) {
    return "RETRIEVAL";
  }
  if (input.goldMissingAt8 > 0) {
    return "BUDGET";
  }
  if (input.evalAsOfViolations > 0) {
    return "TEMPORAL";
  }
  return null;
}

export function mapHitsToEvaluatorRefs(
  hits: DocumentChunkHit[],
  sourceIdByDocumentId: Map<string, string>,
): Stage4eHitRef[] {
  return hits.map((hit) => {
    const document = sourceIdByDocumentId.get(hit.document_id);
    if (!document) {
      throw new Error(
        "Evaluator mapping missing for a retrieved document_id; do not invent gold from runtime ids.",
      );
    }
    return {
      document,
      locator: hit.locator,
      part_index: hit.part_index,
      source_issued_on: hit.source_issued_on,
    };
  });
}

export function evaluatorLeakageMarkers() {
  return [
    "never_ingest_as_project_evidence",
    "evaluation_only",
    "expected_answer",
    "authoritative_sources",
    "hard_failures",
    "schema_version",
  ] as const;
}

export function findEvaluatorLeakage(text: string): string[] {
  const lower = text.toLowerCase();
  return evaluatorLeakageMarkers().filter((marker) =>
    lower.includes(marker.toLowerCase()),
  );
}

export function findVerbatimExpectedAnswers(
  bodies: string,
  questions: Stage4eGroundTruthQuestion[],
) {
  return questions
    .filter((question) => bodies.includes(question.expected_answer))
    .map((question) => question.id);
}

export function parseStage4eGroundTruth(raw: unknown): Stage4eGroundTruth {
  if (!raw || typeof raw !== "object") {
    throw new Error("Malformed RP001 ground-truth.json");
  }
  const record = raw as Stage4eGroundTruth;
  if (!Array.isArray(record.questions) || record.questions.length !== 18) {
    throw new Error("RP001 ground truth must contain exactly 18 questions");
  }
  const ids = new Set<string>();
  for (const question of record.questions) {
    if (!question?.id || !question.question || !question.as_of) {
      throw new Error("Malformed RP001 benchmark question");
    }
    if (!Array.isArray(question.authoritative_sources)) {
      throw new Error(`Question ${question.id} missing authoritative_sources`);
    }
    if (ids.has(question.id)) {
      throw new Error(`Duplicate benchmark question id ${question.id}`);
    }
    ids.add(question.id);
  }
  for (let index = 1; index <= 18; index += 1) {
    const id = `Q${String(index).padStart(2, "0")}`;
    if (!ids.has(id)) {
      throw new Error(`Missing benchmark question ${id}`);
    }
  }
  return record;
}

export const STAGE4E_BUDGET_CAP = ASK_CHUNK_MODEL_CAP;
export const STAGE4E_RETRIEVAL_CAP = DOCUMENT_CHUNK_RETRIEVAL_CAP;
export const STAGE4E_RETRIEVAL_LABEL =
  "OFFLINE FIXTURE RETRIEVAL — NOT PostgreSQL ts_rank_cd proof";
