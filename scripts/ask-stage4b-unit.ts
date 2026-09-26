import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MARKDOWN_CHUNK_CHAR_CAP,
  SITEPM_MARKDOWN_EXTRACTOR_NAME,
  SITEPM_MARKDOWN_EXTRACTOR_VERSION,
  extractMarkdownDocument,
  sha256Hex,
  type ReadyDocumentIdentity,
} from "@/lib/document-extract";
import {
  RP001_EVALUATOR_FILES,
  RP001_ROOT,
  assertEligibleRp001SourcePath,
  extractRp001Corpus,
  listEligibleRp001SourceFiles,
} from "@/lib/rp001-corpus";

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

function parentFor(bytes: Buffer, overrides: Partial<ReadyDocumentIdentity> = {}): ReadyDocumentIdentity {
  return {
    id: DOC,
    company_id: COMPANY,
    project_id: PROJECT,
    sha256: sha256Hex(bytes),
    status: "ready",
    ...overrides,
  };
}

const brief = readFileSync(join(RP001_ROOT, "sources/01-project-brief.md"));
const budget = readFileSync(join(RP001_ROOT, "sources/08-schedule-budget.md"));
const photos = readFileSync(join(RP001_ROOT, "sources/10-photo-manifest.md"));

const briefDraft = extractMarkdownDocument({
  parent: parentFor(brief),
  bytes: brief,
  sourceIssuedOn: "2027-01-08",
});
assert("brief extracts UTF-8 markdown", briefDraft.extracted_text.includes("Larkglass House"));
assert("brief locators S1 S2 S3", briefDraft.chunks.map((c) => c.locator).join(",") === "S1,S2,S3");
assert("heading retained in chunk body", briefDraft.chunks[0].body.startsWith("## S1 —"));
assert(
  "brief sha matches register identity",
  briefDraft.source_sha256 ===
    "b1dd1ade2c4e16fc7e363062925c47d95192da4d712a3fa4a6aceca2891f242a",
);

let changedHashThrew = false;
try {
  const mutated = Buffer.concat([brief, Buffer.from("\n")]);
  extractMarkdownDocument({
    parent: parentFor(brief),
    bytes: mutated,
    expectedSha256: briefDraft.source_sha256,
  });
} catch (error) {
  changedHashThrew = error instanceof Error && /expected source identity hash|must match the parent/.test(error.message);
}
assert("changed bytes cannot reuse old source identity", changedHashThrew);

let pendingThrew = false;
try {
  extractMarkdownDocument({
    parent: parentFor(brief, { status: "pending" }),
    bytes: brief,
  });
} catch (error) {
  pendingThrew = error instanceof Error && /must be ready/.test(error.message);
}
assert("non-ready parent cannot receive derived evidence", pendingThrew);

const budgetDraft = extractMarkdownDocument({
  parent: parentFor(budget),
  bytes: budget,
  sourceIssuedOn: "2027-03-10",
});
const costChunk = budgetDraft.chunks.find((chunk) => chunk.locator === "S1");
assert("budget table stays in one S1 chunk", Boolean(costChunk?.body.includes("| Hydronics RP001-SC-014 | 84000 | 4800 | 88800 |")));
assert("budget S1 not split", budgetDraft.chunks.filter((c) => c.locator === "S1").length === 1);

const photoDraft = extractMarkdownDocument({
  parent: parentFor(photos),
  bytes: photos,
  sourceIssuedOn: "2027-04-22",
});
assert(
  "photo locators are captions",
  photoDraft.chunks.every((chunk) => chunk.locator_type === "caption"),
);
assert(
  "photo chunks are text captions not images",
  photoDraft.chunks.every(
    (chunk) =>
      chunk.body.includes("Caption") || chunk.body.includes("caption") || chunk.body.includes("Binary"),
  ) && photoDraft.chunks.every((chunk) => !chunk.body.includes("\u0000")),
);

