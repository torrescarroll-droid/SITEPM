/**
 * Stage 4E retrieval Experiment 1 — evaluator/shadow tooling ONLY.
 * NOT production retrieval. Must not be imported by Ask, Stage 4C, or providers.
 *
 * Hypothesis: a literal builder question should not be sent unchanged as one
 * PostgreSQL FTS AND-query. Deterministic lexical subqueries against the
 * existing search_project_document_chunks RPC may surface distributed evidence.
 */

import { DOCUMENT_CHUNK_RETRIEVAL_CAP } from "@/lib/document-chunk-retrieval";
import type { DocumentChunkHit } from "@/lib/document-intelligence-types";

/** Bounded fan-out: enough for 2–3 construction phrases without OR-flood. */
export const STAGE4E_FTS_EXPERIMENT1_MAX_SUBQUERIES = 6;
export const STAGE4E_FTS_EXPERIMENT1_CANDIDATE_CAP = DOCUMENT_CHUNK_RETRIEVAL_CAP;

export const STAGE4E_FTS_EXPERIMENT1_LABEL =
  "STAGE 4E RETRIEVAL EXPERIMENT 1 — DETERMINISTIC MULTI-QUERY SHADOW — NOT PRODUCTION";

/**
 * PostgreSQL english.stop plus NL scaffolding that is not construction meaning.
 * `would` is included here because it is not an english.stop word but it is
 * question-auxiliary language that polluted the frozen full-question AND query.
 */
export const STAGE4E_FTS_EXPERIMENT1_STOPWORDS = new Set([
  "i",
  "me",
  "my",
  "myself",
  "we",
  "our",
  "ours",
  "ourselves",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
  "he",
  "him",
  "his",
  "himself",
  "she",
  "her",
  "hers",
  "herself",
  "it",
  "its",
  "itself",
  "they",
  "them",
  "their",
  "theirs",
  "themselves",
  "what",
  "which",
  "who",
  "whom",
  "this",
  "that",
  "these",
  "those",
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "having",
  "do",
  "does",
  "did",
  "doing",
  "a",
  "an",
  "the",
  "and",
  "but",
  "if",
  "or",
  "because",
  "as",
  "until",
  "while",
  "of",
  "at",
  "by",
  "for",
  "with",
  "about",
  "against",
  "between",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "to",
  "from",
  "up",
  "down",
  "in",
  "out",
  "on",
  "off",
  "over",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "s",
  "t",
  "can",
  "will",
  "just",
  "don",
  "should",
  "now",
  "would",
  "could",
  "show",
]);

export type Stage4eFtsExperiment1DecomposeInput = {
  question: string;
};

export type Stage4eFtsExperiment1SubqueryOrigin =
  | "hyphen_phrase"
  | "content_bigram"
  | "content_unigram"
  | "fallback_join";

export type Stage4eFtsExperiment1Subquery = {
  query: string;
  origin: Stage4eFtsExperiment1SubqueryOrigin;
};

type PhraseSpan = { start: number; end: number; text: string };

function normalizeQuestion(question: string) {
  return question.trim().toLowerCase();
}

function isDateLikePhrase(phrase: string) {
  return /^[\d][\d-]*$/.test(phrase.replace(/\s/g, "-"));
}

function collectHyphenPhrases(normalized: string): PhraseSpan[] {
  const spans: PhraseSpan[] = [];
  const re = /[a-z0-9]+(?:-[a-z0-9]+)+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized))) {
    const text = match[0];
    if (isDateLikePhrase(text)) {
      continue;
    }
    spans.push({ start: match.index, end: match.index + text.length, text });
  }
  return spans;
}

function tokenize(text: string) {
  return text
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 2);
}

function isStopword(token: string) {
  return STAGE4E_FTS_EXPERIMENT1_STOPWORDS.has(token);
}

function isPureNumeric(token: string) {
  return /^\d+$/.test(token);
}

function coveredByPhrase(index: number, phrases: PhraseSpan[]) {
  return phrases.some((span) => index >= span.start && index < span.end);
}

function pushUnique(
  out: Stage4eFtsExperiment1Subquery[],
  seen: Set<string>,
  query: string,
  origin: Stage4eFtsExperiment1SubqueryOrigin,
) {
  const normalized = query.replace(/\s+/g, " ").trim();
  if (!normalized || seen.has(normalized)) {
    return;
  }
  if (out.length >= STAGE4E_FTS_EXPERIMENT1_MAX_SUBQUERIES) {
    return;
  }
  seen.add(normalized);
  out.push({ query: normalized, origin });
}

/**
 * Deterministic lexical decomposition.
 * Input is the literal question string only. No question id, gold, register,
 * locator, or answer.
 */
