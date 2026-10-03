import { join } from "node:path";
import {
  ASK_CHUNK_BODY_CHARS,
  ASK_CHUNK_MODEL_CAP,
  ASK_CHUNK_TRUNCATION_MARKER,
  assembleAskEvidencePack,
  budgetDocumentChunkHits,
  documentChunkEvidenceItem,
  inventoryFromPack,
  truncateAskChunkBody,
} from "@/lib/ask-evidence";
import { modelEvidencePayload, parseGroundedModelOutput, validateModelCitations } from "@/lib/ask-grounding";
import {
  assertAuthorizedDocumentChunkHits,
  retrieveAskProjectEvidence,
} from "@/lib/ask-retrieval";
import type { DocumentChunkHit } from "@/lib/document-intelligence-types";
import type { DocumentRecord } from "@/lib/document-types";
import type { FieldLogRecord } from "@/lib/field-log-types";
import type { TaskRecord } from "@/lib/task-types";
import {
  RP001_EVALUATOR_FILES,
  RP001_ROOT,
  assertEligibleRp001SourcePath,
  extractRp001Corpus,
} from "@/lib/rp001-corpus";
import {
  flattenExtractionDraftsToHits,
  searchExtractedChunksOffline,
} from "@/lib/document-chunk-retrieval";

let failed = 0;
function assert(name: string, condition: boolean) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`PASS ${name}`);
}

const PROJECT_A = "3fb9aa08-44ae-49bb-80f3-2809b8cb5f4f";
const COMPANY_A = "b3899021-1203-47b7-8475-4c525bf9d4af";
const TASK_A = "11111111-2222-4333-8444-555555555555";
const DOC_A = "99999999-aaaa-4bbb-8ccc-dddddddddddd";
const CHUNK_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHUNK_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FAKE_CHUNK = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const projectA = {
  id: PROJECT_A,
  company_id: COMPANY_A,
  name: "184 Maple Isolation Job",
  client_name: "Test Client",
  address: "184 Maple",
  status: "active" as const,
  start_date: "2026-09-01",
  target_completion_date: "2026-12-01",
  description: "Isolation fixture project",
};

const task: TaskRecord = {
  id: TASK_A,
  company_id: COMPANY_A,
  project_id: PROJECT_A,
  title: "Pull permits",
  description: "City hall",
  assigned_to: null,
  due_date: "2026-09-01",
  priority: "high",
  status: "open",
  ai_suggested: false,
  created_at: "2026-09-01T00:00:00Z",
  completed_at: null,
};

const log: FieldLogRecord = {
  id: "66666666-7777-4888-8999-000000000000",
  company_id: COMPANY_A,
  project_id: PROJECT_A,
  log_date: "2026-09-19",
  notes: "Poured footings",
  issue_flag: false,
  created_at: "2026-09-19T00:00:00Z",
  created_by: null,
  created_by_name: "Alex",
};

const readyDoc: DocumentRecord = {
  id: DOC_A,
  company_id: COMPANY_A,
  project_id: PROJECT_A,
  filename: "hydronics.md",
  storage_path: "must-not-appear",
  document_type: "other",
  uploaded_by: null,
  uploaded_by_name: null,
  created_at: "2026-09-19T00:00:00Z",
  content_type: "text/markdown",
  byte_size: 1024,
  sha256: "abc",
  status: "ready",
};

function hit(overrides: Partial<DocumentChunkHit> & Pick<DocumentChunkHit, "chunk_id" | "locator" | "body">): DocumentChunkHit {
  return {
    company_id: COMPANY_A,
    project_id: PROJECT_A,
    document_id: DOC_A,
    extraction_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    source_sha256: "a".repeat(64),
    content_kind: "markdown",
    locator_type: "section",
    part_index: 0,
    source_issued_on: "2027-01-08",
    source_effective_on: null,
    ...overrides,
  };
}

const chunkA = hit({
  chunk_id: CHUNK_A,
  locator: "S1",
  body: "## S1 — Technician\nActuator sticking on port 3 only.",
});
const chunkB = hit({
  chunk_id: CHUNK_B,
  locator: "S3",
  body: "## S3 — Recollection\nOwner said both living-room actuators were changed.",
  source_issued_on: "2030-01-15",
});

