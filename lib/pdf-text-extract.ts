/**
 * Stage 4F-A bounded digital-PDF text-layer parser.
 * Bytes in, page text or typed failure out. No Storage, DB, auth, or Ask.
 *
 * Wall-clock timeout is not claimed for in-process extraction. Use
 * extractPdfTextLayerWithTimeout (child process) when a killable bound is required.
 */

import { spawn } from "node:child_process";
import { join } from "node:path";
import {
  getDocument,
  InvalidPDFException,
  PasswordException,
  version as pdfjsVersion,
} from "pdfjs-dist/legacy/build/pdf.mjs";

export const SITEPM_PDFJS_DIST_VERSION = "6.4.299";
export const PDF_TEXT_EXTRACTOR_NAME = "sitepm.pdf.text";
export const PDF_TEXT_EXTRACTOR_VERSION = "4f.a";

/** Provisional operational bounds. Calibrate later on real PDFs, not RP001. */
export const PDF_TEXT_EXTRACT_MAX_PAGES = 200;
export const PDF_TEXT_EXTRACT_MAX_UTF8_BYTES = 2 * 1024 * 1024;
export const PDF_TEXT_EXTRACT_TIMEOUT_MS = 15_000;

export const PDF_TEXT_EXTRACT_FAILURE_CODES = [
  "invalid_pdf_header",
  "malformed_pdf",
  "encrypted_or_password_protected",
  "zero_pages",
  "page_limit_exceeded",
  "extracted_text_limit_exceeded",
  "parser_timeout",
  "parser_warning_or_partial_failure",
  "no_usable_text",
] as const;

export type PdfTextExtractFailureCode =
  (typeof PDF_TEXT_EXTRACT_FAILURE_CODES)[number];

export type PdfExtractedPage = {
  pageNumber: number;
  text: string;
  characterCount: number;
  nonWhitespaceCount: number;
};

export type PdfTextQualityFacts = {
  pageCount: number;
  pagesWithNonWhitespace: number;
  characterCount: number;
  nonWhitespaceCount: number;
  utf8ByteCount: number;
  printableRatio: number;
  longestRepeatedCharRun: number;
};

export type PdfTextExtractSuccess = {
  ok: true;
  pageCount: number;
  pages: PdfExtractedPage[];
  extractedText: string;
  quality: PdfTextQualityFacts;
  parser: {
    name: "pdfjs-dist";
    version: string;
  };
};

export type PdfTextExtractOptions = {
  maxPages?: number;
  maxUtf8Bytes?: number;
};

export class PdfTextExtractError extends Error {
  readonly code: PdfTextExtractFailureCode;
  readonly quality: PdfTextQualityFacts | null;

  constructor(
    code: PdfTextExtractFailureCode,
    message: string,
    quality: PdfTextQualityFacts | null = null,
  ) {
    super(message);
    this.name = "PdfTextExtractError";
    this.code = code;
    this.quality = quality;
  }
}

export function isPdfTextExtractFailureCode(
  value: string,
): value is PdfTextExtractFailureCode {
  return (PDF_TEXT_EXTRACT_FAILURE_CODES as readonly string[]).includes(value);
}

export function bytesStartWithPdfHeader(bytes: Uint8Array | Buffer): boolean {
  if (bytes.byteLength < 4) {
    return false;
  }
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

function asUint8Array(bytes: Uint8Array | Buffer): Uint8Array {
  if (bytes instanceof Uint8Array && !(bytes instanceof Buffer)) {
    return bytes;
  }
  return Uint8Array.from(bytes);
}

function copyPdfBytes(bytes: Uint8Array | Buffer): Uint8Array {
  const source = asUint8Array(bytes);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy;
}

function nonWhitespaceCount(text: string): number {
  let count = 0;
  for (const char of text) {
    if (char.trim() !== "") {
      count += 1;
    }
  }
  return count;
}

function isPrintableChar(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined) {
    return false;
  }
  if (code === 9 || code === 10 || code === 13) {
    return true;
  }
  if (code < 32 || code === 127) {
    return false;
  }
  if (code >= 0x80 && code <= 0x9f) {
    return false;
  }
  return true;
}

function printableRatio(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  let printable = 0;
  let total = 0;
  for (const char of text) {
    total += 1;
    if (isPrintableChar(char)) {
      printable += 1;
    }
  }
  return printable / total;
}

