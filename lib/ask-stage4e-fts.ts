/**
 * Stage 4E-B evaluator helpers (FTS fixture identities + proof-boundary copy).
 * Must not be imported by production Ask, retrieval, or provider modules.
 *
 * RP001 4E-B database rows are a BENCHMARK FTS ADAPTER, not a genuine
 * production PDF upload / Storage preservation / 4F extraction lifecycle.
 *
 * Operational constraint: deterministic document UUIDs are global PKs, so
 * only one RP001 4E-B fixture can exist per database.
 */

import { createHash } from "node:crypto";
import {
  isDocumentContentKind,
  isDocumentLocatorType,
  type DocumentChunkHit,
} from "@/lib/document-intelligence-types";

export const STAGE4E_FTS_PROOF_BOUNDARY = [
  "POSTGRESQL FTS BENCHMARK",
  "search_project_document_chunks",
  "AUTHENTICATED JWT / RLS",
  "RP001 BENCHMARK DATABASE ADAPTER",
  "NOT PRODUCTION UPLOAD / STORAGE / PDF EXTRACTION VALIDATION",
  "RP001 4E-B database fixture bypasses the production PDF upload/Storage preservation path. Its ready document rows exist only to satisfy the existing derived-evidence/FTS schema and must not be interpreted as proof of upload or preservation behavior.",
].join("\n");

export const SITEPM_BENCH_FIXTURE_CONFIRMATION = "RP001_4EB";

export const STAGE4E_FTS_ONE_FIXTURE_PER_DATABASE = [
  "Deterministic RP001 4E-B document UUIDs are global documents.id primary keys.",
  "Only one RP001 4E-B fixture can exist per database.",
  "A second isolated benchmark company cannot host another copy simultaneously with this ID scheme.",
  "SQL collision guards refuse insert if those UUIDs already exist (no accidental takeover).",
  "This is an operational constraint, not a security weakness.",
].join(" ");

/** Evaluator-only UUID v5 namespace. Not a production table value. */
export const RP001_4EB_UUID_NAMESPACE = "c0ffee00-4e0b-4000-8000-000052503031";

export const RP001_SOURCE_IDS = [
  "RP001-D01",
  "RP001-D02",
  "RP001-D03",
  "RP001-D04",
  "RP001-D05",
  "RP001-D06",
  "RP001-D07",
  "RP001-D08",
  "RP001-D09",
  "RP001-D10",
  "RP001-D11",
  "RP001-D12",
  "RP001-D13",
  "RP001-D14",
  "RP001-D15",
] as const;

export type Rp001SourceId = (typeof RP001_SOURCE_IDS)[number];

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

export function uuidV5(name: string, namespaceUuid: string) {
  const ns = Buffer.from(namespaceUuid.replace(/-/g, ""), "hex");
  if (ns.length !== 16) {
    throw new Error("UUID v5 namespace must be 16 bytes");
  }
  const hash = createHash("sha1").update(ns).update(name).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function rp001BenchmarkDocumentUuid(sourceId: Rp001SourceId | string) {
  return uuidV5(`sitepm.4eb.document.${sourceId}`, RP001_4EB_UUID_NAMESPACE);
}

export function rp001BenchmarkAdapterFilename(sourceId: string) {
  return `${sourceId}-BENCHMARK-MARKDOWN.pdf`;
}

export function rp001SourceIdFromAdapterFilename(filename: string) {
  const match = filename.match(/^(RP001-D\d{2})-BENCHMARK-MARKDOWN\.pdf$/);
  return match?.[1] ?? null;
}

export function buildRp001DocumentIdMap() {
  const bySource = new Map<string, string>();
  const byDocumentId = new Map<string, string>();
  for (const sourceId of RP001_SOURCE_IDS) {
    const id = rp001BenchmarkDocumentUuid(sourceId);
    bySource.set(sourceId, id);
    byDocumentId.set(id, sourceId);
  }
  return { bySource, byDocumentId };
}

/** JWT negative-test identities. Must not collide with canonical RP001 document UUIDs. */
export const RP001_4EB_SENTINEL_DOCUMENT_ID = uuidV5(
  "sitepm.4eb.sentinel.document",
  RP001_4EB_UUID_NAMESPACE,
);
export const RP001_4EB_SENTINEL_EXTRACTION_ID = uuidV5(
  "sitepm.4eb.sentinel.extraction",
  RP001_4EB_UUID_NAMESPACE,
);
export const RP001_4EB_SENTINEL_CHUNK_ID = uuidV5(
  "sitepm.4eb.sentinel.chunk",
  RP001_4EB_UUID_NAMESPACE,
);

export function sentinelIdsCollideWithFixture() {
  const fixture = new Set(buildRp001DocumentIdMap().byDocumentId.keys());
  return (
    fixture.has(RP001_4EB_SENTINEL_DOCUMENT_ID) ||
    fixture.has(RP001_4EB_SENTINEL_EXTRACTION_ID) ||
    fixture.has(RP001_4EB_SENTINEL_CHUNK_ID)
  );
}

export const STAGE4E_FTS_REQUIRED_ENV = [
  "SITEPM_BENCH_URL",
  "SITEPM_BENCH_ANON_KEY",
  "SITEPM_BENCH_EMAIL",
  "SITEPM_BENCH_PASSWORD",
  "SITEPM_BENCH_PROJECT_ID",
  "SITEPM_BENCH_FOREIGN_EMAIL",
  "SITEPM_BENCH_FOREIGN_PASSWORD",
] as const;

export type Stage4eFtsEnvName = (typeof STAGE4E_FTS_REQUIRED_ENV)[number];

export const STAGE4E_FTS_SQL_REQUIRED_ENV = [
  "SITEPM_BENCH_COMPANY_ID",
  "SITEPM_BENCH_PROJECT_ID",
  "SITEPM_BENCH_FIXTURE",
] as const;

export type BenchEnvDecision =
  | { kind: "skip"; missing: Stage4eFtsEnvName[] }
  | { kind: "partial"; missing: Stage4eFtsEnvName[] }
  | { kind: "ready" };

export function classifyBenchEnv(
  read: (name: Stage4eFtsEnvName) => string,
): BenchEnvDecision {
  const missing = STAGE4E_FTS_REQUIRED_ENV.filter((name) => read(name).trim() === "");
  if (missing.length === STAGE4E_FTS_REQUIRED_ENV.length) {
    return { kind: "skip", missing: [...STAGE4E_FTS_REQUIRED_ENV] };
  }
  if (missing.length > 0) {
    return { kind: "partial", missing };
  }
  return { kind: "ready" };
}

export function emailsMatch(actual: string | null | undefined, expected: string) {
  return (actual ?? "").trim().toLowerCase() === expected.trim().toLowerCase();
}

export function isSha256Hex(value: string) {
  return /^[a-f0-9]{64}$/.test(value);
}

export function isIsoDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function requireUuidField(label: string, value: unknown): string {
  if (typeof value !== "string" || !isUuid(value)) {
    throw new Error(`Malformed RPC ${label}`);
  }
  return value;
}

function optionalDateField(label: string, value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== "string" || !isIsoDateOnly(value)) {
    throw new Error(`Malformed RPC ${label}`);
  }
  return value;
}

