/**
 * Production Ask chunk discovery.
 * Splits a natural-language question into a few lexical searches, runs each
 * through the existing authorized chunk RPC, then unions the hits.
 *
 * This is not a Stage 4E experiment. It does not rank by inverse frequency,
 * authority rules, or evidence role. The model prompt is unchanged.
 */

import {
  DOCUMENT_CHUNK_QUERY_MAX_CHARS,
  DOCUMENT_CHUNK_RETRIEVAL_CAP,
  searchAuthorizedProjectDocumentChunks,
} from "@/lib/document-chunk-retrieval";
import type { DocumentChunkHit } from "@/lib/document-intelligence-types";

export const ASK_LEXICAL_MAX_SEARCHES = 6;
export const ASK_LEXICAL_MAX_CONTENT_TOKENS = 12;
export const ASK_LEXICAL_MAX_QUERY_CHARS = 80;

/**
 * Question-frame words. Not a construction dictionary.
 * PostgreSQL english FTS already drops most of these. "must", "happen",
 * and "shall" are included because a spec can state the same requirement
 * without those verbs, and AND-ing them excludes the paragraph.
 */
export const ASK_LEXICAL_SCAFFOLDING = new Set([
  "a",
  "an",
  "the",
  "what",
  "which",
  "who",
  "whom",
  "when",
  "where",
  "why",
  "how",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "doing",
  "have",
  "has",
  "had",
  "having",
  "can",
  "could",
  "should",
  "would",
  "will",
  "must",
  "shall",
  "happen",
  "happens",
  "happening",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "from",
  "with",
  "by",
  "and",
  "or",
  "but",
  "before",
  "after",
  "about",
  "into",
  "over",
  "this",
  "that",
  "these",
  "those",
  "there",
  "here",
  "please",
  "tell",
  "show",
  "me",
  "my",
  "our",
  "your",
]);

export type AskLexicalQueryOrigin =
  | "hyphen_phrase"
  | "content_bigram"
  | "content_unigram"
  | "content_fallback";

export type AskLexicalQuery = {
  query: string;
  origin: AskLexicalQueryOrigin;
};

export type AskLexicalSearchTrace = {
  queries: AskLexicalQuery[];
  perQuery: Array<{ query: string; chunkIds: string[] }>;
  unionChunkIds: string[];
};

export type AskChunkSearch = (input: {
  projectId: string;
  query: string;
  asOf?: string | null;
}) => Promise<DocumentChunkHit[] | null>;

function normalizeQuestion(question: string) {
  return question.trim().toLowerCase().slice(0, DOCUMENT_CHUNK_QUERY_MAX_CHARS);
}

function isPureNumeric(token: string) {
  return /^\d+$/.test(token);
}

function pushQuery(
  out: AskLexicalQuery[],
  seen: Set<string>,
  query: string,
  origin: AskLexicalQueryOrigin,
) {
  if (out.length >= ASK_LEXICAL_MAX_SEARCHES) {
    return;
  }
  const normalized = query.replace(/\s+/g, " ").trim().slice(0, ASK_LEXICAL_MAX_QUERY_CHARS);
  if (normalized.length < 2 || seen.has(normalized)) {
    return;
  }
  seen.add(normalized);
  out.push({ query: normalized, origin });
}

/**
 * Deterministic searches from the question text only.
 * No model call, no gold answers, no project identifiers.
 */
