/**
 * Stage 4E retrieval Experiment 4 — evaluator/shadow tooling ONLY.
 * NOT production retrieval. Must not be imported by Ask, Stage 4C, or providers.
 *
 * Hypothesis: after frozen Exp3 union + Σ 1/H_q, a gold-free role-lite
 * deferral flag can demote explicit pointer text below assertive evidence.
 * Query generation = frozen Exp2. Union + lexical score = frozen Exp3.
 */

import {
  STAGE4E_FTS_EXPERIMENT3_CANDIDATE_CAP,
  STAGE4E_FTS_EXPERIMENT3_MAX_APPEARANCES,
  STAGE4E_FTS_EXPERIMENT3_MAX_SUBQUERIES,
  decomposeStage4eFtsExperiment3Question,
  rankStage4eFtsExperiment3Union,
  type Stage4eFtsExperiment3RankedChunk,
  type Stage4eFtsExperiment3Source,
} from "@/lib/ask-stage4e-fts-experiment3";
import type { DocumentChunkHit } from "@/lib/document-intelligence-types";

export const STAGE4E_FTS_EXPERIMENT4_MAX_SUBQUERIES =
  STAGE4E_FTS_EXPERIMENT3_MAX_SUBQUERIES;
export const STAGE4E_FTS_EXPERIMENT4_CANDIDATE_CAP =
  STAGE4E_FTS_EXPERIMENT3_CANDIDATE_CAP;
export const STAGE4E_FTS_EXPERIMENT4_MAX_APPEARANCES =
  STAGE4E_FTS_EXPERIMENT3_MAX_APPEARANCES;

export const STAGE4E_FTS_EXPERIMENT4_LABEL =
  "STAGE 4E RETRIEVAL EXPERIMENT 4 — ROLE-LITE DEFERRAL ORDERING — NOT PRODUCTION";

export const decomposeStage4eFtsExperiment4Question =
  decomposeStage4eFtsExperiment3Question;

export const rankStage4eFtsExperiment4LexicalUnion =
  rankStage4eFtsExperiment3Union;

/**
 * FROZEN before hosted run. Do not edit after seeing scores.
 *
 * Normalization: Unicode quotes → ASCII; lowercase; whitespace collapsed
 * to single spaces. No stemming. No document IDs. No dates. No gold.
 *
 * A chunk is deferral iff a closed copular relocation frame appears and a
 * generic section/caption locator token (S# / P#) occurs within 80
 * characters after that frame. Bare "see" / "refer" / locator mentions
 * without a relocation frame are assertive (supporting citations are
 * normal in construction records that also state facts).
 *
 * Binary output: is_deferral true | false.
 * Pointers stay in the union; they sort after assertive chunks, then by
 * frozen Exp3 score. If every candidate is deferral, lexical order remains.
 */
export const STAGE4E_FTS_EXPERIMENT4_DETECTOR_SPEC = {
  frozen: true,
  output: "binary is_deferral",
  lookahead_chars: 80,
  locator_token: String.raw`\b[sp]\d+\b`,
  frames: [
    "are recorded in",
    "is recorded in",
    "was recorded in",
    "were recorded in",
    "are documented in",
    "is documented in",
    "was documented in",
    "were documented in",
    "are described in",
    "is described in",
    "was described in",
    "were described in",
  ],
  excluded_on_purpose: [
    "see",
    "refer",
    "refer to",
    "per",
    "source type",
    "issued_on",
    "document_id",
  ],
} as const;

export const STAGE4E_FTS_EXPERIMENT4_DEFERRAL_FRAMES = [
  ...STAGE4E_FTS_EXPERIMENT4_DETECTOR_SPEC.frames,
] as const;

export const STAGE4E_FTS_EXPERIMENT4_LOCATOR_LOOKAHEAD =
  STAGE4E_FTS_EXPERIMENT4_DETECTOR_SPEC.lookahead_chars;

const LOCATOR_TOKEN = /\b[sp]\d+\b/;

