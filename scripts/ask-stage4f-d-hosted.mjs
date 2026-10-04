/**
 * Stage 4F-D hosted end-to-end proof: product upload contract → persist → 4C → 4D.
 * SKIP when SITEPM_EXTRACTOR_DATABASE_URL or ISO/anon credentials are absent.
 * Never uses service_role. Does not print secrets.
 */
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

function applyEnvLine(line, target) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const withoutExport = trimmed.startsWith("export ")
    ? trimmed.slice(7).trim()
    : trimmed;
  const eq = withoutExport.indexOf("=");
  if (eq <= 0) return;
  const name = withoutExport.slice(0, eq).trim();
  let value = withoutExport.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (name && !target[name]) target[name] = value;
}

function envFromLocal() {
  const map = {};
  try {
    const text = readFileSync(".env.local", "utf8");
    for (const line of text.split(/\r?\n/)) applyEnvLine(line, map);
  } catch {
    return map;
  }
  return map;
}

function redact(value) {
  return String(value ?? "")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-uri]")
    .replace(/[A-Za-z0-9._%+\-]+:[^@\s]+@/g, "[redacted]@")
    .slice(0, 180);
}

const local = envFromLocal();
for (const [name, value] of Object.entries(local)) {
  if (!process.env[name]) process.env[name] = value;
}

const extractorUrl = process.env.SITEPM_EXTRACTOR_DATABASE_URL?.trim();
const emailA = process.env.SITEPM_ISO_A_EMAIL;
const passwordA = process.env.SITEPM_ISO_A_PASSWORD;
const emailB = process.env.SITEPM_ISO_B_EMAIL;
const passwordB = process.env.SITEPM_ISO_B_PASSWORD;
const projectA = process.env.SITEPM_ISO_PROJECT_A;
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!extractorUrl) {
  console.log(
    "SKIP ask-stage4f-d-hosted: SITEPM_EXTRACTOR_DATABASE_URL is absent (no service_role fallback)",
  );
  process.exit(0);
}
if (!emailA || !passwordA || !emailB || !passwordB || !projectA || !supabaseUrl || !anonKey) {
  console.log("SKIP ask-stage4f-d-hosted: SITEPM_ISO_* or SUPABASE anon env absent");
  process.exit(0);
}

function extractorRoleName(url) {
  try {
    return decodeURIComponent(new URL(url).username);
  } catch {
    return "";
  }
}

