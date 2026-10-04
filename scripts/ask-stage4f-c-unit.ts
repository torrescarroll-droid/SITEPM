import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PDF_PARSER_CHILD_OPTION_ENV,
  PdfTextExtractError,
  pdfParserChildEnv,
} from "@/lib/pdf-text-extract";
import {
  extractPdfDocument,
  sha256Hex,
  type DerivedExtractionDraft,
  type ReadyDocumentIdentity,
} from "@/lib/document-extract";
import {
  assertAuthorizedReadyPdfDocument,
  assertPersistablePdfDraft,
  persistReadyPdfExtraction,
  verifyDownloadedCanonicalPdf,
  type CanonicalPdfIdentity,
} from "@/lib/document-extraction-persist";
import {
  buildEncryptedPdf,
  buildMalformedPdf,
  buildImageOnlyPdf,
  normalMultiPagePdf,
} from "./pdf-text-extract-fixtures";

let failed = 0;
function assert(name: string, condition: boolean) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`PASS ${name}`);
}

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "99999999-9999-4999-8999-999999999999";
const PROJECT_A = "22222222-2222-4222-8222-222222222222";
const PROJECT_B = "88888888-8888-4888-8888-888888888888";
const DOC = "33333333-3333-4333-8333-333333333333";

const persistSource = readFileSync("lib/document-extractor-db.ts", "utf8");
const persistOrch = readFileSync("lib/document-extraction-persist.ts", "utf8");
const week10 = readFileSync("sql/week10_document_extraction_executor.sql", "utf8");