export function normalizeStage4eFtsExperiment4Text(text: string) {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type Stage4eFtsExperiment4Deferral = {
  is_deferral: boolean;
  matched_frame: string | null;
};

export function classifyStage4eFtsExperiment4Deferral(
  body: string,
): Stage4eFtsExperiment4Deferral {
  const normalized = normalizeStage4eFtsExperiment4Text(body ?? "");
  for (const frame of STAGE4E_FTS_EXPERIMENT4_DEFERRAL_FRAMES) {
    let from = 0;
    while (from < normalized.length) {
      const index = normalized.indexOf(frame, from);
      if (index === -1) {
        break;
      }
      const after = normalized.slice(
        index + frame.length,
        index + frame.length + STAGE4E_FTS_EXPERIMENT4_LOCATOR_LOOKAHEAD,
      );
      if (LOCATOR_TOKEN.test(after)) {
        return { is_deferral: true, matched_frame: frame };
      }
      from = index + frame.length;
    }
  }
  return { is_deferral: false, matched_frame: null };
}

function identityTieBreak(a: DocumentChunkHit, b: DocumentChunkHit) {
  if (a.document_id !== b.document_id) {
    return a.document_id < b.document_id ? -1 : 1;
  }
  if (a.locator !== b.locator) {
    return a.locator < b.locator ? -1 : 1;
  }
  if (a.part_index !== b.part_index) {
    return a.part_index - b.part_index;
  }
  return a.chunk_id < b.chunk_id ? -1 : a.chunk_id > b.chunk_id ? 1 : 0;
}

export type Stage4eFtsExperiment4OrderedChunk = Stage4eFtsExperiment3RankedChunk & {
  lexical_position: number;
  is_deferral: boolean;
  matched_frame: string | null;
  role_lite_position: number;
};

/**
 * Assertive (non-deferral) before deferral, then frozen Exp3 score DESC,
 * then document_id / locator / part_index / chunk_id.
 * Does not drop deferrals from the union.
 */
export function orderStage4eFtsExperiment4(
  lexicalRanked: Stage4eFtsExperiment3RankedChunk[],
  cap = STAGE4E_FTS_EXPERIMENT4_CANDIDATE_CAP,
): {
  ordered: Stage4eFtsExperiment4OrderedChunk[];
  hits: DocumentChunkHit[];
} {
  const annotated = lexicalRanked.map((item, index) => {
    const deferral = classifyStage4eFtsExperiment4Deferral(item.hit.body);
    return {
      ...item,
      lexical_position: index + 1,
      is_deferral: deferral.is_deferral,
      matched_frame: deferral.matched_frame,
      role_lite_position: 0,
    };
  });
  const ordered = [...annotated].sort((a, b) => {
    if (a.is_deferral !== b.is_deferral) {
      return a.is_deferral ? 1 : -1;
    }
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return identityTieBreak(a.hit, b.hit);
  });
  for (let index = 0; index < ordered.length; index += 1) {
    ordered[index].role_lite_position = index + 1;
  }
  return {
    ordered,
    hits: ordered.slice(0, cap).map((item) => item.hit),
  };
}

export function rankStage4eFtsExperiment4Union(
  sources: Stage4eFtsExperiment3Source[],
  cap = STAGE4E_FTS_EXPERIMENT4_CANDIDATE_CAP,
) {
  const lexical = rankStage4eFtsExperiment4LexicalUnion(sources);
  const roleLite = orderStage4eFtsExperiment4(lexical.ranked, cap);
  return {
    appearances: lexical.appearances,
    unique_pool_size: lexical.unique_pool_size,
    lexical_ranked: lexical.ranked,
    ordered: roleLite.ordered,
    hits: roleLite.hits,
  };
}

export function stage4eFtsExperiment4OrderArityIsLexicalOnly(
  fn: typeof orderStage4eFtsExperiment4,
) {
  return fn.length === 1;
}
