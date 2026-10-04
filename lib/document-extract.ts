/**
 * Stage 4B Markdown/plain-text and Stage 4F-B PDF page-chunk drafts.
 * Not wired into Ask. Original documents remain authoritative.
 * 4F-B does not write document_extractions / document_chunks.
 */

import { createHash } from "node:crypto";
import type {
  DocumentContentKind,
  DocumentLocatorType,
} from "@/lib/document-intelligence-types";
import {
  extractPdfTextLayer,
  type PdfExtractedPage,
  type PdfTextExtractOptions,
} from "@/lib/pdf-text-extract";

export const SITEPM_MARKDOWN_EXTRACTOR_NAME = "sitepm.md.section";
export const SITEPM_MARKDOWN_EXTRACTOR_VERSION = "4b.1";
export const MARKDOWN_CHUNK_CHAR_CAP = 8000;

export const SITEPM_PDF_EXTRACTOR_NAME = "sitepm.pdf.text";
export const SITEPM_PDF_EXTRACTOR_VERSION = "4f.b";
export const PDF_CHUNK_CHAR_CAP = 8000;
export const PDF_PAGE_LOCATOR_DIGITS = 4;

const SECTION_HEADING = /^## (\w+) —/;

export type ReadyDocumentIdentity = {
  id: string;
  company_id: string;
  project_id: string;
  sha256: string | null;
  status: "pending" | "ready" | "failed";
};

export type DerivedChunkDraft = {
  locator: string;
  locator_type: DocumentLocatorType;
  part_index: number;
  body: string;
  source_sha256: string;
  source_issued_on: string | null;
  source_effective_on: string | null;
  content_kind: DocumentContentKind;
};

export type DerivedExtractionDraft = {
  document_id: string;
  company_id: string;
  project_id: string;
  source_sha256: string;
  extractor_name: string;
  extractor_version: string;
  content_kind: DocumentContentKind;
  extracted_text: string;
  source_issued_on: string | null;
  source_effective_on: string | null;
  chunks: DerivedChunkDraft[];
};

export function sha256Hex(bytes: Uint8Array | Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function locatorTypeFor(locator: string): DocumentLocatorType {
  if (/^P\d+$/i.test(locator)) {
    return "caption";
  }
  if (/^S\d+$/i.test(locator)) {
    return "section";
  }
  return "section";
}

function splitOversizedSection(body: string, cap: number): string[] {
  if (body.length <= cap) {
    return [body];
  }
  const units: string[] = [];
  const lines = body.split("\n");
  let current = "";
  let inTable = false;

  const flush = () => {
    if (current.length > 0) {
      units.push(current);
      current = "";
    }
  };

  for (const line of lines) {
    const tableLine = /^\s*\|/.test(line);
    if (tableLine) {
      inTable = true;
    } else if (inTable && line.trim() === "") {
      inTable = false;
    } else if (inTable && !tableLine) {
      inTable = false;
    }

    const candidate = current.length === 0 ? line : `${current}\n${line}`;
    if (!inTable && candidate.length > cap && current.length > 0) {
      flush();
      current = line;
      continue;
    }
    current = candidate;
  }
  flush();

  const parts: string[] = [];
  for (const unit of units) {
    if (unit.length <= cap) {
      parts.push(unit);
      continue;
    }
    for (let offset = 0; offset < unit.length; offset += cap) {
      parts.push(unit.slice(offset, offset + cap));
    }
  }
  return parts.length > 0 ? parts : [body.slice(0, cap)];
}

export function chunkMarkdownSections(
  extractedText: string,
  sourceSha256: string,
  dates: { source_issued_on: string | null; source_effective_on: string | null },
  contentKind: DocumentContentKind = "markdown",
  cap = MARKDOWN_CHUNK_CHAR_CAP,
): DerivedChunkDraft[] {
  const lines = extractedText.split("\n");
  const sections: { locator: string; bodyLines: string[] }[] = [];
  let current: { locator: string; bodyLines: string[] } | null = null;

  for (const line of lines) {
    const match = line.match(SECTION_HEADING);
    if (match) {
      if (current) {
        sections.push(current);
      }
      current = { locator: match[1], bodyLines: [line] };
      continue;
    }
    if (current) {
      current.bodyLines.push(line);
    }
  }
  if (current) {
    sections.push(current);
  }

  const chunks: DerivedChunkDraft[] = [];
  for (const section of sections) {
    const body = section.bodyLines.join("\n").replace(/\n+$/, "");
    const parts = splitOversizedSection(body, cap);
    parts.forEach((part, partIndex) => {
      chunks.push({
        locator: section.locator,
        locator_type: locatorTypeFor(section.locator),
        part_index: partIndex,
        body: part,
        source_sha256: sourceSha256,
        source_issued_on: dates.source_issued_on,
        source_effective_on: dates.source_effective_on,
        content_kind: contentKind,
      });
    });
  }
  return chunks;
}

export function assertReadySourceIdentity(input: {
  bytes: Uint8Array | Buffer;
  parent: ReadyDocumentIdentity;
  expectedSha256?: string;
}) {
  if (input.parent.status !== "ready") {
    throw new Error("Extraction parent document must be ready");
  }
  const computed = sha256Hex(input.bytes);
  if (!input.parent.sha256 || input.parent.sha256 !== computed) {
    throw new Error("Extraction source_sha256 must match the parent document hash");
  }
  if (input.expectedSha256 && input.expectedSha256 !== computed) {
    throw new Error("Source bytes do not match the expected source identity hash");
  }
  return computed;
}

export function extractMarkdownDocument(input: {
  parent: ReadyDocumentIdentity;
  bytes: Uint8Array | Buffer;
  expectedSha256?: string;
  sourceIssuedOn?: string | null;
  sourceEffectiveOn?: string | null;
}): DerivedExtractionDraft {
  const sourceSha256 = assertReadySourceIdentity(input);
  const extractedText = Buffer.from(input.bytes).toString("utf8");
  const dates = {
    source_issued_on: input.sourceIssuedOn ?? null,
    source_effective_on: input.sourceEffectiveOn ?? null,
  };
  const chunks = chunkMarkdownSections(
    extractedText,
    sourceSha256,
    dates,
    "markdown",
  );
  return {
    document_id: input.parent.id,
    company_id: input.parent.company_id,
    project_id: input.parent.project_id,
    source_sha256: sourceSha256,
    extractor_name: SITEPM_MARKDOWN_EXTRACTOR_NAME,
    extractor_version: SITEPM_MARKDOWN_EXTRACTOR_VERSION,
    content_kind: "markdown",
    extracted_text: extractedText,
    source_issued_on: dates.source_issued_on,
    source_effective_on: dates.source_effective_on,
    chunks,
  };
}

export function pdfPageLocator(pageNumber: number): string {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error("PDF page locators require a 1-indexed page number");
  }
  return `page-${String(pageNumber).padStart(PDF_PAGE_LOCATOR_DIGITS, "0")}`;
}

