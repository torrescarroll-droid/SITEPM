/**
 * Stage 4C project-scoped document-chunk retrieval.
 * Used by Ask and the document desk. Chunk body is untrusted DATA.
 */

import { requireAuthorizedAskProject } from "@/lib/ask-scope";
import { requireCompanyContext } from "@/lib/auth-context";
import type { DerivedExtractionDraft } from "@/lib/document-extract";
import {
  isDocumentContentKind,
  isDocumentLocatorType,
  type DocumentChunkHit,
} from "@/lib/document-intelligence-types";

export const DOCUMENT_CHUNK_RETRIEVAL_CAP = 25;
export const DOCUMENT_CHUNK_QUERY_MAX_CHARS = 500;

export function normalizeRetrievalQuery(query: string): string {
  return query.trim().slice(0, DOCUMENT_CHUNK_QUERY_MAX_CHARS);
}

export function chunkPassesAsOf(
  sourceIssuedOn: string | null,
  asOf: string | null | undefined,
): boolean {
  if (!asOf) {
    return true;
  }
  if (!sourceIssuedOn) {
    return true;
  }
  return sourceIssuedOn <= asOf;
}

function retrievalTokens(query: string): string[] {
  return normalizeRetrievalQuery(query)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

/**
 * Offline/evaluation matcher for RP001 locator tests without a local Postgres.
 * Production ranking is PostgreSQL ts_rank_cd via search_project_document_chunks.
 */
export function extractedChunkMatchesQuery(
  chunk: { locator: string; body: string },
  query: string,
): boolean {
  const tokens = retrievalTokens(query);
  if (tokens.length === 0) {
    return false;
  }
  const haystack = `${chunk.locator} ${chunk.body}`.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function identityKey(hit: DocumentChunkHit): string {
  return `${hit.document_id}\0${hit.locator}\0${hit.part_index}\0${hit.chunk_id}`;
}

function compareHits(a: DocumentChunkHit, b: DocumentChunkHit): number {
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

export function flattenExtractionDraftsToHits(
  drafts: DerivedExtractionDraft[],
): DocumentChunkHit[] {
  const hits: DocumentChunkHit[] = [];
  for (const draft of drafts) {
    const extractionId = `${draft.document_id}:extraction`;
    draft.chunks.forEach((chunk, index) => {
      hits.push({
        company_id: draft.company_id,
        project_id: draft.project_id,
        document_id: draft.document_id,
        extraction_id: extractionId,
        chunk_id: `${draft.document_id}:${chunk.locator}:${chunk.part_index}:${index}`,
        source_sha256: chunk.source_sha256,
        content_kind: chunk.content_kind,
        locator: chunk.locator,
        locator_type: chunk.locator_type,
        part_index: chunk.part_index,
        source_issued_on: chunk.source_issued_on,
        source_effective_on: chunk.source_effective_on,
        body: chunk.body,
      });
    });
  }
  return hits;
}

export function searchExtractedChunksOffline(input: {
  hits: DocumentChunkHit[];
  companyId: string;
  projectId: string;
  query: string;
  asOf?: string | null;
  cap?: number;
}): DocumentChunkHit[] {
  const query = normalizeRetrievalQuery(input.query);
  if (!query || retrievalTokens(query).length === 0) {
    return [];
  }
  const cap = Math.min(
    Math.max(input.cap ?? DOCUMENT_CHUNK_RETRIEVAL_CAP, 1),
    DOCUMENT_CHUNK_RETRIEVAL_CAP,
  );
  const matched = input.hits.filter((hit) => {
    if (hit.company_id !== input.companyId || hit.project_id !== input.projectId) {
      return false;
    }
    if (!chunkPassesAsOf(hit.source_issued_on, input.asOf)) {
      return false;
    }
    return extractedChunkMatchesQuery(hit, query);
  });
  matched.sort((a, b) => {
    const scoreA = retrievalTokens(query).reduce(
      (sum, token) =>
        sum + (a.body.toLowerCase().split(token).length - 1),
      0,
    );
    const scoreB = retrievalTokens(query).reduce(
      (sum, token) =>
        sum + (b.body.toLowerCase().split(token).length - 1),
      0,
    );
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    return compareHits(a, b);
  });
  return matched.slice(0, cap);
}

type RpcHitRow = {
  company_id: string;
  project_id: string;
  document_id: string;
  extraction_id: string;
  chunk_id: string;
  source_sha256: string;
  content_kind: string;
  locator: string;
  locator_type: string;
  part_index: number;
  source_issued_on: string | null;
  source_effective_on: string | null;
  body: string;
};

function mapRpcHit(row: RpcHitRow, projectId: string, companyId: string): DocumentChunkHit {
  if (row.project_id !== projectId || row.company_id !== companyId) {
    throw new Error("Chunk retrieval escaped the authorized project.");
  }
  if (!isDocumentContentKind(row.content_kind) || !isDocumentLocatorType(row.locator_type)) {
    throw new Error("Chunk retrieval returned an invalid content or locator type.");
  }
  return {
    company_id: row.company_id,
    project_id: row.project_id,
    document_id: row.document_id,
    extraction_id: row.extraction_id,
    chunk_id: row.chunk_id,
    source_sha256: row.source_sha256,
    content_kind: row.content_kind,
    locator: row.locator,
    locator_type: row.locator_type,
    part_index: Number(row.part_index),
    source_issued_on: row.source_issued_on,
    source_effective_on: row.source_effective_on,
    body: row.body,
  };
}

/**
 * Authorized FTS retrieval. Returns null if the project is not in session scope.
 * Returns [] when the query is empty/unparseable or no chunks match.
 * Does not call an LLM.
 */
export async function searchAuthorizedProjectDocumentChunks(input: {
  projectId: string;
  query: string;
  asOf?: string | null;
}): Promise<DocumentChunkHit[] | null> {
  const scoped = await requireAuthorizedAskProject(input.projectId);
  if (!scoped) {
    return null;
  }

  const query = normalizeRetrievalQuery(input.query);
  if (!query) {
    return [];
  }

  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id || profile.company_id !== scoped.project.company_id) {
    return null;
  }

  const { data, error } = await supabase.rpc("search_project_document_chunks", {
    p_project_id: scoped.project.id,
    p_query: query,
    p_as_of: input.asOf ?? null,
    p_limit: DOCUMENT_CHUNK_RETRIEVAL_CAP,
  });

  if (error) {
    throw new Error(error.message);
  }

  const hits = (data ?? []).map((row: RpcHitRow) =>
    mapRpcHit(row, scoped.project.id, scoped.project.company_id),
  );
  if (hits.length > DOCUMENT_CHUNK_RETRIEVAL_CAP) {
    throw new Error("Chunk retrieval exceeded the hard result cap.");
  }
  return hits;
}

export function hitIdentityList(hits: DocumentChunkHit[]): string[] {
  return hits.map(identityKey);
}
