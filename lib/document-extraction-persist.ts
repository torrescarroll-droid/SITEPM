/**
 * Stage 4F-C: JWT Storage download + hash verify + 4F-B PDF draft + restricted writer.
 * Failures leave documents.status = ready. Never uses service_role.
 */

import { createHash } from "node:crypto";
import { DOCUMENT_BUCKET, type DocumentRecord } from "@/lib/document-types";
import {
  extractPdfDocument,
  SITEPM_PDF_EXTRACTOR_NAME,
  SITEPM_PDF_EXTRACTOR_VERSION,
  type DerivedExtractionDraft,
} from "@/lib/document-extract";
import {
  persistDerivedDocumentExtraction,
  readExtractorDatabaseUrl,
  DocumentExtractorDbError,
} from "@/lib/document-extractor-db";
import { PdfTextExtractError } from "@/lib/pdf-text-extract";

export const PDF_PAGE_LOCATOR_PATTERN = /^page-\d{4,}$/;

export type CanonicalPdfIdentity = {
  id: string;
  status: DocumentRecord["status"];
  sha256: string | null;
  byte_size: number;
  storage_path: string;
  company_id: string;
  project_id: string;
};

export type DerivedExtractionFailureCode =
  | "unauthorized"
  | "document_not_ready"
  | "missing_source_identity"
  | "storage_download_failed"
  | "size_mismatch"
  | "sha256_mismatch"
  | "invalid_draft"
  | "empty_chunks"
  | "malformed_pdf"
  | "encrypted_pdf"
  | "textless_pdf"
  | "parser_timeout"
  | "page_limit"
  | "text_limit"
  | "parser_failure"
  | "extractor_db_unavailable"
  | "writer_rejected";

export class DerivedExtractionPersistError extends Error {
  readonly code: DerivedExtractionFailureCode;

  constructor(code: DerivedExtractionFailureCode, message: string) {
    super(message);
    this.name = "DerivedExtractionPersistError";
    this.code = code;
  }
}