const longHeading = "## S9 — Oversized\n\n";
const longBody = `${longHeading}${"alpha paragraph\n\n".repeat(800)}| keep | table |\n| --- | --- |\n| 1 | 2 |\n`;
const longBytes = Buffer.from(longBody, "utf8");
const longDraft = extractMarkdownDocument({
  parent: parentFor(longBytes),
  bytes: longBytes,
});
assert(
  "oversized section keeps locator and uses part_index",
  longDraft.chunks.every((chunk) => chunk.locator === "S9") &&
    longDraft.chunks.length > 1 &&
    longDraft.chunks[0].part_index === 0 &&
    longDraft.chunks[1].part_index === 1 &&
    longDraft.chunks.every((chunk) => chunk.body.length <= MARKDOWN_CHUNK_CHAR_CAP),
);

const first = extractRp001Corpus({
  documentIdFor: (sourceId) => `00000000-0000-4000-8000-${sourceId.replace(/\D/g, "").padStart(12, "0").slice(-12)}`,
  companyId: COMPANY,
  projectId: PROJECT,
});
const second = extractRp001Corpus({
  documentIdFor: (sourceId) => `00000000-0000-4000-8000-${sourceId.replace(/\D/g, "").padStart(12, "0").slice(-12)}`,
  companyId: COMPANY,
  projectId: PROJECT,
});
assert("exactly 15 RP001 source documents extracted", first.length === 15);
assert(
  "re-extraction is deterministic",
  JSON.stringify(first.map((d) => d.chunks.map((c) => [c.locator, c.part_index, c.body, c.source_sha256]))) ===
    JSON.stringify(second.map((d) => d.chunks.map((c) => [c.locator, c.part_index, c.body, c.source_sha256]))),
);
assert(
  "no duplicate locator+part per document",
  first.every((draft) => {
    const keys = draft.chunks.map((chunk) => `${chunk.locator}:${chunk.part_index}`);
    return new Set(keys).size === keys.length;
  }),
);
assert(
  "issued_on comes from fixture metadata not mtime",
  first[0].source_issued_on === "2027-01-08" &&
    first.every((draft) => Boolean(draft.source_issued_on?.match(/^\d{4}-\d{2}-\d{2}$/))),
);
assert(
  "extractor provenance recorded",
  first.every(
    (draft) =>
      draft.extractor_name === SITEPM_MARKDOWN_EXTRACTOR_NAME &&
      draft.extractor_version === SITEPM_MARKDOWN_EXTRACTOR_VERSION &&
      draft.content_kind === "markdown" &&
      draft.chunks.every((chunk) => chunk.content_kind === "markdown"),
  ),
);

const files = listEligibleRp001SourceFiles();
assert("eligible corpus is 15 markdown files", files.length === 15);

let denied = 0;
for (const name of RP001_EVALUATOR_FILES) {
  try {
    assertEligibleRp001SourcePath(join(RP001_ROOT, name), RP001_ROOT);
  } catch {
    denied += 1;
  }
}
assert("evaluator files are rejected", denied === RP001_EVALUATOR_FILES.length);

assert(
  "chunks do not carry a separate company override field",
  first.every((draft) =>
    draft.chunks.every(
      (chunk) =>
        chunk.source_sha256 === draft.source_sha256 &&
        !("company_id" in chunk) &&
        !("project_id" in chunk) &&
        !("document_id" in chunk),
    ),
  ),
);

const otherProject = "99999999-9999-4999-8999-999999999999";
const retarget = extractMarkdownDocument({
  parent: parentFor(brief, { project_id: otherProject }),
  bytes: brief,
});
assert(
  "draft identity follows parent row only, never chunk-supplied project",
  retarget.project_id === otherProject &&
    retarget.document_id === DOC &&
    retarget.chunks.every((chunk) => chunk.source_sha256 === retarget.source_sha256),
);

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4b-unit: ok");
