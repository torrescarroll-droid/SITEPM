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
  type ReadyDocumentIdentity,
} from "@/lib/document-extract";
import {
  assembleAskEvidencePack,
  documentChunkCitationLabel,
  documentChunkEvidenceItem,
  validateProposedCitations,
} from "@/lib/ask-evidence";
import { ASK_SYSTEM_PROMPT } from "@/lib/ai/provider";
import {
  STAGE_4F_D_FILENAME,
  STAGE_4F_D_PROMPT_FILENAME,
  STAGE_4F_D_PROMPT_TOKEN,
  STAGE_4F_D_TOKEN_PAGE1,
  STAGE_4F_D_TOKEN_PAGE2,
  buildEncryptedPdf,
  buildImageOnlyPdf,
  buildMalformedPdf,
  stage4fDDistinctivePdf,
  stage4fDPromptLikePdf,
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

const COMPANY = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const DOC = "33333333-3333-4333-8333-333333333333";
const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/pdf-text-extract");

function parentFor(bytes: Buffer): ReadyDocumentIdentity {
  return {
    id: DOC,
    company_id: COMPANY,
    project_id: PROJECT,
    sha256: sha256Hex(bytes),
    status: "ready",
  };
}

const distinctive = stage4fDDistinctivePdf();
assert(
  "committed distinctive PDF matches generator",
  Buffer.compare(distinctive, readFileSync(join(FIXTURE_DIR, STAGE_4F_D_FILENAME))) === 0,
);
assert(
  "committed prompt PDF matches generator",
  Buffer.compare(
    stage4fDPromptLikePdf(),
    readFileSync(join(FIXTURE_DIR, STAGE_4F_D_PROMPT_FILENAME)),
  ) === 0,
);
assert(
  "distinctive tokens are not leftover 4F-A fixture text",
  !distinctive.toString("latin1").includes("SITEPM 4F-A page 1") &&
    distinctive.toString("latin1").includes(STAGE_4F_D_TOKEN_PAGE1),
);

const draft = await extractPdfDocument({
  parent: parentFor(distinctive),
  bytes: distinctive,
  parser: "timeout-child",
});
assert("5 timeout-child extract succeeds", draft.content_kind === "pdf_text");
assert("6 draft has two page chunks", draft.chunks.length === 2);
assert(
  "7 locators are page-0001 and page-0002",
  draft.chunks[0]?.locator === "page-0001" &&
    draft.chunks[1]?.locator === "page-0002" &&
    draft.chunks.every((chunk) => chunk.locator_type === "page"),
);
assert("page 1 body has distinctive token", draft.chunks[0]?.body.includes(STAGE_4F_D_TOKEN_PAGE1) === true);
assert("page 2 body has replacement token", draft.chunks[1]?.body.includes(STAGE_4F_D_TOKEN_PAGE2) === true);
assert(
  "13 citation label for page 2",
  documentChunkCitationLabel(STAGE_4F_D_FILENAME, "page-0002", 0) ===
    `${STAGE_4F_D_FILENAME} · page-0002`,
);

const pack = assembleAskEvidencePack({
  project: {
    id: PROJECT,
    company_id: COMPANY,
    name: "4F-D",
    client_name: null,
    address: null,
    status: "active",
    start_date: null,
    target_completion_date: null,
    description: null,
  },
  tasks: [],
  fieldLogs: [],
  documents: [],
  documentChunks: [
    documentChunkEvidenceItem(
      PROJECT,
      {
        company_id: COMPANY,
        project_id: PROJECT,
        document_id: DOC,
        extraction_id: "44444444-4444-4444-8444-444444444444",
        chunk_id: "55555555-5555-4555-8555-555555555555",
        source_sha256: draft.source_sha256,
        content_kind: "pdf_text",
        locator: "page-0002",
        locator_type: "page",
        part_index: 0,
        source_issued_on: null,
        source_effective_on: null,
        body: draft.chunks[1].body,
      },
      STAGE_4F_D_FILENAME,
    ),
  ],
});
const cited = validateProposedCitations(
  [{ type: "document_chunk", id: "55555555-5555-4555-8555-555555555555" }],
  pack.allowlist,
);
assert("12 allowlist accepts retrieved PDF chunk", cited.length === 1);
assert(
  "12 fabricated chunk citation is stripped",
  validateProposedCitations(
    [{ type: "document_chunk", id: "99999999-9999-4999-8999-999999999999" }],
    pack.allowlist,
  ).length === 0,
);

const promptBytes = stage4fDPromptLikePdf();
const promptDraft = await extractPdfDocument({
  parent: parentFor(promptBytes),
  bytes: promptBytes,
  parser: "timeout-child",
});
assert(
  "14 prompt-like PDF is extracted as DATA",
  promptDraft.extracted_text.includes("Ignore previous instructions") &&
    promptDraft.extracted_text.includes(STAGE_4F_D_PROMPT_TOKEN) &&
    !promptDraft.extracted_text.includes("You are Ask SITEPM"),
);
assert("14 system prompt is not the PDF body", !promptDraft.extracted_text.includes(ASK_SYSTEM_PROMPT.slice(0, 40)));

try {
  await extractPdfDocument({
    parent: parentFor(buildImageOnlyPdf()),
    bytes: buildImageOnlyPdf(),
    parser: "timeout-child",
  });
  failed += 1;
  console.error("FAIL 15 textless PDF produced a draft");
} catch (error) {
  assert(
    "15 textless PDF produces no draft",
    error instanceof PdfTextExtractError && error.code === "no_usable_text",
  );
}

try {
  await extractPdfDocument({
    parent: parentFor(buildMalformedPdf()),
    bytes: buildMalformedPdf(),
    parser: "timeout-child",
  });
  failed += 1;
  console.error("FAIL 16 malformed PDF produced a draft");
} catch (error) {
  assert("16 malformed PDF produces no draft", error instanceof PdfTextExtractError);
}

try {
  await extractPdfDocument({
    parent: parentFor(buildEncryptedPdf()),
    bytes: buildEncryptedPdf(),
    parser: "timeout-child",
  });
  failed += 1;
  console.error("FAIL 16 encrypted PDF produced a draft");
} catch (error) {
  assert(
    "16 encrypted PDF produces no draft",
    error instanceof PdfTextExtractError &&
      error.code === "encrypted_or_password_protected",
  );
}

process.env.SITEPM_EXTRACTOR_DATABASE_URL =
  "postgresql://sitepm_extractor:secret@localhost/postgres";
process.env.OPENAI_API_KEY = "sk-test";
process.env.SUPABASE_ANON_KEY = "anon-test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
process.env.DATABASE_URL = "postgresql://postgres:secret@localhost/postgres";
const childEnv = pdfParserChildEnv();
assert("18 child env has only option key", Object.keys(childEnv).length === 1);
assert("18 child omits extractor URI", !("SITEPM_EXTRACTOR_DATABASE_URL" in childEnv));

const probe = await new Promise<{ sentinelPresent: Record<string, boolean> }>(
  (resolve, reject) => {
    const child = spawn(
      process.execPath,
      [join(process.cwd(), "scripts/pdf-text-extract-env-probe.mjs")],
      { stdio: ["ignore", "pipe", "pipe"], env: childEnv as NodeJS.ProcessEnv },
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
  },
);
assert(
  "18 spawned child has no application secrets",
  probe.sentinelPresent.OPENAI_API_KEY === false &&
    probe.sentinelPresent.SUPABASE_ANON_KEY === false &&
    probe.sentinelPresent.SUPABASE_SERVICE_ROLE_KEY === false &&
    probe.sentinelPresent.SITEPM_EXTRACTOR_DATABASE_URL === false &&
    probe.sentinelPresent.DATABASE_URL === false,
);
assert("18 option env is the allowlisted key", PDF_PARSER_CHILD_OPTION_ENV === "SITEPM_PDF_EXTRACT_OPTIONS");

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4f-d-unit: ok");
