/**
 * Stage 4A contracts for derived document evidence.
 * Not wired into Ask. Original `documents` rows remain authoritative.
 */

export const DOCUMENT_CONTENT_KINDS = [
  "markdown",
  "plain_text",
  "pdf_text",
] as const;

export type DocumentContentKind = (typeof DOCUMENT_CONTENT_KINDS)[number];

export const DOCUMENT_LOCATOR_TYPES = [
  "section",
  "caption",
  "page",
  "part",
] as const;

export type DocumentLocatorType = (typeof DOCUMENT_LOCATOR_TYPES)[number];

export type DocumentExtractionRecord = {
  id: string;
  company_id: string;
  project_id: string;
  document_id: string;
  source_sha256: string;
  extractor_name: string;
  extractor_version: string;
  content_kind: DocumentContentKind;
  extracted_text: string;
  source_issued_on: string | null;
  source_effective_on: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentChunkRecord = {
  id: string;
  company_id: string;
  project_id: string;
  document_id: string;
  extraction_id: string;
  source_sha256: string;
  locator: string;
  locator_type: DocumentLocatorType;
  part_index: number;
  body: string;
  source_issued_on: string | null;
  source_effective_on: string | null;
  created_at: string;
};

export function isDocumentContentKind(
  value: string,
): value is DocumentContentKind {
  return (DOCUMENT_CONTENT_KINDS as readonly string[]).includes(value);
}

export function isDocumentLocatorType(
  value: string,
): value is DocumentLocatorType {
  return (DOCUMENT_LOCATOR_TYPES as readonly string[]).includes(value);
}