const chunkItems = [
  documentChunkEvidenceItem(PROJECT_A, chunkA, readyDoc.filename),
  documentChunkEvidenceItem(PROJECT_A, chunkB, readyDoc.filename),
];
const pack = assembleAskEvidencePack({
  project: projectA,
  tasks: [task],
  fieldLogs: [log],
  documents: [readyDoc],
  documentChunks: chunkItems,
});

assert(
  "chunk provenance retained",
  pack.evidence.some(
    (item) =>
      item.sourceType === "document_chunk" &&
      item.sourceId === CHUNK_A &&
      item.data.locator === "S1" &&
      item.data.source_sha256 === chunkA.source_sha256 &&
      item.data.content_kind === "markdown" &&
      item.data.body === chunkA.body,
  ),
);
assert(
  "citation label is application-controlled",
  pack.evidence.some(
    (item) =>
      item.sourceType === "document_chunk" &&
      item.label === "hydronics.md · S1",
  ),
);

const payload = modelEvidencePayload(pack);
assert(
  "company_id is not model-visible",
  payload.every((item) => !("company_id" in item) && !("company_id" in item.data)),
);
assert(
  "storage_path is not model-visible",
  payload.every((item) => !("storage_path" in item.data)),
);

const valid = validateModelCitations(
  [{ type: "document_chunk", id: CHUNK_A }],
  pack,
);
assert("valid retrieved chunk citation survives", valid.length === 1 && valid[0].id === CHUNK_A && valid[0].label === "hydronics.md · S1");

const fabricated = validateModelCitations(
  [{ type: "document_chunk", id: FAKE_CHUNK }],
  pack,
);
assert("fabricated chunk UUID is removed", fabricated.length === 0);

const typeConfused = validateModelCitations(
  [{ type: "document_chunk", id: TASK_A }],
  pack,
);
assert(
  "task UUID cited as document_chunk is removed",
  typeConfused.length === 0 &&
    pack.allowlist.includes("task:" + TASK_A) &&
    !pack.allowlist.includes("document_chunk:" + TASK_A),
);

const notRetrieved = validateModelCitations(
  [{ type: "document_chunk", id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }],
  pack,
);
assert("valid UUID for a non-retrieved chunk is removed", notRetrieved.length === 0);

const hijack = validateModelCitations(
  [
    {
      type: "document_chunk",
      id: CHUNK_A,
      filename: "evil.pdf",
      locator: "Z9",
      page: 99,
      label: "forged",
    },
  ],
  pack,
);
assert(
  "model filename/locator/page cannot override application metadata",
  hijack.length === 1 &&
    hijack[0].label === "hydronics.md · S1" &&
    hijack[0].page === undefined,
);

assert(
  "conflicting chunks coexist",
  pack.evidence.filter((item) => item.sourceType === "document_chunk").length === 2 &&
    pack.allowlist.includes("document_chunk:" + CHUNK_A) &&
    pack.allowlist.includes("document_chunk:" + CHUNK_B),
);

const both = validateModelCitations(
  [
    { type: "document_chunk", id: CHUNK_A },
    { type: "document_chunk", id: CHUNK_B },
  ],
  pack,
);
assert("both conflicting chunks may be cited", both.length === 2);

const many = Array.from({ length: 25 }, (_, index) =>
  hit({
    chunk_id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    locator: "S1",
    body: `chunk ${index}`,
    part_index: index,
  }),
);
const budgeted = budgetDocumentChunkHits(many);
assert("25 retrieved become first 8 model-visible", budgeted.length === ASK_CHUNK_MODEL_CAP);
assert(
  "chunk ordering preserved",
  budgeted.every((item, index) => item.body === `chunk ${index}`),
);

const longBody = "a".repeat(ASK_CHUNK_BODY_CHARS + 40);
const truncated = truncateAskChunkBody(longBody);
assert(
  "deterministic body truncation",
  truncated.endsWith(ASK_CHUNK_TRUNCATION_MARKER) &&
    truncated.length === ASK_CHUNK_BODY_CHARS &&
    truncateAskChunkBody(longBody) === truncated,
);