let failed = 0;
function assert(name, condition, detail) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` (${redact(detail)})` : ""}`);
    return;
  }
  console.log(`PASS ${name}`);
}

assert(
  "17 restricted login is sitepm_extractor, not service_role",
  /^sitepm_extractor(\.|$)/.test(extractorRoleName(extractorUrl)) &&
    !/service_role/i.test(extractorRoleName(extractorUrl)),
);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": root } });
const persistMod = await jiti.import("./ask-stage4f-d-hosted-deps.ts");
const {
  persistReadyPdfExtraction,
  downloadCanonicalProjectDocument,
  persistDerivedDocumentExtraction,
  extractPdfDocument,
  DerivedExtractionPersistError,
  assembleAskEvidencePack,
  documentChunkEvidenceItem,
  documentChunkCitationLabel,
  generateGroundedAnswer,
  ASK_SYSTEM_PROMPT,
  STAGE_4F_D_FILENAME,
  STAGE_4F_D_PROMPT_FILENAME,
  STAGE_4F_D_PROMPT_TOKEN,
  STAGE_4F_D_TOKEN_PAGE1,
  STAGE_4F_D_TOKEN_PAGE2,
  stage4fDDistinctivePdf,
  stage4fDPromptLikePdf,
  buildImageOnlyPdf,
  buildMalformedPdf,
  buildEncryptedPdf,
} = persistMod;

function clientFor(accessToken) {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function passwordSession(email, password) {
  const auth = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error("sign-in failed");
  return data.session.access_token;
}

async function productUploadReady(client, profile, filename, bytes) {
  const documentId = randomUUID();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storagePath = `${profile.company_id}/${projectA}/${documentId}/${filename}`;
  const insert = await client.from("documents").insert({
    id: documentId,
    company_id: profile.company_id,
    project_id: projectA,
    filename,
    storage_path: storagePath,
    document_type: "other",
    uploaded_by: profile.id,
    content_type: "application/pdf",
    byte_size: bytes.length,
    sha256,
    status: "pending",
  });
  if (insert.error) throw new Error(insert.error.message);
  const upload = await client.storage.from("project-documents").upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upload.error) {
    await client.from("documents").update({ status: "failed" }).eq("id", documentId);
    throw new Error(upload.error.message);
  }
  const ready = await client
    .from("documents")
    .update({ status: "ready" })
    .eq("id", documentId)
    .eq("status", "pending")
    .select(
      "id, company_id, project_id, filename, storage_path, document_type, uploaded_by, created_at, content_type, byte_size, sha256, status",
    )
    .maybeSingle();
  if (ready.error || !ready.data) throw new Error("document could not be marked ready");
  return ready.data;
}

async function persistAfterReady(client, document, companyId) {
  return persistReadyPdfExtraction(
    { document, callerCompanyId: companyId },
    {
      downloadCanonicalObject: (storagePath) =>
        downloadCanonicalProjectDocument(client, storagePath),
      extractPdf: extractPdfDocument,
      persistDraft: persistDerivedDocumentExtraction,
      extractorConfigured: () => true,
    },
  );
}

const tokenA = await passwordSession(emailA, passwordA);
const tokenB = await passwordSession(emailB, passwordB);
const a = clientFor(tokenA);
const b = clientFor(tokenB);
assert("1 Company A authenticates with anon + JWT", Boolean(tokenA));
assert("1 Company B authenticates with anon + JWT", Boolean(tokenB));

const { data: profile, error: profileError } = await a
  .from("profiles")
  .select("id, company_id")
  .maybeSingle();
if (profileError || !profile?.company_id) {
  console.error("BLOCKED Company A profile is not readable via JWT");
  process.exit(2);
}

const distinctive = stage4fDDistinctivePdf();
const expectedSha = createHash("sha256").update(distinctive).digest("hex");
let mainDoc;
try {
  mainDoc = await productUploadReady(a, profile, STAGE_4F_D_FILENAME, distinctive);
  assert("2 product upload contract stored the PDF", mainDoc.status === "ready");
} catch (error) {
  assert("2 product upload contract stored the PDF", false, error);
  process.exit(1);
}
assert("3 document reaches ready", mainDoc.status === "ready");
console.log("created_hosted_document=" + mainDoc.id);

const downloaded = await downloadCanonicalProjectDocument(a, mainDoc.storage_path);
assert("4 downloaded byte_size matches", downloaded.length === Number(mainDoc.byte_size));
assert(
  "4 downloaded SHA-256 matches documents.sha256",
  createHash("sha256").update(downloaded).digest("hex") === mainDoc.sha256 &&
    mainDoc.sha256 === expectedSha,
);

let persistResult;
try {
  persistResult = await persistAfterReady(a, mainDoc, profile.company_id);
  assert(
    "5 extraction persisted via timeout-child writer path",
    persistResult && "extractionId" in persistResult,
  );
} catch (error) {
  assert("5 extraction persisted via timeout-child writer path", false, error);
}

const { data: extractsA } = await a
  .from("document_extractions")
  .select("id, content_kind, source_sha256, extractor_name, document_id")
  .eq("document_id", mainDoc.id);
const { data: chunksA } = await a
  .from("document_chunks")
  .select("id, locator, locator_type, part_index, body, source_sha256, content_kind, extraction_id")
  .eq("document_id", mainDoc.id)
  .order("locator", { ascending: true });

assert("6 exactly one pdf_text extraction", (extractsA ?? []).length === 1);
assert("6 extraction is pdf_text with verified hash", extractsA?.[0]?.content_kind === "pdf_text" && extractsA?.[0]?.source_sha256 === expectedSha);
assert(
  "7 page locators",
  (chunksA ?? []).length >= 2 &&
    chunksA.every((row) => row.locator_type === "page" && /^page-\d{4,}$/.test(row.locator)) &&
    chunksA.some((row) => row.locator === "page-0001" && row.body.includes(STAGE_4F_D_TOKEN_PAGE1)) &&
    chunksA.some((row) => row.locator === "page-0002" && row.body.includes(STAGE_4F_D_TOKEN_PAGE2)),
);
assert("8 Company A JWT can read extraction", (extractsA ?? []).length === 1);
assert("8 Company A JWT can read chunks", (chunksA ?? []).length > 0);

const { data: extractB } = await b.from("document_extractions").select("id").eq("document_id", mainDoc.id);
const { data: chunksB } = await b.from("document_chunks").select("id").eq("document_id", mainDoc.id);
const chunkIds = (chunksA ?? []).map((row) => row.id);
const { data: chunksBById } = await b.from("document_chunks").select("id").in("id", chunkIds.length ? chunkIds : ["00000000-0000-4000-8000-000000000000"]);
assert("9 Company B cannot read extraction", Array.isArray(extractB) && extractB.length === 0);
assert("9 Company B cannot read chunks by document", Array.isArray(chunksB) && chunksB.length === 0);
assert("9 Company B cannot read chunks by id", Array.isArray(chunksBById) && chunksBById.length === 0);

const { data: hitsA, error: rpcA } = await a.rpc("search_project_document_chunks", {
  p_project_id: projectA,
  p_query: STAGE_4F_D_TOKEN_PAGE2,
  p_as_of: null,
  p_limit: 25,
});
const { data: hitsB, error: rpcB } = await b.rpc("search_project_document_chunks", {
  p_project_id: projectA,
  p_query: STAGE_4F_D_TOKEN_PAGE2,
  p_as_of: null,
  p_limit: 25,
});
const page2Hit = (hitsA ?? []).find(
  (row) => row.document_id === mainDoc.id && row.locator === "page-0002",
);
assert("10 Company A 4C RPC succeeded", !rpcA);
assert("10 existing 4C finds distinctive page-0002 evidence", Boolean(page2Hit));
assert(
  "10 4C hit is pdf_text page",
  page2Hit?.content_kind === "pdf_text" && page2Hit?.locator_type === "page",
);
assert("19 Company B 4C RPC succeeded or returned empty", !rpcB || Array.isArray(hitsB));
assert(
  "19 Company B 4C cannot retrieve Company A distinctive chunks",
  Array.isArray(hitsB) && !hitsB.some((row) => row.document_id === mainDoc.id),
);

const expectedLabel = documentChunkCitationLabel(STAGE_4F_D_FILENAME, "page-0002", Number(page2Hit?.part_index ?? 0));
assert("13 expected citation label", expectedLabel === `${STAGE_4F_D_FILENAME} · page-0002`);

const { data: projectRow } = await a
  .from("projects")
  .select("id, company_id, name, client_name, address, status, start_date, target_completion_date, description")
  .eq("id", projectA)
  .maybeSingle();

const openaiKey = process.env.OPENAI_API_KEY?.trim();
if (!openaiKey) {
  console.log("SKIP 11–12 live Ask: OPENAI_API_KEY absent");
  assert("13 citation label from 4C hit is application-controlled", expectedLabel.endsWith("page-0002"));
} else if (!projectRow || !page2Hit) {
  assert("11 live Ask", false, "missing project or 4C hit");
} else {
  const pack = assembleAskEvidencePack({
    project: {
      ...projectRow,
      status: projectRow.status === "on_hold" || projectRow.status === "complete" ? projectRow.status : "active",
    },
    tasks: [],
    fieldLogs: [],
    documents: [
      {
        ...mainDoc,
        uploaded_by_name: null,
        document_type: "other",
        status: "ready",
      },
    ],
    documentChunks: (hitsA ?? [])
      .filter((row) => row.document_id === mainDoc.id)
      .slice(0, 8)
      .map((row) =>
        documentChunkEvidenceItem(
          projectA,
          {
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
          },
          STAGE_4F_D_FILENAME,
        ),
      ),
  });
  try {
    const grounded = await generateGroundedAnswer({
      question: `What replacement cartridge is specified for ${STAGE_4F_D_TOKEN_PAGE1}?`,
      projectId: projectA,
      evidence: pack,
    });
    const page2Citation = (grounded.citations ?? []).find(
      (citation) => citation.type === "document_chunk" && citation.id === page2Hit.chunk_id,
    );
    assert("11 4D Ask returned an answer", Boolean(grounded.answer) && !grounded.insufficientEvidence);
    assert(
      "11 answer is grounded in distinctive PDF text",
      String(grounded.answer).toLowerCase().includes(STAGE_4F_D_TOKEN_PAGE2.toLowerCase()) ||
        String(grounded.answer).toLowerCase().includes("cartridge"),
    );
    assert("13 citation is the retrieved page-0002 chunk", Boolean(page2Citation));
    assert("13 citation label is filename · page-0002", page2Citation?.label === expectedLabel);
  } catch (error) {
    assert("11 live 4D Ask", false, error);
  }

  const emptyPack = assembleAskEvidencePack({
    project: {
      ...projectRow,
      status: projectRow.status === "on_hold" || projectRow.status === "complete" ? projectRow.status : "active",
    },
    tasks: [],
    fieldLogs: [],
    documents: [],
    documentChunks: [],
  });
  try {
    const unknown = await generateGroundedAnswer({
      question: "What is the warranty serial SITEPM4FD-ABSENT-QK91?",
      projectId: projectA,
      evidence: emptyPack,
    });
    assert(
      "12 insufficient evidence remains intact without retrieved chunks",
      unknown.insufficientEvidence === true ||
        unknown.epistemicKind === "insufficient_evidence",
    );
  } catch (error) {
    assert("12 insufficient evidence Ask", false, error);
  }
}

try {
  const promptDoc = await productUploadReady(a, profile, STAGE_4F_D_PROMPT_FILENAME, stage4fDPromptLikePdf());
  const promptPersist = await persistAfterReady(a, promptDoc, profile.company_id);
  const { data: promptChunks } = await a
    .from("document_chunks")
    .select("body")
    .eq("document_id", promptDoc.id);
  assert(
    "14 prompt-like PDF stored as DATA",
    "extractionId" in promptPersist &&
      (promptChunks ?? []).some((row) => String(row.body).includes(STAGE_4F_D_PROMPT_TOKEN)) &&
      (promptChunks ?? []).some((row) => String(row.body).includes("Ignore previous instructions")),
  );
  assert(
    "14 stored PDF text is not the Ask system prompt",
    !(promptChunks ?? []).some((row) => String(row.body).includes(ASK_SYSTEM_PROMPT.slice(0, 32))),
  );
  console.log("created_hosted_prompt_document=" + promptDoc.id);
} catch (error) {
  assert("14 prompt-like PDF stored as DATA", false, error);
}

async function expectNoEvidence(filename, bytes, name) {
  const doc = await productUploadReady(a, profile, filename, bytes);
  assert(`${name} document is ready`, doc.status === "ready");
  let persistFailed = false;
  try {
    await persistAfterReady(a, doc, profile.company_id);
  } catch (error) {
    persistFailed = error instanceof DerivedExtractionPersistError;
  }
  const { data: extracts } = await a.from("document_extractions").select("id").eq("document_id", doc.id);
  const { data: chunks } = await a.from("document_chunks").select("id").eq("document_id", doc.id);
  assert(`${name} extraction failed closed`, persistFailed);
  assert(`${name} created no extraction rows`, (extracts ?? []).length === 0);
  assert(`${name} created no chunk rows`, (chunks ?? []).length === 0);
  return doc.id;
}

await expectNoEvidence("4fd-textless-zxq719.pdf", buildImageOnlyPdf(), "15 textless");
await expectNoEvidence("4fd-malformed-zxq719.pdf", buildMalformedPdf(), "16 malformed");
await expectNoEvidence("4fd-encrypted-zxq719.pdf", buildEncryptedPdf(), "16 encrypted");

const hashDoc = await productUploadReady(a, profile, "4fd-hash-zxq719.pdf", distinctive);
try {
  await persistAfterReady(
    a,
    { ...hashDoc, sha256: "ab".repeat(32) },
    profile.company_id,
  );
  assert("16 hash mismatch rejected", false);
} catch (error) {
  assert(
    "16 hash mismatch rejected before write",
    error instanceof DerivedExtractionPersistError && error.code === "sha256_mismatch",
  );
}
const { data: hashExtracts } = await a.from("document_extractions").select("id").eq("document_id", hashDoc.id);
assert("16 hash mismatch created no evidence", (hashExtracts ?? []).length === 0);
assert("16 hash-mismatch document remains ready", hashDoc.status === "ready");
console.log("created_hosted_hash_document=" + hashDoc.id);

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4f-d-hosted: ok");
