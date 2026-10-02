import { join } from "node:path";
import {
  DOCUMENT_CHUNK_RETRIEVAL_CAP,
  chunkPassesAsOf,
  flattenExtractionDraftsToHits,
  hitIdentityList,
  normalizeRetrievalQuery,
  searchExtractedChunksOffline,
} from "@/lib/document-chunk-retrieval";
import {
  RP001_EVALUATOR_FILES,
  RP001_ROOT,
  assertEligibleRp001SourcePath,
  extractRp001Corpus,
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
const OTHER_COMPANY = "aaaaaaaa-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const OTHER_PROJECT = "99999999-9999-4999-8999-999999999999";

function documentIdFor(sourceId: string) {
  return `00000000-0000-4000-8000-${sourceId.replace(/\D/g, "").padStart(12, "0").slice(-12)}`;
}

const drafts = extractRp001Corpus({
  documentIdFor,
  companyId: COMPANY,
  projectId: PROJECT,
});
const hits = flattenExtractionDraftsToHits(drafts);
const d14 = documentIdFor("RP001-D14");
const d15 = documentIdFor("RP001-D15");
const d13 = documentIdFor("RP001-D13");

assert("empty query returns no hits", searchExtractedChunksOffline({
  hits,
  companyId: COMPANY,
  projectId: PROJECT,
  query: "   ",
}).length === 0);
assert("unparseable tokens return no hits", searchExtractedChunksOffline({
  hits,
  companyId: COMPANY,
  projectId: PROJECT,
  query: "!!",
}).length === 0);
assert(
  "unsupported query returns no hits",
  searchExtractedChunksOffline({
    hits,
    companyId: COMPANY,
    projectId: PROJECT,
    query: "fnordxyz123notasitepmterm",
  }).length === 0,
);

const manifold = searchExtractedChunksOffline({
  hits,
  companyId: COMPANY,
  projectId: PROJECT,
  query: "RH-02 manifold",
});
assert("RH-02 manifold retrieves at least one chunk", manifold.length > 0);
assert(
  "RH-02 hits include as-built or field locators",
  manifold.some(
    (hit) =>
      hit.document_id === d13 && hit.locator === "S1" ||
      hit.body.includes("RH-02"),
  ),
);
assert(
  "hits preserve provenance identity",
  manifold.every(
    (hit) =>
      Boolean(hit.company_id) &&
      Boolean(hit.project_id) &&
      Boolean(hit.document_id) &&
      Boolean(hit.extraction_id) &&
      Boolean(hit.chunk_id) &&
      Boolean(hit.source_sha256) &&
      Boolean(hit.content_kind) &&
      Boolean(hit.locator) &&
      Boolean(hit.locator_type) &&
      typeof hit.part_index === "number" &&
      typeof hit.body === "string",
  ),
);
assert(
  "chunk body is passed through as data",
  manifold.every((hit) => hit.body.includes("##")),
);

const again = searchExtractedChunksOffline({
  hits,
  companyId: COMPANY,
  projectId: PROJECT,
  query: "RH-02 manifold",
});
assert(
  "repeated query is deterministic",
  JSON.stringify(hitIdentityList(manifold)) === JSON.stringify(hitIdentityList(again)),
);

const actuators = searchExtractedChunksOffline({
  hits,
  companyId: COMPANY,
  projectId: PROJECT,
  query: "actuator",
});
const d15Hits = actuators.filter((hit) => hit.document_id === d15);
assert(
  "conflicting D15 technician and recollection chunks both remain",
  d15Hits.some((hit) => hit.locator === "S1" && hit.body.includes("sticking")) &&
    d15Hits.some((hit) => hit.locator === "S3" && hit.body.includes("both living-room actuators")),
);
assert(
  "conflicts are not merged into one synthetic body",
  d15Hits.filter((hit) => hit.locator === "S1" || hit.locator === "S3").length >= 2,
);

const beforeD15 = searchExtractedChunksOffline({
  hits,
  companyId: COMPANY,
  projectId: PROJECT,
  query: "NT-A24R",
  asOf: "2029-11-08",
});
const afterD15 = searchExtractedChunksOffline({
  hits,
  companyId: COMPANY,
  projectId: PROJECT,
  query: "NT-A24R",
  asOf: "2030-01-15",
});
assert("as-of before D15 does not expose NT-A24R / D15 text", beforeD15.length === 0);
assert(
  "as-of on D15 issued date can retrieve D15 NT-A24R",
  afterD15.some((hit) => hit.document_id === d15 && hit.body.includes("NT-A24R")),
);

const westAsOf = searchExtractedChunksOffline({
  hits,
  companyId: COMPANY,
  projectId: PROJECT,
  query: "west loop",
  asOf: "2029-11-08",
});
assert(
  "D14 remains retrievable at Q14 as-of",
  westAsOf.some((hit) => hit.document_id === d14),
);
assert(
  "Q14 as-of hits do not include D15 bodies",
  westAsOf.every(
    (hit) =>
      hit.document_id !== d15 &&
      !hit.body.includes("NT-A24R") &&
      !hit.body.includes("both living-room actuators"),
  ),
);
assert(
  "as-of helper matches SQL inequality",
  chunkPassesAsOf("2029-11-08", "2029-11-08") &&
    !chunkPassesAsOf("2030-01-15", "2029-11-08") &&
    chunkPassesAsOf(null, "2029-11-08"),
);

assert(
  "other company chunks are not retrieved",
  searchExtractedChunksOffline({
    hits: hits.map((hit) => ({ ...hit, company_id: OTHER_COMPANY })),
    companyId: COMPANY,
    projectId: PROJECT,
    query: "RH-02",
  }).length === 0,
);
assert(
  "other project chunks are not retrieved",
  searchExtractedChunksOffline({
    hits: hits.map((hit) => ({ ...hit, project_id: OTHER_PROJECT })),
    companyId: COMPANY,
    projectId: PROJECT,
    query: "RH-02",
  }).length === 0,
);

assert(
  "result cap is bounded",
  searchExtractedChunksOffline({
    hits,
    companyId: COMPANY,
    projectId: PROJECT,
    query: "RP001",
    cap: 99,
  }).length <= DOCUMENT_CHUNK_RETRIEVAL_CAP,
);

let denied = 0;
for (const name of RP001_EVALUATOR_FILES) {
  try {
    assertEligibleRp001SourcePath(join(RP001_ROOT, name), RP001_ROOT);
  } catch {
    denied += 1;
  }
}
assert("evaluator files are rejected from corpus", denied === RP001_EVALUATOR_FILES.length);
assert(
  "retrieved bodies are not ground-truth JSON answers",
  manifold.every((hit) => !hit.body.includes("expected_answer")),
);
assert("normalize trims query", normalizeRetrievalQuery("  RH-02  ") === "RH-02");

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4c-unit: ok");
