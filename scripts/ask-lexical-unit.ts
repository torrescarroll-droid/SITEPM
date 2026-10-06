/**
 * Slice 1 — real-question retrieval.
 * Fixture reproduces the User Zero 2-page PDF: the requirement is on page 1,
 * and page 2 repeats the shower question without the flood-test sentence.
 */

import { ASK_SYSTEM_PROMPT } from "@/lib/ai/provider";
import {
  ASK_CHUNK_MODEL_CAP,
  budgetDocumentChunkHits,
  documentChunkEvidenceItem,
} from "@/lib/ask-evidence";
import { parseGroundedModelOutput } from "@/lib/ask-grounding";
import {
  ASK_LEXICAL_MAX_SEARCHES,
  decomposeAskLexicalQueries,
  searchDocumentChunksForAskQuestion,
  unionAskChunkHits,
  type AskChunkSearch,
} from "@/lib/ask-lexical-query";
import type { DocumentChunkHit } from "@/lib/document-intelligence-types";

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
const PROJECT_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const COMPANY_B = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const DOC_A = "99999999-aaaa-4bbb-8ccc-dddddddddddd";
const PAGE_1 = "11111111-1111-4111-8111-111111111111";
const PAGE_2 = "22222222-2222-4222-8222-222222222222";

const PAGE_1_BODY = [
  "The primary shower is to receive a linear drain at the west wall.",
  "Shower waterproofing shall be completed and flood-tested for 24 hours before tile installation.",
  "The kitchen island is 108 inches long by 42 inches wide.",
  "MEP rough-in inspection: October 30, 2026.",
].join("\n");

const PAGE_2_BODY =
  "What must happen before tile installation in the primary shower?";

const SHOWER_QUESTION =
  "What must happen before tile installation in the primary shower?";
const KITCHEN_QUESTION = "What are the dimensions of the kitchen island?";
const MEP_QUESTION = "When is the MEP rough-in inspection?";
const REFRIGERATOR_QUESTION =
  "What brand and model is the kitchen refrigerator?";

function hit(
  chunkId: string,
  projectId: string,
  companyId: string,
  locator: string,
  body: string,
): DocumentChunkHit {
  return {
    company_id: companyId,
    project_id: projectId,
    document_id: DOC_A,
    extraction_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    chunk_id: chunkId,
    source_sha256: "abc123",
    content_kind: "pdf_text",
    locator,
    locator_type: "page",
    part_index: 0,
    source_issued_on: null,
    source_effective_on: null,
    body,
  };
}

const page1 = hit(PAGE_1, PROJECT_A, COMPANY_A, "page-0001", PAGE_1_BODY);
const page2 = hit(PAGE_2, PROJECT_A, COMPANY_A, "page-0002", PAGE_2_BODY);
const foreign = hit(
  "33333333-3333-4333-8333-333333333333",
  PROJECT_B,
  COMPANY_B,
  "page-0001",
  PAGE_1_BODY,
);

