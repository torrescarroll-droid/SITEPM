/**
 * Stage 4B live schema/security: user JWT + anon key only. No service role.
 * Confirms Week 8 writer is not executable by authenticated clients.
 * Does not print secrets. Does not GRANT EXECUTE.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function applyEnvLine(line, target) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return;
  }
  const withoutExport = trimmed.startsWith("export ")
    ? trimmed.slice(7).trim()
    : trimmed;
  const eq = withoutExport.indexOf("=");
  if (eq <= 0) {
    return;
  }
  const name = withoutExport.slice(0, eq).trim();
  let value = withoutExport.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (name && !target[name]) {
    target[name] = value;
  }
}

function envFromLocal() {
  const map = {};
  const text = readFileSync(".env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    applyEnvLine(line, map);
  }
  return map;
}

const local = envFromLocal();
const emailA = process.env.SITEPM_ISO_A_EMAIL || local.SITEPM_ISO_A_EMAIL;
const passwordA = process.env.SITEPM_ISO_A_PASSWORD || local.SITEPM_ISO_A_PASSWORD;
const emailB = process.env.SITEPM_ISO_B_EMAIL || local.SITEPM_ISO_B_EMAIL;
const passwordB = process.env.SITEPM_ISO_B_PASSWORD || local.SITEPM_ISO_B_PASSWORD;
const projectA = process.env.SITEPM_ISO_PROJECT_A || local.SITEPM_ISO_PROJECT_A;

function clientFor(accessToken) {
  const env = envFromLocal();
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function passwordSession(email, password) {
  const env = envFromLocal();
  const auth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error("sign-in failed");
  }
  return data.session.access_token;
}

let failed = 0;
function assert(name, condition) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`PASS ${name}`);
}

function isMissingRelation(error) {
  const code = error?.code;
  const message = String(error?.message ?? "");
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    /could not find the table/i.test(message)
  );
}

function writeDenied(error) {
  if (!error) {
    return false;
  }
  const code = error.code;
  const message = String(error.message ?? "");
  return (
    code === "42501" ||
    code === "PGRST301" ||
    code === "PGRST204" ||
    code === "PGRST202" ||
    /permission denied/i.test(message) ||
    /not found/i.test(message) ||
    /could not find the function/i.test(message) ||
    /row-level security/i.test(message) ||
    /schema cache/i.test(message)
  );
}

/** JWT executed the definer body. That is a security failure for Stage 4B. */
function writerBodyRan(error) {
  const message = String(error?.message ?? "");
  return (
    /Extraction parent document does not exist/i.test(message) ||
    /Extraction parent document must be ready/i.test(message) ||
    /Extraction source_sha256 must match/i.test(message) ||
    /Extraction chunks must be a JSON array/i.test(message)
  );
}

if (!emailA || !passwordA || !emailB || !passwordB || !projectA) {
  console.log("SKIP live Stage 4B RLS: SITEPM_ISO_* env not provided");
  process.exit(0);
}

const tokenA = await passwordSession(emailA, passwordA);
const tokenB = await passwordSession(emailB, passwordB);
const a = clientFor(tokenA);
const b = clientFor(tokenB);

const { count: extractCountBefore, error: countBeforeError } = await a
  .from("document_extractions")
  .select("id", { count: "exact", head: true });

const { data: chunksWithKind, error: kindError } = await a
  .from("document_chunks")
  .select("id, content_kind, locator, source_sha256")
  .limit(5);

if (isMissingRelation(kindError)) {
  console.error("FAIL Stage 4A/4B tables are not applied on the hosted database");
  process.exit(1);
}

assert(
  "document_chunks.content_kind is selectable (Week 8 column)",
  !kindError,
);
assert(
  "A can SELECT document_chunks after Week 8",
  !kindError && Array.isArray(chunksWithKind),
);

const { error: extractSelectError } = await a
  .from("document_extractions")
  .select("id, extractor_name, extractor_version, content_kind, source_sha256")
  .limit(5);
assert("A can SELECT document_extractions after Week 8", !extractSelectError);
assert("extraction count before writer probe", !countBeforeError);

const fakeSha = "a".repeat(64);
const { error: insertExtractA } = await a.from("document_extractions").insert({
  document_id: projectA,
  source_sha256: fakeSha,
  extractor_name: "forged",
  extractor_version: "0",
  content_kind: "markdown",
  extracted_text: "forged extraction",
});
const { error: insertChunkA } = await a.from("document_chunks").insert({
  document_id: projectA,
  extraction_id: projectA,
  source_sha256: fakeSha,
  locator: "S1",
  locator_type: "section",
  body: "forged chunk",
  content_kind: "markdown",
});
assert("A cannot INSERT document_extractions", writeDenied(insertExtractA));
assert("A cannot INSERT document_chunks", writeDenied(insertChunkA));

const { error: updateChunk } = await a
  .from("document_chunks")
  .update({ body: "rewritten" })
  .eq("project_id", projectA);
const { error: deleteChunk } = await a
  .from("document_chunks")
  .delete()
  .eq("project_id", projectA);
assert("A cannot UPDATE document_chunks", writeDenied(updateChunk));
assert("A cannot DELETE document_chunks", writeDenied(deleteChunk));

const { error: refusedA } = await a.rpc("replace_document_extraction");
const { error: refusedB } = await b.rpc("replace_document_extraction");
assert(
  "A cannot execute Stage 4A refused write hook",
  writeDenied(refusedA) || /not enabled/i.test(String(refusedA?.message ?? "")),
);
assert(
  "B cannot execute Stage 4A refused write hook",
  writeDenied(refusedB) || /not enabled/i.test(String(refusedB?.message ?? "")),
);

const missingDocumentId = "00000000-0000-4000-8000-000000000001";
const writerArgs = {
  p_document_id: missingDocumentId,
  p_source_sha256: fakeSha,
  p_extractor_name: "sitepm.md.section",
  p_extractor_version: "4b.1",
  p_content_kind: "markdown",
  p_extracted_text: "should not persist",
  p_source_issued_on: "2027-01-08",
  p_source_effective_on: null,
  p_chunks: [
    {
      locator: "S1",
      locator_type: "section",
      part_index: 0,
      body: "forged",
    },
  ],
};

const { data: writerDataA, error: writerA } = await a.rpc(
  "replace_ready_document_extraction",
  writerArgs,
);
const { data: writerDataB, error: writerB } = await b.rpc(
  "replace_ready_document_extraction",
  writerArgs,
);

assert("A writer RPC returned no extraction id", writerDataA == null);
assert("B writer RPC returned no extraction id", writerDataB == null);
assert(
  "A cannot execute replace_ready_document_extraction",
  Boolean(writerA) && writeDenied(writerA) && !writerBodyRan(writerA),
);
assert(
  "B cannot execute replace_ready_document_extraction",
  Boolean(writerB) && writeDenied(writerB) && !writerBodyRan(writerB),
);

const { count: extractCountAfter, error: countAfterError } = await a
  .from("document_extractions")
  .select("id", { count: "exact", head: true });
assert("extraction count after writer probe", !countAfterError);
assert(
  "JWT writer attempt did not create visible extraction rows",
  extractCountAfter === extractCountBefore,
);

if ((chunksWithKind ?? []).length === 0) {
  console.log(
    "NOTE no derived chunk fixtures exist; owner-only writer was not invoked (no service-role / table-owner session in this harness)",
  );
}

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4b-rls: ok");