/**
 * Evaluator-side validation of search_project_document_chunks rows.
 * Does not change the production Stage 4C mapper.
 */
export function parseStage4eFtsRpcHit(row: unknown): DocumentChunkHit {
  if (!row || typeof row !== "object") {
    throw new Error("Malformed RPC hit");
  }
  const record = row as Record<string, unknown>;
  const companyId = requireUuidField("company_id", record.company_id);
  const projectId = requireUuidField("project_id", record.project_id);
  const documentId = requireUuidField("document_id", record.document_id);
  const extractionId = requireUuidField("extraction_id", record.extraction_id);
  const chunkId = requireUuidField("chunk_id", record.chunk_id);
  if (typeof record.source_sha256 !== "string" || !isSha256Hex(record.source_sha256)) {
    throw new Error("Malformed RPC source_sha256");
  }
  if (typeof record.content_kind !== "string" || !isDocumentContentKind(record.content_kind)) {
    throw new Error("Malformed RPC content_kind");
  }
  if (typeof record.locator !== "string" || record.locator.trim().length === 0) {
    throw new Error("Malformed RPC locator");
  }
  if (typeof record.locator_type !== "string" || !isDocumentLocatorType(record.locator_type)) {
    throw new Error("Malformed RPC locator_type");
  }
  if (typeof record.part_index !== "number" || !Number.isInteger(record.part_index) || record.part_index < 0) {
    throw new Error("Malformed RPC part_index");
  }
  if (typeof record.body !== "string") {
    throw new Error("Malformed RPC body");
  }
  return {
    company_id: companyId,
    project_id: projectId,
    document_id: documentId,
    extraction_id: extractionId,
    chunk_id: chunkId,
    source_sha256: record.source_sha256,
    content_kind: record.content_kind,
    locator: record.locator,
    locator_type: record.locator_type,
    part_index: record.part_index,
    source_issued_on: optionalDateField("source_issued_on", record.source_issued_on),
    source_effective_on: optionalDateField("source_effective_on", record.source_effective_on),
    body: record.body,
  };
}

export type FixtureIntegrityKind =
  | "missing"
  | "incomplete_parents"
  | "missing_derived"
  | "ok";

export function classifyFixtureIntegrity(input: {
  documentCount: number;
  extractionDocumentIds: number;
  missingLocators: boolean;
}): FixtureIntegrityKind {
  if (input.documentCount === 0) {
    return "missing";
  }
  if (input.documentCount !== 15) {
    return "incomplete_parents";
  }
  if (input.extractionDocumentIds !== 15 || input.missingLocators) {
    return "missing_derived";
  }
  return "ok";
}

export function fixtureIntegrityBlocksRecall(kind: FixtureIntegrityKind) {
  return kind !== "ok";
}

export function mutationUsesLocatorOnlyFilter(filter: Record<string, string>) {
  const keys = Object.keys(filter);
  return keys.length === 1 && keys[0] === "locator";
}