function queryTokens(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

/** Stand-in for plainto_tsquery AND: every search token must occur in the body. */
function lexicalAndMatch(body: string, query: string) {
  const haystack = body.toLowerCase();
  const tokens = queryTokens(query);
  return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
}

function rankedMatches(query: string, candidates: DocumentChunkHit[]) {
  return candidates
    .filter((candidate) => lexicalAndMatch(candidate.body, query))
    .sort((a, b) => a.body.length - b.body.length || (a.chunk_id < b.chunk_id ? -1 : 1));
}

function fixtureSearch(candidates: DocumentChunkHit[]): AskChunkSearch {
  return async (input) => {
    return rankedMatches(
      input.query,
      candidates.filter((candidate) => candidate.project_id === input.projectId),
    );
  };
}

async function retrieve(question: string, candidates = [page1, page2]) {
  return searchDocumentChunksForAskQuestion(
    { projectId: PROJECT_A, question, asOf: null },
    fixtureSearch(candidates),
  );
}

function packed(hits: DocumentChunkHit[]) {
  return budgetDocumentChunkHits(hits, ASK_CHUNK_MODEL_CAP);
}

const showerQueries = decomposeAskLexicalQueries(SHOWER_QUESTION);
assert(
  "shower decomposition drops happen",
  showerQueries.length > 0 &&
    showerQueries.every((item) => !item.query.includes("happen") && !item.query.includes("must")),
);
assert(
  "shower searches include tile installation and primary shower",
  showerQueries.some((item) => item.query === "tile installation") &&
    showerQueries.some((item) => item.query === "primary shower"),
);
assert(
  "shower search count is bounded",
  showerQueries.length <= ASK_LEXICAL_MAX_SEARCHES,
);

const fullQuestionAnd = rankedMatches(
  "must happen tile installation primary shower",
  [page1, page2],
);
assert(
  "whole-question AND still misses the waterproofing page",
  fullQuestionAnd.length === 1 && fullQuestionAnd[0]?.chunk_id === PAGE_2,
);

const shower = await retrieve(SHOWER_QUESTION);
const showerPacked = packed(shower.hits ?? []);
const showerAnswer = showerPacked.find((item) => item.chunk_id === PAGE_1);
assert("shower retrieval returns hits", shower.hits !== null);
assert(
  "shower answer page enters the evidence budget",
  Boolean(showerAnswer) &&
    showerAnswer?.body.includes("flood-tested for 24 hours") &&
    showerAnswer.body.includes("before tile installation") &&
    showerAnswer.body.toLowerCase().includes("waterproofing"),
);
assert(
  "shower result is not only the question echo",
  showerPacked.some((item) => item.chunk_id === PAGE_1) &&
    showerPacked.some((item) => item.body.includes("flood-tested")),
);
assert("shower provenance is page-0001", showerAnswer?.locator === "page-0001");
assert(
  "shower trace lists each search and the union",
  shower.trace.queries.length === shower.trace.perQuery.length &&
    shower.trace.unionChunkIds.includes(PAGE_1),
);

const showerEvidence = documentChunkEvidenceItem(PROJECT_A, showerAnswer!, "scope.pdf");
assert(
  "shower citation label keeps the page",
  showerEvidence.label === "scope.pdf · page-0001" &&
    showerEvidence.data.body.includes("flood-tested for 24 hours"),
);

const kitchen = await retrieve(KITCHEN_QUESTION);
const kitchenHit = packed(kitchen.hits ?? []).find((item) =>
  item.body.includes("108 inches long by 42 inches wide"),
);
assert("kitchen dimensions remain retrievable", kitchenHit?.locator === "page-0001");

const mep = await retrieve(MEP_QUESTION);
const mepHit = packed(mep.hits ?? []).find((item) =>
  item.body.includes("October 30, 2026"),
);
assert("MEP inspection date remains retrievable", mepHit?.locator === "page-0001");

const refrigerator = await retrieve(REFRIGERATOR_QUESTION);
assert(
  "refrigerator question retrieves no brand evidence",
  (refrigerator.hits ?? []).length === 0 &&
    refrigerator.trace.unionChunkIds.length === 0,
);
assert(
  "system prompt still forbids filling gaps from general knowledge",
  ASK_SYSTEM_PROMPT.includes(
    "Do not fill project-specific gaps from general or training knowledge.",
  ) && ASK_SYSTEM_PROMPT.includes("insufficientEvidence"),
);

const refused = parseGroundedModelOutput(
  {
    answer: "The project records do not name a refrigerator brand or model.",
    insufficientEvidence: true,
    epistemicKind: "insufficient_evidence",
    citations: [{ type: "document_chunk", id: "ffffffff-ffff-4fff-8fff-ffffffffffff" }],
  },
  {
    projectId: PROJECT_A,
    evidence: [],
    allowlist: [],
  },
);
assert(
  "invented refrigerator citation is not allowlisted",
  refused.insufficientEvidence === true && refused.citations.length === 0,
);

const echoed = unionAskChunkHits([
  { query: "tile installation", hits: [page2, page1] },
  { query: "tile installation", hits: [page2, page1] },
  { query: "primary shower", hits: [page1, page2] },
]);
assert(
  "duplicate search hits use one evidence slot",
  echoed.hits.filter((item) => item.chunk_id === PAGE_1).length === 1 &&
    echoed.hits.filter((item) => item.chunk_id === PAGE_2).length === 1,
);
assert(
  "answer page remains in the union when the echo also matches",
  echoed.unionChunkIds.includes(PAGE_1),
);

assert("empty question yields no searches", decomposeAskLexicalQueries("   ").length === 0);
assert("punctuation-only question yields no searches", decomposeAskLexicalQueries("???").length === 0);
const longQuestion = Array.from({ length: 40 }, (_, index) => `term${index}`).join(" ");
assert(
  "long question stays within the search cap",
  decomposeAskLexicalQueries(longQuestion).length <= ASK_LEXICAL_MAX_SEARCHES &&
    decomposeAskLexicalQueries(longQuestion).length > 0,
);

let calls = 0;
const unauthorized = await searchDocumentChunksForAskQuestion(
  { projectId: PROJECT_B, question: SHOWER_QUESTION },
  async () => {
    calls += 1;
    return null;
  },
);
assert(
  "unauthorized project stops retrieval",
  unauthorized.hits === null && calls === 1,
);

let threw = false;
try {
  await searchDocumentChunksForAskQuestion(
    { projectId: PROJECT_A, question: SHOWER_QUESTION },
    async () => [foreign],
  );
} catch (error) {
  threw = error instanceof Error && error.message.includes("authorized project");
}
assert("a hit for another project is rejected", threw);

if (failed > 0) {
  console.error(`ask-lexical-unit: ${failed} failed`);
  process.exit(1);
}
console.log("ask-lexical-unit: ok");