const emptyChunks = assembleAskEvidencePack({
  project: projectA,
  tasks: [task],
  fieldLogs: [log],
  documents: [readyDoc],
});
assert(
  "empty chunks still include Stage 2 evidence",
  emptyChunks.evidence.some((item) => item.sourceType === "task") &&
    emptyChunks.evidence.some((item) => item.sourceType === "document") &&
    !emptyChunks.evidence.some((item) => item.sourceType === "document_chunk"),
);
assert("inventory counts zero chunks", inventoryFromPack(emptyChunks).documentChunks === 0);

const stage3Citation = validateModelCitations([{ type: "task", id: TASK_A }], pack);
assert("existing Stage 3 citation behavior remains valid", stage3Citation.length === 1);

const unknown = parseGroundedModelOutput(
  {
    answer: "The supplied project evidence does not establish that fact.",
    insufficientEvidence: true,
    epistemicKind: "documented_fact",
    citations: [],
  },
  emptyChunks,
);
assert(
  "project-specific unknown remains insufficient_evidence",
  unknown.insufficientEvidence && unknown.epistemicKind === "insufficient_evidence",
);

assert(
  "retrieveAskProjectEvidence does not accept a client chunk list",
  retrieveAskProjectEvidence.length === 1 || retrieveAskProjectEvidence.length === 2,
);

let escaped = false;
try {
  assembleAskEvidencePack({
    project: projectA,
    tasks: [task],
    fieldLogs: [log],
    documents: [readyDoc],
    documentChunks: [
      documentChunkEvidenceItem(
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        { ...chunkA, project_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
        readyDoc.filename,
      ),
    ],
  });
} catch {
  escaped = true;
}
assert("unauthorized other-project chunks cannot enter pack", escaped);

const OTHER_PROJECT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OTHER_COMPANY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let mismatchedProject = false;
try {
  assertAuthorizedDocumentChunkHits(PROJECT_A, COMPANY_A, [
    { ...chunkA, project_id: OTHER_PROJECT },
  ]);
} catch {
  mismatchedProject = true;
}
assert("mismatched chunk project_id fails closed", mismatchedProject);

let mismatchedCompany = false;
try {
  assertAuthorizedDocumentChunkHits(PROJECT_A, COMPANY_A, [
    { ...chunkA, company_id: OTHER_COMPANY },
  ]);
} catch {
  mismatchedCompany = true;
}
assert("mismatched chunk company_id fails closed", mismatchedCompany);

function documentIdFor(sourceId: string) {
  return `00000000-0000-4000-8000-${sourceId.replace(/\D/g, "").padStart(12, "0").slice(-12)}`;
}
const drafts = extractRp001Corpus({
  documentIdFor,
  companyId: COMPANY_A,
  projectId: PROJECT_A,
});
const rpHits = flattenExtractionDraftsToHits(drafts);
const actuatorHits = searchExtractedChunksOffline({
  hits: rpHits,
  companyId: COMPANY_A,
  projectId: PROJECT_A,
  query: "actuator",
});
const rpItems = budgetDocumentChunkHits(actuatorHits).map((item) =>
  documentChunkEvidenceItem(PROJECT_A, item, "rp001.md"),
);
const rpPack = assembleAskEvidencePack({
  project: projectA,
  tasks: [task],
  fieldLogs: [log],
  documents: [readyDoc],
  documentChunks: rpItems,
});
assert(
  "evaluator answers are not in the model pack",
  rpPack.evidence.every((item) => !String(item.data.body ?? "").includes("expected_answer")),
);
let denied = 0;
for (const name of RP001_EVALUATOR_FILES) {
  try {
    assertEligibleRp001SourcePath(join(RP001_ROOT, name), RP001_ROOT);
  } catch {
    denied += 1;
  }
}
assert("evaluator files never enter runtime corpus", denied === RP001_EVALUATOR_FILES.length);

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4d-unit: ok");
