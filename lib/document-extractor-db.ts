/**
 * Restricted derived-evidence persist client. Not a general database client.
 * Uses SITEPM_EXTRACTOR_DATABASE_URL only. Never service_role.
 */

import postgres from "postgres";

export const SITEPM_EXTRACTOR_DATABASE_URL_ENV = "SITEPM_EXTRACTOR_DATABASE_URL";

export type PersistDerivedDocumentExtractionInput = {
  documentId: string;
  sourceSha256: string;
  extractorName: string;
  extractorVersion: string;
  contentKind: "pdf_text";
  extractedText: string;
  chunks: Array<{
    locator: string;
    locator_type: string;
    part_index: number;
    body: string;
    source_sha256: string;
    source_issued_on: string | null;
    source_effective_on: string | null;
    content_kind: string;
  }>;
};

export class DocumentExtractorDbError extends Error {
  readonly code: "extractor_db_unavailable" | "writer_rejected";

  constructor(code: DocumentExtractorDbError["code"], message: string) {
    super(message);
    this.name = "DocumentExtractorDbError";
    this.code = code;
  }
}

export function readExtractorDatabaseUrl(): string | null {
  const value = process.env[SITEPM_EXTRACTOR_DATABASE_URL_ENV]?.trim() ?? "";
  return value.length > 0 ? value : null;
}

type ExtractorSql = ReturnType<typeof postgres>;

let extractorSql: ExtractorSql | null | undefined;

function extractorConnection(): ExtractorSql | null {
  if (extractorSql !== undefined) {
    return extractorSql;
  }
  const url = readExtractorDatabaseUrl();
  if (!url) {
    extractorSql = null;
    return null;
  }
  extractorSql = postgres(url, {
    max: 1,
    prepare: false,
    // TLS remains mandatory for every remote connection. Local Supabase has no TLS.
    ssl: ["127.0.0.1", "localhost"].includes(new URL(url).hostname) ? false : "require",
    connect_timeout: 15,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
  });
  return extractorSql;
}

export async function persistDerivedDocumentExtraction(
  input: PersistDerivedDocumentExtractionInput,
): Promise<{ extractionId: string }> {
  const sql = extractorConnection();
  if (!sql) {
    throw new DocumentExtractorDbError(
      "extractor_db_unavailable",
      "Derived extraction writer is not configured",
    );
  }

  const chunkPayload = input.chunks.map((chunk) => ({
    locator: chunk.locator,
    locator_type: chunk.locator_type,
    part_index: chunk.part_index,
    body: chunk.body,
    source_sha256: chunk.source_sha256,
    source_issued_on: chunk.source_issued_on,
    source_effective_on: chunk.source_effective_on,
    content_kind: chunk.content_kind,
  }));

  try {
    const rows = await sql<{ id: string }[]>`
      select public.replace_ready_document_extraction(
        ${input.documentId}::uuid,
        ${input.sourceSha256},
        ${input.extractorName},
        ${input.extractorVersion},
        ${input.contentKind},
        ${input.extractedText},
        null::date,
        null::date,
        ${sql.json(chunkPayload)}::jsonb
      ) as id
    `;
    const extractionId = rows[0]?.id;
    if (!extractionId) {
      throw new DocumentExtractorDbError(
        "writer_rejected",
        "Derived extraction writer returned no extraction id",
      );
    }
    return { extractionId };
  } catch (error) {
    if (error instanceof DocumentExtractorDbError) {
      throw error;
    }
    throw new DocumentExtractorDbError(
      "writer_rejected",
      "Derived extraction writer rejected the persist",
    );
  }
}