function splitOversizedPage(body: string, cap: number): string[] {
  if (body.length <= cap) {
    return [body];
  }
  const units: string[] = [];
  let current = "";
  for (const line of body.split("\n")) {
    const candidate = current.length === 0 ? line : `${current}\n${line}`;
    if (candidate.length > cap && current.length > 0) {
      units.push(current);
      current = line;
      continue;
    }
    current = candidate;
  }
  if (current.length > 0) {
    units.push(current);
  }

  const parts: string[] = [];
  for (const unit of units) {
    if (unit.length <= cap) {
      parts.push(unit);
      continue;
    }
    for (let offset = 0; offset < unit.length; offset += cap) {
      parts.push(unit.slice(offset, offset + cap));
    }
  }
  return parts.length > 0 ? parts : [body.slice(0, cap)];
}

export function chunkPdfPages(
  pages: PdfExtractedPage[],
  sourceSha256: string,
  cap = PDF_CHUNK_CHAR_CAP,
): DerivedChunkDraft[] {
  const chunks: DerivedChunkDraft[] = [];
  for (const page of pages) {
    if (page.nonWhitespaceCount <= 0) {
      continue;
    }
    const locator = pdfPageLocator(page.pageNumber);
    const parts = splitOversizedPage(page.text, cap);
    parts.forEach((part, partIndex) => {
      chunks.push({
        locator,
        locator_type: "page",
        part_index: partIndex,
        body: part,
        source_sha256: sourceSha256,
        source_issued_on: null,
        source_effective_on: null,
        content_kind: "pdf_text",
      });
    });
  }
  return chunks;
}

export async function extractPdfDocument(
  input: {
    parent: ReadyDocumentIdentity;
    bytes: Uint8Array | Buffer;
    expectedSha256?: string;
  } & PdfTextExtractOptions & { chunkCap?: number },
): Promise<DerivedExtractionDraft> {
  const sourceSha256 = assertReadySourceIdentity(input);
  const parsed = await extractPdfTextLayer(input.bytes, {
    maxPages: input.maxPages,
    maxUtf8Bytes: input.maxUtf8Bytes,
  });
  const chunks = chunkPdfPages(parsed.pages, sourceSha256, input.chunkCap);

  return {
    document_id: input.parent.id,
    company_id: input.parent.company_id,
    project_id: input.parent.project_id,
    source_sha256: sourceSha256,
    extractor_name: SITEPM_PDF_EXTRACTOR_NAME,
    extractor_version: SITEPM_PDF_EXTRACTOR_VERSION,
    content_kind: "pdf_text",
    extracted_text: parsed.extractedText,
    source_issued_on: null,
    source_effective_on: null,
    chunks,
  };
}
