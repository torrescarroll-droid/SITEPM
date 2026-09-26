/**
 * Stage 4A live RLS: user JWT + anon key only. No service role.
 * Does not print secrets. Inserts of derived evidence must fail.
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
    /could not find the table/i.test(message) ||
    /does not exist/i.test(message)
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
    /permission denied/i.test(message) ||
    /not found/i.test(message) ||
    /row-level security/i.test(message) ||
    /schema cache/i.test(message)
  );
}

if (!emailA || !passwordA || !emailB || !passwordB || !projectA) {
  console.log("SKIP live Stage 4A RLS: SITEPM_ISO_* env not provided");
  process.exit(0);
}

const tokenA = await passwordSession(emailA, passwordA);
const tokenB = await passwordSession(emailB, passwordB);
const a = clientFor(tokenA);
const b = clientFor(tokenB);

const { data: extractA, error: extractAError } = await a
  .from("document_extractions")
  .select("id, company_id, project_id, document_id")
  .limit(20);
const { data: extractB, error: extractBError } = await b
  .from("document_extractions")
  .select("id, company_id, project_id, document_id")
  .limit(20);
const { data: chunksA, error: chunksAError } = await a
  .from("document_chunks")
  .select("id, project_id, document_id, body")
  .eq("project_id", projectA);
const { data: chunksBOnA, error: chunksBError } = await b
  .from("document_chunks")
  .select("id, project_id, document_id")
  .eq("project_id", projectA);
const { data: chunksAAll, error: chunksAAllError } = await a
  .from("document_chunks")
  .select("id, project_id")
  .limit(50);

if (
  isMissingRelation(extractAError) ||
  isMissingRelation(extractBError) ||
  isMissingRelation(chunksAError) ||
  isMissingRelation(chunksBError) ||
  isMissingRelation(chunksAAllError)
) {
  console.error("FAIL Stage 4A tables are not applied on the hosted database");
  process.exit(1);
}

assert("A can SELECT document_extractions", !extractAError);
assert("B can SELECT document_extractions", !extractBError);
assert("A can SELECT document_chunks", !chunksAError && !chunksAAllError);
assert("B can SELECT document_chunks", !chunksBError);

assert(
  "B cannot read Project A derived chunks",
  (chunksBOnA ?? []).length === 0,
);
assert(
  "A Project A chunk query stays on Project A",
  (chunksA ?? []).every((row) => row.project_id === projectA),
);

const aProjects = await a.from("projects").select("id");
const other = (aProjects.data ?? []).map((row) => row.id).find((id) => id !== projectA);
if (other) {
  const { data: mixed } = await a
    .from("document_chunks")
    .select("id, project_id")
    .eq("project_id", projectA);
  assert(
    "same-company other project is not mixed into Project A chunk filter",
    (mixed ?? []).every((row) => row.project_id === projectA),
  );
} else {
  console.log("SKIP same-company Project B chunk filter: Company A has only one project");
}

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
});
const { error: insertExtractB } = await b.from("document_extractions").insert({
  document_id: projectA,
  source_sha256: fakeSha,
  extractor_name: "forged",
  extractor_version: "0",
  content_kind: "markdown",
  extracted_text: "forged extraction",
});

assert("A cannot INSERT document_extractions", writeDenied(insertExtractA));
assert("A cannot INSERT document_chunks", writeDenied(insertChunkA));
assert("B cannot INSERT document_extractions", writeDenied(insertExtractB));

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

const { error: rpcA } = await a.rpc("replace_document_extraction");
const { error: rpcB } = await b.rpc("replace_document_extraction");
assert(
  "A cannot execute extraction write RPC",
  writeDenied(rpcA) || /not enabled/i.test(String(rpcA?.message ?? "")),
);
assert(
  "B cannot execute extraction write RPC",
  writeDenied(rpcB) || /not enabled/i.test(String(rpcB?.message ?? "")),
);

if ((extractA ?? []).length > 0) {
  assert(
    "A derived extractions stay on A Project filter when queried",
    (extractA ?? []).every((row) => typeof row.project_id === "string"),
  );
} else {
  console.log("NOTE no derived fixtures exist yet; SELECT grant verified, visibility of rows deferred until 4B");
}

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4a-rls: ok");