export type CanonicalStorageDownloader = {
  storage: {
    from: (bucket: string) => {
      download: (path: string) => Promise<{
        data: Blob | ArrayBuffer | Buffer | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

function sha256Hex(bytes: Uint8Array | Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertAuthorizedReadyPdfDocument(
  document: CanonicalPdfIdentity | null,
  callerCompanyId: string,
): CanonicalPdfIdentity {
  if (!document) {
    throw new DerivedExtractionPersistError(
      "unauthorized",
      "Document is not available to this company",
    );
  }
  if (document.company_id !== callerCompanyId) {
    throw new DerivedExtractionPersistError(
      "unauthorized",
      "Document is not available to this company",
    );
  }
  if (document.status !== "ready") {
    throw new DerivedExtractionPersistError(
      "document_not_ready",
      "Canonical document must be ready before extraction",
    );
  }
  if (!document.sha256 || !Number.isFinite(document.byte_size)) {
    throw new DerivedExtractionPersistError(
      "missing_source_identity",
      "Canonical document is missing size or hash",
    );
  }
  return document;
}

export function verifyDownloadedCanonicalPdf(
  document: CanonicalPdfIdentity,
  bytes: Buffer,
): { sha256: string; bytes: Buffer } {
  if (bytes.length !== document.byte_size) {
    throw new DerivedExtractionPersistError(
      "size_mismatch",
      "Downloaded PDF size does not match the canonical document",
    );
  }
  const digest = sha256Hex(bytes);
  if (digest !== document.sha256) {
    throw new DerivedExtractionPersistError(
      "sha256_mismatch",
      "Downloaded PDF hash does not match the canonical document",
    );
  }
  return { sha256: digest, bytes };
}

export function assertPersistablePdfDraft(
  draft: DerivedExtractionDraft,
  verifiedSha256: string,
): void {
  if (draft.content_kind !== "pdf_text") {
    throw new DerivedExtractionPersistError(
      "invalid_draft",
      "Derived extraction draft is not pdf_text",
    );
  }
  if (draft.source_sha256 !== verifiedSha256) {
    throw new DerivedExtractionPersistError(
      "invalid_draft",
      "Derived extraction draft hash does not match verified bytes",
    );
  }
  if (draft.chunks.length === 0) {
    throw new DerivedExtractionPersistError(
      "empty_chunks",
      "Derived extraction draft has no evidence chunks",
    );
  }
  for (const chunk of draft.chunks) {
    if (chunk.locator_type !== "page") {
      throw new DerivedExtractionPersistError(
        "invalid_draft",
        "Derived extraction chunk locator_type must be page",
      );
    }
    if (!PDF_PAGE_LOCATOR_PATTERN.test(chunk.locator)) {
      throw new DerivedExtractionPersistError(
        "invalid_draft",
        "Derived extraction chunk locator is not a 4F-B page locator",
      );
    }
    if (chunk.source_sha256 !== verifiedSha256) {
      throw new DerivedExtractionPersistError(
        "invalid_draft",
        "Derived extraction chunk hash does not match verified bytes",
      );
    }
    if (chunk.content_kind !== "pdf_text") {
      throw new DerivedExtractionPersistError(
        "invalid_draft",
        "Derived extraction chunk content_kind must be pdf_text",
      );
    }
  }
}

export async function downloadCanonicalProjectDocument(
  supabase: CanonicalStorageDownloader,
  storagePath: string,
): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .download(storagePath);
  if (error || !data) {
    throw new DerivedExtractionPersistError(
      "storage_download_failed",
      "Canonical PDF could not be downloaded",
    );
  }
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  return Buffer.from(await data.arrayBuffer());
}

function mapParserFailure(error: unknown): never {
  if (error instanceof DerivedExtractionPersistError) {
    throw error;
  }
  if (error instanceof DocumentExtractorDbError) {
    throw new DerivedExtractionPersistError(error.code, error.message);
  }
  if (error instanceof PdfTextExtractError) {
    const mapped: Record<string, DerivedExtractionFailureCode> = {
      malformed_pdf: "malformed_pdf",
      invalid_pdf_header: "malformed_pdf",
      encrypted_or_password_protected: "encrypted_pdf",
      no_usable_text: "textless_pdf",
      zero_pages: "textless_pdf",
      parser_timeout: "parser_timeout",
      page_limit_exceeded: "page_limit",
      extracted_text_limit_exceeded: "text_limit",
    };
    throw new DerivedExtractionPersistError(
      mapped[error.code] ?? "parser_failure",
      "PDF text extraction failed",
    );
  }
  throw new DerivedExtractionPersistError(
    "parser_failure",
    "PDF text extraction failed",
  );
}

export type PersistReadyPdfExtractionDeps = {
  downloadCanonicalObject: (storagePath: string) => Promise<Buffer>;
  extractPdf: typeof extractPdfDocument;
  persistDraft: typeof persistDerivedDocumentExtraction;
  extractorConfigured: () => boolean;
};

export const defaultPersistReadyPdfExtractionDeps: PersistReadyPdfExtractionDeps =
  {
    downloadCanonicalObject: async () => {
      throw new DerivedExtractionPersistError(
        "storage_download_failed",
        "Canonical PDF download is not wired",
      );
    },
    extractPdf: extractPdfDocument,
    persistDraft: persistDerivedDocumentExtraction,
    extractorConfigured: () => readExtractorDatabaseUrl() !== null,
  };

export async function persistReadyPdfExtraction(
  input: {
    document: CanonicalPdfIdentity | null;
    callerCompanyId: string;
  },
  deps: PersistReadyPdfExtractionDeps = defaultPersistReadyPdfExtractionDeps,
): Promise<{ extractionId: string } | { skipped: "extractor_unconfigured" }> {
  if (!deps.extractorConfigured()) {
    return { skipped: "extractor_unconfigured" };
  }

  try {
    const document = assertAuthorizedReadyPdfDocument(
      input.document,
      input.callerCompanyId,
    );
    const downloaded = await deps.downloadCanonicalObject(document.storage_path);
    const verified = verifyDownloadedCanonicalPdf(document, downloaded);
    const draft = await deps.extractPdf({
      parent: {
        id: document.id,
        company_id: document.company_id,
        project_id: document.project_id,
        sha256: verified.sha256,
        status: "ready",
      },
      bytes: verified.bytes,
      expectedSha256: verified.sha256,
      parser: "timeout-child",
    });
    assertPersistablePdfDraft(draft, verified.sha256);
    try {
      return await deps.persistDraft({
        documentId: document.id,
        sourceSha256: verified.sha256,
        extractorName: SITEPM_PDF_EXTRACTOR_NAME,
        extractorVersion: SITEPM_PDF_EXTRACTOR_VERSION,
        contentKind: "pdf_text",
        extractedText: draft.extracted_text,
        chunks: draft.chunks,
      });
    } catch (error) {
      if (error instanceof DocumentExtractorDbError) {
        throw new DerivedExtractionPersistError(error.code, error.message);
      }
      throw new DerivedExtractionPersistError(
        "writer_rejected",
        "Derived extraction writer rejected the persist",
      );
    }
  } catch (error) {
    mapParserFailure(error);
  }
}

export async function persistReadyPdfExtractionBestEffort(input: {
  supabase: CanonicalStorageDownloader;
  document: CanonicalPdfIdentity | null;
  callerCompanyId: string;
}): Promise<void> {
  try {
    await persistReadyPdfExtraction(
      {
        document: input.document,
        callerCompanyId: input.callerCompanyId,
      },
      {
        ...defaultPersistReadyPdfExtractionDeps,
        downloadCanonicalObject: (storagePath) =>
          downloadCanonicalProjectDocument(input.supabase, storagePath),
      },
    );
  } catch {
    // Best-effort derived evidence. Canonical preservation already succeeded.
  }
}
