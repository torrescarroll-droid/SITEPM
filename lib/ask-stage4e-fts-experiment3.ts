/**
 * Stage 4E retrieval Experiment 3 — evaluator/shadow tooling ONLY.
 * NOT production retrieval. Must not be imported by Ask, Stage 4C, or providers.
 *
 * Hypothesis: union all Experiment 2 subquery RPC hits, then rank by
 * gold-free inverse hit-count score(chunk) = Σ 1/H_q, then cap 25.
 * Query generation is the frozen Experiment 2 generator, imported unchanged.
 */

import {
  STAGE4E_FTS_EXPERIMENT2_CANDIDATE_CAP,
  STAGE4E_FTS_EXPERIMENT2_MAX_SUBQUERIES,
  decomposeStage4eFtsExperiment2Question,
} from "@/lib/ask-stage4e-fts-experiment2";
import type { DocumentChunkHit } from "@/lib/document-intelligence-types";

export const STAGE4E_FTS_EXPERIMENT3_MAX_SUBQUERIES =
  STAGE4E_FTS_EXPERIMENT2_MAX_SUBQUERIES;
export const STAGE4E_FTS_EXPERIMENT3_CANDIDATE_CAP =
  STAGE4E_FTS_EXPERIMENT2_CANDIDATE_CAP;
export const STAGE4E_FTS_EXPERIMENT3_MAX_APPEARANCES =
  STAGE4E_FTS_EXPERIMENT2_MAX_SUBQUERIES * STAGE4E_FTS_EXPERIMENT2_CANDIDATE_CAP;

export const STAGE4E_FTS_EXPERIMENT3_LABEL =
  "STAGE 4E RETRIEVAL EXPERIMENT 3 — INVERSE-FREQUENCY UNION RANKING — NOT PRODUCTION";

export const decomposeStage4eFtsExperiment3Question =
  decomposeStage4eFtsExperiment2Question;

export type Stage4eFtsExperiment3Source = {
  subqueryIndex: number;
  query: string;
  hits: DocumentChunkHit[];
};

export type Stage4eFtsExperiment3RankedChunk = {
  hit: DocumentChunkHit;
  score: number;
  contributing_queries: Array<{ query: string; h_q: number; contribution: number }>;
};

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

export function stage4eFtsExperiment3HitCount(hits: DocumentChunkHit[]) {
  return hits.length;
}

export function stage4eFtsExperiment3Contribution(h_q: number) {
  if (h_q <= 0) {
    return 0;
  }
  return 1 / h_q;
}

/**
 * Full union, then inverse-frequency score, then optional cap.
 * Gold, family, question id, and authority are not inputs.
 */
export function rankStage4eFtsExperiment3Union(
  sources: Stage4eFtsExperiment3Source[],
  cap = STAGE4E_FTS_EXPERIMENT3_CANDIDATE_CAP,
): {
  appearances: number;
  unique_pool_size: number;
  ranked: Stage4eFtsExperiment3RankedChunk[];
  hits: DocumentChunkHit[];
} {
  let appearances = 0;
  const byChunk = new Map<
    string,
    {
      hit: DocumentChunkHit;
      score: number;
      contributing_queries: Array<{
        query: string;
        h_q: number;
        contribution: number;
      }>;
    }
  >();
  for (const source of sources) {
    const h_q = source.hits.length;
    appearances += h_q;
    if (h_q === 0) {
      continue;
    }
    const contribution = stage4eFtsExperiment3Contribution(h_q);
    for (const hit of source.hits) {
      const existing = byChunk.get(hit.chunk_id);
      if (!existing) {
        byChunk.set(hit.chunk_id, {
          hit,
          score: contribution,
          contributing_queries: [
            { query: source.query, h_q, contribution },
          ],
        });
        continue;
      }
      existing.score += contribution;
      existing.contributing_queries.push({
        query: source.query,
        h_q,
        contribution,
      });
      if (identityTieBreak(hit, existing.hit) < 0) {
        existing.hit = hit;
      }
    }
  }
  const ranked = [...byChunk.values()].sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return identityTieBreak(a.hit, b.hit);
  });
  const capped = ranked.slice(0, cap);
  return {
    appearances,
    unique_pool_size: ranked.length,
    ranked,
    hits: capped.map((item) => item.hit),
  };
}

export function stage4eFtsExperiment3RankArityIsSourcesOnly(
  fn: typeof rankStage4eFtsExperiment3Union,
) {
  return fn.length === 1;
}