function longestRepeatedCharRun(text: string): number {
  let longest = 0;
  let current = 0;
  let previous: string | null = null;
  for (const char of text) {
    if (char === "\n" || char === "\r") {
      previous = null;
      current = 0;
      continue;
    }
    if (char === previous) {
      current += 1;
    } else {
      previous = char;
      current = 1;
    }
    if (current > longest) {
      longest = current;
    }
  }
  return longest;
}

function pageTextFromItems(items: unknown[]): string {
  let text = "";
  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }
    if (!("str" in item) || typeof item.str !== "string") {
      continue;
    }
    text += item.str;
    if ("hasEOL" in item && item.hasEOL === true) {
      text += "\n";
    }
  }
  return text;
}

function qualityFacts(
  pages: PdfExtractedPage[],
  extractedText: string,
): PdfTextQualityFacts {
  return {
    pageCount: pages.length,
    pagesWithNonWhitespace: pages.filter((page) => page.nonWhitespaceCount > 0)
      .length,
    characterCount: extractedText.length,
    nonWhitespaceCount: nonWhitespaceCount(extractedText),
    utf8ByteCount: Buffer.byteLength(extractedText, "utf8"),
    printableRatio: printableRatio(extractedText),
    longestRepeatedCharRun: longestRepeatedCharRun(extractedText),
  };
}

function fail(
  code: PdfTextExtractFailureCode,
  message: string,
  quality: PdfTextQualityFacts | null = null,
): never {
  throw new PdfTextExtractError(code, message, quality);
}

function isPasswordException(error: unknown): boolean {
  if (error instanceof PasswordException) {
    return true;
  }
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "PasswordException"
  );
}

function isInvalidPdfException(error: unknown): boolean {
  if (error instanceof InvalidPDFException) {
    return true;
  }
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "InvalidPDFException"
  );
}

function pdfjsDocumentParams(data: Uint8Array) {
  return {
    data,
    disableFontFace: true,
    useSystemFonts: false,
    useWasm: false,
    useWorkerFetch: false,
    stopAtErrors: true,
    enableXfa: false,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: true,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    verbosity: 0,
  };
}

/**
 * In-process parser. Does not kill CPU work on timeout.
 */
export async function extractPdfTextLayer(
  bytes: Uint8Array | Buffer,
  options: PdfTextExtractOptions = {},
): Promise<PdfTextExtractSuccess> {
  if (bytes.byteLength === 0 || !bytesStartWithPdfHeader(bytes)) {
    fail("invalid_pdf_header", "PDF bytes must be non-empty and start with %PDF");
  }

  const maxPages = options.maxPages ?? PDF_TEXT_EXTRACT_MAX_PAGES;
  const maxUtf8Bytes = options.maxUtf8Bytes ?? PDF_TEXT_EXTRACT_MAX_UTF8_BYTES;

  const loadingTask = getDocument(pdfjsDocumentParams(copyPdfBytes(bytes)));
  try {
    const pdf = await loadingTask.promise;
    try {
      const pageCount = pdf.numPages;
      if (pageCount <= 0) {
        fail("zero_pages", "PDF has no pages");
      }
      if (pageCount > maxPages) {
        fail(
          "page_limit_exceeded",
          `PDF has ${pageCount} pages; limit is ${maxPages}`,
        );
      }

      const pages: PdfExtractedPage[] = [];
      let extractedText = "";

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        let page;
        try {
          page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent({
            includeMarkedContent: false,
            disableNormalization: false,
          });
          const text = pageTextFromItems(content.items);
          const extractedPage: PdfExtractedPage = {
            pageNumber,
            text,
            characterCount: text.length,
            nonWhitespaceCount: nonWhitespaceCount(text),
          };
          pages.push(extractedPage);
          extractedText +=
            pageNumber === 1 ? text : `\f${text}`;
          if (Buffer.byteLength(extractedText, "utf8") > maxUtf8Bytes) {
            fail(
              "extracted_text_limit_exceeded",
              `Extracted text exceeds ${maxUtf8Bytes} UTF-8 bytes`,
            );
          }
        } catch (error) {
          if (error instanceof PdfTextExtractError) {
            throw error;
          }
          fail(
            "parser_warning_or_partial_failure",
            `PDF page ${pageNumber} could not be extracted completely`,
          );
        } finally {
          page?.cleanup();
        }
      }

      const quality = qualityFacts(pages, extractedText);
      if (quality.nonWhitespaceCount === 0) {
        fail(
          "no_usable_text",
          "PDF opened but yielded no usable digital text layer",
          quality,
        );
      }

      return {
        ok: true,
        pageCount,
        pages,
        extractedText,
        quality,
        parser: {
          name: "pdfjs-dist",
          version: pdfjsVersion || SITEPM_PDFJS_DIST_VERSION,
        },
      };
    } finally {
      try {
        await pdf.cleanup();
      } catch {
        /* Cleanup must not mask extraction success or typed failures. */
      }
    }
  } catch (error) {
    if (error instanceof PdfTextExtractError) {
      throw error;
    }
    if (isPasswordException(error)) {
      fail(
        "encrypted_or_password_protected",
        "PDF is encrypted or password-protected",
      );
    }
    if (isInvalidPdfException(error)) {
      fail("malformed_pdf", "PDF is malformed or could not be opened");
    }
    fail(
      "malformed_pdf",
      error instanceof Error
        ? error.message
        : "PDF parser rejected the document",
    );
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      /* Loading-task teardown must not mask typed failures. */
    }
  }
  fail("malformed_pdf", "PDF parser returned no result");
}