assert(
  "C persistDerivedDocumentExtraction has no company_id persistence authority",
  persistSource.includes("documentId: string") &&
    persistSource.includes("sourceSha256") &&
    !persistSource.includes("companyId") &&
    !persistSource.includes("projectId"),
);
assert(
  "I/J writer invocation omits company_id and project_id",
  persistOrch.includes("documentId: document.id") &&
    persistOrch.includes("sourceSha256: verified.sha256") &&
    !/persistDraft\(\{[\s\S]*companyId/.test(persistOrch),
);

const bytes = normalMultiPagePdf();
const sha = sha256Hex(bytes);

function identity(overrides: Partial<CanonicalPdfIdentity> = {}): CanonicalPdfIdentity {
  return {
    id: DOC,
    status: "ready",
    sha256: sha,
    byte_size: bytes.length,
    storage_path: `${COMPANY_A}/${PROJECT_A}/${DOC}/normal.pdf`,
    company_id: COMPANY_A,
    project_id: PROJECT_A,
    ...overrides,
  };
}

function parentFor(source: Buffer): ReadyDocumentIdentity {
  return {
    id: DOC,
    company_id: COMPANY_A,
    project_id: PROJECT_A,
    sha256: sha256Hex(source),
    status: "ready",
  };
}

try {
  assertAuthorizedReadyPdfDocument(null, COMPANY_A);
  failed += 1;
  console.error("FAIL G null document should be unauthorized");
} catch (error) {
  assert(
    "G Company B/missing JWT document cannot trigger extraction",
    error instanceof Error && error.message.includes("not available"),
  );
}

try {
  assertAuthorizedReadyPdfDocument(identity(), COMPANY_B);
  failed += 1;
  console.error("FAIL G Company B identity should be unauthorized");
} catch (error) {
  assert("G Company B cannot extract Company A document", error instanceof Error);
}

try {
  verifyDownloadedCanonicalPdf(identity(), Buffer.concat([bytes, Buffer.from("x")]));
  failed += 1;
  console.error("FAIL L size mismatch did not throw");
} catch (error) {
  assert(
    "L different byte length is rejected before persist",
    error instanceof Error && /size/i.test(error.message),
  );
}

const tampered = Buffer.from(bytes);
tampered[tampered.length - 20] = (tampered[tampered.length - 20] + 1) % 256;
try {
  verifyDownloadedCanonicalPdf(
    identity({ byte_size: tampered.length }),
    tampered,
  );
  failed += 1;
  console.error("FAIL L hash mismatch did not throw");
} catch (error) {
  assert(
    "L different bytes fail SHA-256 verification",
    error instanceof Error && /hash/i.test(error.message),
  );
}

try {
  verifyDownloadedCanonicalPdf(identity({ sha256: "0".repeat(64) }), bytes);
  failed += 1;
  console.error("FAIL K wrong source hash did not throw");
} catch (error) {
  assert(
    "K wrong source hash yields zero new evidence",
    error instanceof Error && /hash/i.test(error.message),
  );
}

const goodDraft = await extractPdfDocument({
  parent: parentFor(bytes),
  bytes,
});
assertPersistablePdfDraft(goodDraft, sha);
assert("draft content_kind pdf_text", goodDraft.content_kind === "pdf_text");
assert("draft chunks exist", goodDraft.chunks.length > 0);
assert(
  "draft locators are page-NNNN",
  goodDraft.chunks.every((chunk) => /^page-\d{4,}$/.test(chunk.locator)),
);

const emptyDraft: DerivedExtractionDraft = { ...goodDraft, chunks: [] };
try {
  assertPersistablePdfDraft(emptyDraft, sha);
  failed += 1;
  console.error("FAIL empty draft accepted");
} catch {
  assert("empty chunk draft rejected before persist", true);
}

let persistCalls = 0;
const recorder = {
  downloadCanonicalObject: async () => bytes,
  extractPdf: extractPdfDocument,
  persistDraft: async () => {
    persistCalls += 1;
    return { extractionId: "44444444-4444-4444-8444-444444444444" };
  },
  extractorConfigured: () => true,
};

const first = await persistReadyPdfExtraction(
  { document: identity(), callerCompanyId: COMPANY_A },
  recorder,
);
const second = await persistReadyPdfExtraction(
  { document: identity(), callerCompanyId: COMPANY_A },
  recorder,
);
assert("O retry invokes replacement persist twice", persistCalls === 2);
assert(
  "O replacement uses same document id",
  "extractionId" in first && "extractionId" in second,
);

persistCalls = 0;
try {
  await persistReadyPdfExtraction(
    { document: identity(), callerCompanyId: COMPANY_A },
    {
      ...recorder,
      extractPdf: async () => {
        throw new PdfTextExtractError("malformed_pdf", "bad pdf");
      },
    },
  );
  failed += 1;
  console.error("FAIL M parser failure did not throw");
} catch {
  assert("M parser failure yields zero persist calls", persistCalls === 0);
}

persistCalls = 0;
try {
  await persistReadyPdfExtraction(
    { document: identity(), callerCompanyId: COMPANY_A },
    {
      ...recorder,
      extractPdf: async () => {
        throw new PdfTextExtractError("encrypted_or_password_protected", "locked");
      },
    },
  );
} catch {
  assert("encrypted PDF does not persist", persistCalls === 0);
}

persistCalls = 0;
try {
  await persistReadyPdfExtraction(
    { document: identity(), callerCompanyId: COMPANY_A },
    {
      ...recorder,
      persistDraft: async () => {
        persistCalls += 1;
        throw new Error("writer boom");
      },
    },
  );
} catch {
  assert("N writer failure is not treated as success", persistCalls === 1);
}

assert(
  "N SQL writer is a single function with no inner COMMIT",
  week10.includes("create or replace function public.replace_ready_document_extraction") &&
    !/\$\$[\s\S]*commit;[\s\S]*\$\$/i.test(week10),
);

try {
  await persistReadyPdfExtraction(
    { document: identity(), callerCompanyId: COMPANY_A },
    {
      ...recorder,
      extractorConfigured: () => false,
    },
  ).then((result) => {
    assert(
      "missing extractor URL skips persist",
      "skipped" in result && result.skipped === "extractor_unconfigured",
    );
  });
} catch {
  failed += 1;
  console.error("FAIL missing extractor URL should skip");
}

try {
  await extractPdfDocument({
    parent: parentFor(buildMalformedPdf()),
    bytes: buildMalformedPdf(),
    parser: "timeout-child",
  });
  failed += 1;
  console.error("FAIL malformed PDF via timeout-child did not throw");
} catch (error) {
  assert(
    "M parser typed failure produces no draft",
    error instanceof PdfTextExtractError,
  );
}

try {
  await extractPdfDocument({
    parent: parentFor(buildEncryptedPdf()),
    bytes: buildEncryptedPdf(),
    parser: "timeout-child",
  });
  failed += 1;
  console.error("FAIL encrypted PDF via timeout-child did not throw");
} catch (error) {
  assert(
    "encrypted parser failure produces no draft",
    error instanceof PdfTextExtractError &&
      error.code === "encrypted_or_password_protected",
  );
}

try {
  await extractPdfDocument({
    parent: parentFor(buildImageOnlyPdf()),
    bytes: buildImageOnlyPdf(),
    parser: "timeout-child",
  });
  failed += 1;
  console.error("FAIL textless PDF via timeout-child did not throw");
} catch (error) {
  assert(
    "textless PDF produces no draft",
    error instanceof PdfTextExtractError && error.code === "no_usable_text",
  );
}

const childDraft = await extractPdfDocument({
  parent: parentFor(bytes),
  bytes,
  parser: "timeout-child",
});
assert("timeout-child draft has chunks", childDraft.chunks.length > 0);
assertPersistablePdfDraft(childDraft, sha);

assert(
  "persistDerivedDocumentExtraction is the only writer API",
  persistSource.includes("export async function persistDerivedDocumentExtraction") &&
    persistSource.includes("replace_ready_document_extraction"),
);

process.env.SITEPM_EXTRACTOR_DATABASE_URL = "postgresql://sitepm_extractor:secret@localhost/postgres";
process.env.OPENAI_API_KEY = "sk-test";
process.env.SUPABASE_ANON_KEY = "anon-test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
process.env.DATABASE_URL = "postgresql://postgres:secret@localhost/postgres";
const childEnv = pdfParserChildEnv();
assert(
  "P child env has only the option key",
  Object.keys(childEnv).length === 1 && PDF_PARSER_CHILD_OPTION_ENV in childEnv,
);
assert("P child env omits extractor URI", !("SITEPM_EXTRACTOR_DATABASE_URL" in childEnv));
assert("P child env omits service_role", !("SUPABASE_SERVICE_ROLE_KEY" in childEnv));
assert("P child env omits OpenAI", !("OPENAI_API_KEY" in childEnv));
assert("P child env omits anon key", !("SUPABASE_ANON_KEY" in childEnv));

const probe = await new Promise<{
  keys: string[];
  sentinelPresent: Record<string, boolean>;
}>((resolve, reject) => {
  const child = spawn(
    process.execPath,
    [join(process.cwd(), "scripts/pdf-text-extract-env-probe.mjs")],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: childEnv as NodeJS.ProcessEnv,
    },
  );
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.on("error", reject);
  child.on("close", (code) => {
    if (code !== 0) {
      reject(new Error(`probe exit ${code}`));
      return;
    }
    resolve(JSON.parse(stdout));
  });
});

assert(
  "P spawned child has no application secrets",
  probe.sentinelPresent.OPENAI_API_KEY === false &&
    probe.sentinelPresent.SUPABASE_ANON_KEY === false &&
    probe.sentinelPresent.SUPABASE_SERVICE_ROLE_KEY === false &&
    probe.sentinelPresent.SITEPM_EXTRACTOR_DATABASE_URL === false &&
    probe.sentinelPresent.DATABASE_URL === false,
);

assert(
  "H evidence remains JWT/RLS (extractor has no SELECT grant)",
  week10.includes("revoke all on table public.document_chunks from sitepm_extractor") &&
    week10.includes("revoke all on table public.document_extractions from sitepm_extractor"),
);

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4f-c-unit: ok");