export function decomposeStage4eFtsExperiment1Question(
  question: string,
): Stage4eFtsExperiment1Subquery[] {
  const normalized = normalizeQuestion(question);
  const phrases = collectHyphenPhrases(normalized);
  const contentTokens: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    if (coveredByPhrase(cursor, phrases)) {
      const span = phrases.find(
        (item) => cursor >= item.start && cursor < item.end,
      );
      if (!span) {
        cursor += 1;
        continue;
      }
      cursor = span.end;
      continue;
    }
    const rest = normalized.slice(cursor);
    const tokenMatch = rest.match(/^[a-z0-9]+/);
    if (!tokenMatch) {
      cursor += 1;
      continue;
    }
    const token = tokenMatch[0];
    if (!isStopword(token) && !isPureNumeric(token) && token.length >= 2) {
      contentTokens.push(token);
    }
    cursor += token.length;
  }

  const out: Stage4eFtsExperiment1Subquery[] = [];
  const seen = new Set<string>();
  for (const phrase of phrases) {
    pushUnique(out, seen, phrase.text.replace(/-/g, " "), "hyphen_phrase");
  }
  for (let i = 0; i + 1 < contentTokens.length; i += 2) {
    pushUnique(
      out,
      seen,
      `${contentTokens[i]} ${contentTokens[i + 1]}`,
      "content_bigram",
    );
  }
  if (contentTokens.length % 2 === 1) {
    pushUnique(
      out,
      seen,
      contentTokens[contentTokens.length - 1],
      "content_unigram",
    );
  }
  if (out.length === 0 && contentTokens.length > 0) {
    pushUnique(out, seen, contentTokens.join(" "), "fallback_join");
  }
  return out;
}

export type Stage4eFtsExperiment1MergeSource = {
  subqueryIndex: number;
  query: string;
  hits: DocumentChunkHit[];
};

type MergeAccumulator = {
  hit: DocumentChunkHit;
  matchCount: number;
  bestPosition: number;
  firstSubqueryIndex: number;
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

export type Stage4eFtsExperiment1MergeMeta = {
  chunk_id: string;
  matchCount: number;
  bestPosition: number;
  firstSubqueryIndex: number;
};

/**
 * Merge RPC hit lists from subqueries.
 * Sort: more subquery matches, then best (lowest) RPC position, then earliest
 * subquery index, then production identity order. Dedupe by chunk_id. Cap 25.
 * Ground truth is not an input.
 */
export function mergeStage4eFtsExperiment1HitsDetailed(
  sources: Stage4eFtsExperiment1MergeSource[],
  cap = STAGE4E_FTS_EXPERIMENT1_CANDIDATE_CAP,
): { hits: DocumentChunkHit[]; meta: Stage4eFtsExperiment1MergeMeta[] } {
  const byChunk = new Map<string, MergeAccumulator>();
  for (const source of sources) {
    source.hits.forEach((hit, index) => {
      const position = index + 1;
      const existing = byChunk.get(hit.chunk_id);
      if (!existing) {
        byChunk.set(hit.chunk_id, {
          hit,
          matchCount: 1,
          bestPosition: position,
          firstSubqueryIndex: source.subqueryIndex,
        });
        return;
      }
      existing.matchCount += 1;
      if (position < existing.bestPosition) {
        existing.bestPosition = position;
        existing.hit = hit;
      }
      if (source.subqueryIndex < existing.firstSubqueryIndex) {
        existing.firstSubqueryIndex = source.subqueryIndex;
      }
    });
  }
  const ranked = [...byChunk.values()].sort((a, b) => {
    if (a.matchCount !== b.matchCount) {
      return b.matchCount - a.matchCount;
    }
    if (a.bestPosition !== b.bestPosition) {
      return a.bestPosition - b.bestPosition;
    }
    if (a.firstSubqueryIndex !== b.firstSubqueryIndex) {
      return a.firstSubqueryIndex - b.firstSubqueryIndex;
    }
    return identityTieBreak(a.hit, b.hit);
  });
  const capped = ranked.slice(0, cap);
  return {
    hits: capped.map((item) => item.hit),
    meta: capped.map((item) => ({
      chunk_id: item.hit.chunk_id,
      matchCount: item.matchCount,
      bestPosition: item.bestPosition,
      firstSubqueryIndex: item.firstSubqueryIndex,
    })),
  };
}

export function mergeStage4eFtsExperiment1Hits(
  sources: Stage4eFtsExperiment1MergeSource[],
  cap = STAGE4E_FTS_EXPERIMENT1_CANDIDATE_CAP,
): DocumentChunkHit[] {
  return mergeStage4eFtsExperiment1HitsDetailed(sources, cap).hits;
}

export function stage4eFtsExperiment1DecomposeArityIsQuestionOnly(
  fn: typeof decomposeStage4eFtsExperiment1Question,
) {
  return fn.length === 1;
}