type ChildFailurePayload = {
  ok: false;
  code: string;
  message: string;
  quality: PdfTextQualityFacts | null;
};

function parseChildOutput(stdout: string): PdfTextExtractSuccess {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    fail(
      "parser_warning_or_partial_failure",
      "PDF extract child returned invalid JSON",
    );
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    "ok" in parsed &&
    parsed.ok === true
  ) {
    return parsed as PdfTextExtractSuccess;
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    "ok" in parsed &&
    parsed.ok === false &&
    "code" in parsed &&
    typeof parsed.code === "string" &&
    isPdfTextExtractFailureCode(parsed.code)
  ) {
    const failure = parsed as ChildFailurePayload;
    const code = failure.code;
    if (!isPdfTextExtractFailureCode(code)) {
      fail(
        "parser_warning_or_partial_failure",
        "PDF extract child returned an unexpected payload",
      );
    }
    throw new PdfTextExtractError(code, failure.message, failure.quality);
  }
  fail(
    "parser_warning_or_partial_failure",
    "PDF extract child returned an unexpected payload",
  );
}

/**
 * Killable timeout wrapper. The child process is SIGKILL'd when the bound elapses.
 * In-process Promise.race is not used as a CPU kill switch.
 */
export function extractPdfTextLayerWithTimeout(
  bytes: Uint8Array | Buffer,
  options: PdfTextExtractOptions & {
    timeoutMs?: number;
    childScript?: string;
  } = {},
): Promise<PdfTextExtractSuccess> {
  const timeoutMs = options.timeoutMs ?? PDF_TEXT_EXTRACT_TIMEOUT_MS;
  const childScript =
    options.childScript ??
    join(process.cwd(), "scripts/pdf-text-extract-child.mjs");

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [childScript], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        SITEPM_PDF_EXTRACT_OPTIONS: JSON.stringify({
          maxPages: options.maxPages ?? PDF_TEXT_EXTRACT_MAX_PAGES,
          maxUtf8Bytes: options.maxUtf8Bytes ?? PDF_TEXT_EXTRACT_MAX_UTF8_BYTES,
        }),
      },
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGKILL");
      reject(
        new PdfTextExtractError(
          "parser_timeout",
          `PDF extract exceeded ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(
        new PdfTextExtractError(
          "parser_warning_or_partial_failure",
          error.message,
        ),
      );
    });

    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (signal === "SIGKILL") {
        reject(
          new PdfTextExtractError(
            "parser_timeout",
            `PDF extract exceeded ${timeoutMs}ms`,
          ),
        );
        return;
      }
      if (code !== 0) {
        reject(
          new PdfTextExtractError(
            "parser_warning_or_partial_failure",
            stderr.trim() || `PDF extract child exited ${code}`,
          ),
        );
        return;
      }
      try {
        resolve(parseChildOutput(stdout));
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.on("error", () => {
      /* Child may close stdin after a fast failure. */
    });
    child.stdin.end(Buffer.from(asUint8Array(bytes)));
  });
}