export function decomposeAskLexicalQueries(question: string): AskLexicalQuery[] {
  const normalized = normalizeQuestion(question);
  if (!normalized) {
    return [];
  }

  const phrases: string[] = [];
  const phraseRe = /[a-z0-9]+(?:-[a-z0-9]+)+/g;
  let phraseMatch: RegExpExecArray | null;
  while ((phraseMatch = phraseRe.exec(normalized))) {
    const text = phraseMatch[0];
    if (!isPureNumeric(text.replace(/-/g, ""))) {
      phrases.push(text);
    }
  }

  const contentTokens: string[] = [];
  const tokenRe = /[a-z0-9]+(?:-[a-z0-9]+)*/g;
  let tokenMatch: RegExpExecArray | null;
  while ((tokenMatch = tokenRe.exec(normalized))) {
    const raw = tokenMatch[0];
    if (raw.includes("-")) {
      continue;
    }
    if (raw.length < 2 || raw.length > 40 || isPureNumeric(raw)) {
      continue;
    }
    if (ASK_LEXICAL_SCAFFOLDING.has(raw)) {
      continue;
    }
    contentTokens.push(raw);
    if (contentTokens.length >= ASK_LEXICAL_MAX_CONTENT_TOKENS) {
      break;
    }
  }

  const out: AskLexicalQuery[] = [];
  const seen = new Set<string>();
  for (const phrase of phrases) {
    pushQuery(out, seen, phrase.replace(/-/g, " "), "hyphen_phrase");
  }
  for (let index = 0; index + 1 < contentTokens.length; index += 2) {
    pushQuery(
      out,
      seen,
      `${contentTokens[index]} ${contentTokens[index + 1]}`,
      "content_bigram",
    );
  }
  if (contentTokens.length % 2 === 1) {
    pushQuery(out, seen, contentTokens[contentTokens.length - 1], "content_unigram");
  }
  if (out.length === 0 && contentTokens.length > 0) {
    pushQuery(out, seen, contentTokens.slice(0, 8).join(" "), "content_fallback");
  }
  return out;
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

type UnionAccumulator = {
  hit: DocumentChunkHit;
  matchCount: number;
  bestPosition: number;
  firstQueryIndex: number;
};

/**
 * Dedupe by chunk_id. One chunk returned by several searches uses one slot.
 *
 * Order, highest first:
 * 1. How many of the bounded searches returned the chunk.
 * 2. Best (lowest) 1-based position in any of those RPC result lists.
 *    The RPC does not return ts_rank_cd, so position in that search's
 *    already-ranked list is the only cross-search rank signal.
 * 3. Earlier search index.
 * 4. document id, locator, part index, chunk id.
 *
 * Not inverse-frequency. Not an authority or evidence-role ranker.
 */
export function unionAskChunkHits(
  searches: Array<{ query: string; hits: DocumentChunkHit[] }>,
  cap = DOCUMENT_CHUNK_RETRIEVAL_CAP,
): { hits: DocumentChunkHit[]; unionChunkIds: string[] } {
  const boundedCap = Math.min(Math.max(cap, 1), DOCUMENT_CHUNK_RETRIEVAL_CAP);
  const byChunk = new Map<string, UnionAccumulator>();

  searches.forEach((search, queryIndex) => {
    search.hits.forEach((hit, index) => {
      const position = index + 1;
      const existing = byChunk.get(hit.chunk_id);
      if (!existing) {
        byChunk.set(hit.chunk_id, {
          hit,
          matchCount: 1,
          bestPosition: position,
          firstQueryIndex: queryIndex,
        });
        return;
      }
      existing.matchCount += 1;
      if (position < existing.bestPosition) {
        existing.bestPosition = position;
        existing.hit = hit;
      }
      if (queryIndex < existing.firstQueryIndex) {
        existing.firstQueryIndex = queryIndex;
      }
    });
  });

  const ranked = [...byChunk.values()].sort((a, b) => {
    if (a.matchCount !== b.matchCount) {
      return b.matchCount - a.matchCount;
    }
    if (a.bestPosition !== b.bestPosition) {
      return a.bestPosition - b.bestPosition;
    }
    if (a.firstQueryIndex !== b.firstQueryIndex) {
      return a.firstQueryIndex - b.firstQueryIndex;
    }
    return identityTieBreak(a.hit, b.hit);
  });

  const hits = ranked.slice(0, boundedCap).map((item) => item.hit);
  return { hits, unionChunkIds: hits.map((hit) => hit.chunk_id) };
}

export async function searchDocumentChunksForAskQuestion(
  input: { projectId: string; question: string; asOf?: string | null },
  search: AskChunkSearch,
): Promise<{ hits: DocumentChunkHit[] | null; trace: AskLexicalSearchTrace }> {
  const queries = decomposeAskLexicalQueries(input.question);
  const trace: AskLexicalSearchTrace = {
    queries,
    perQuery: [],
    unionChunkIds: [],
  };
  if (queries.length === 0) {
    return { hits: [], trace };
  }

  const searches: Array<{ query: string; hits: DocumentChunkHit[] }> = [];
  for (const lexicalQuery of queries) {
    const hits = await search({
      projectId: input.projectId,
      query: lexicalQuery.query,
      asOf: input.asOf,
    });
    if (hits === null) {
      return { hits: null, trace };
    }
    for (const hit of hits) {
      if (hit.project_id !== input.projectId) {
        throw new Error("Chunk retrieval escaped the authorized project.");
      }
    }
    if (hits.length > DOCUMENT_CHUNK_RETRIEVAL_CAP) {
      throw new Error("Chunk retrieval exceeded the hard result cap.");
    }
    trace.perQuery.push({
      query: lexicalQuery.query,
      chunkIds: hits.map((hit) => hit.chunk_id),
    });
    searches.push({ query: lexicalQuery.query, hits });
  }

  const union = unionAskChunkHits(searches);
  trace.unionChunkIds = union.unionChunkIds;
  return { hits: union.hits, trace };
}

export function searchAuthorizedDocumentChunksForAskQuestion(input: {
  projectId: string;
  question: string;
  asOf?: string | null;
}) {
  return searchDocumentChunksForAskQuestion(
    input,
    searchAuthorizedProjectDocumentChunks,
  );
}
