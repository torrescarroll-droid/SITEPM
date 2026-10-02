/**
 * Stage 4C live security: user JWT + anon key only. No service role.
 * Week 9 search function may be absent until SQL Editor apply — that is not a grant.
 * Does not print secrets. Does not GRANT EXECUTE on the 4B writer.
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

function writerBodyRan(error) {
  const message = String(error?.message ?? "");
  return (
    /Extraction parent document does not exist/i.test(message) ||
    /Extraction parent document must be ready/i.test(message) ||
    /Extraction source_sha256 must match/i.test(message)
  );
}

function searchMissing(error) {
  const message = String(error?.message ?? "");
  return (
    error?.code === "PGRST202" ||
    /could not find the function/i.test(message) ||
    /schema cache/i.test(message)
  );
}

if (!emailA || !passwordA || !emailB || !passwordB || !projectA) {
  console.log("SKIP live Stage 4C RLS: SITEPM_ISO_* env not provided");
  process.exit(0);
}

const tokenA = await passwordSession(emailA, passwordA);
const tokenB = await passwordSession(emailB, passwordB);
const a = clientFor(tokenA);
const b = clientFor(tokenB);

const fakeSha = "a".repeat(64);
const { error: insertChunkA } = await a.from("document_chunks").insert({
  document_id: projectA,
  extraction_id: projectA,
  source_sha256: fakeSha,
  locator: "S1",
  locator_type: "section",
  body: "forged chunk",
  content_kind: "markdown",
});
assert("A cannot INSERT document_chunks", writeDenied(insertChunkA));

const { error: writerA } = await a.rpc("replace_ready_document_extraction", {
  p_document_id: "00000000-0000-4000-8000-000000000001",
  p_source_sha256: fakeSha,
  p_extractor_name: "sitepm.md.section",
  p_extractor_version: "4b.1",
  p_content_kind: "markdown",
  p_extracted_text: "should not persist",
  p_source_issued_on: "2027-01-08",
  p_source_effective_on: null,
  p_chunks: [],
});
assert(
  "A cannot execute 4B writer",
  Boolean(writerA) && writeDenied(writerA) && !writerBodyRan(writerA),
);

const emptyArgs = {
  p_project_id: projectA,
  p_query: "",
  p_as_of: null,
  p_limit: 25,
};
const { data: emptyA, error: emptyErr } = await a.rpc(
  "search_project_document_chunks",
  emptyArgs,
);
const { data: searchB, error: searchBErr } = await b.rpc(
  "search_project_document_chunks",
  {
    p_project_id: projectA,
    p_query: "RH-02 manifold",
    p_as_of: null,
    p_limit: 25,
  },
);
const { data: searchA, error: searchAErr } = await a.rpc(
  "search_project_document_chunks",
  {
    p_project_id: projectA,
    p_query: "RH-02 manifold",
    p_as_of: null,
    p_limit: 25,
  },
);

if (searchMissing(emptyErr) || searchMissing(searchAErr) || searchMissing(searchBErr)) {
  console.log(
    "NOTE Week 9 search_project_document_chunks is not on the hosted database yet; FTS RPC not proven live",
  );
} else {
  assert("empty query returns no rows for A", !emptyErr && Array.isArray(emptyA) && emptyA.length === 0);
  assert("A search RPC is executable after Week 9", !searchAErr && Array.isArray(searchA));
  assert(
    "B cannot retrieve Company A project chunks",
    !searchBErr && Array.isArray(searchB) && searchB.length === 0,
  );
  if ((searchA ?? []).length === 0) {
    console.log(
      "NOTE hosted document_chunks has no rows for Project A; live FTS relevance not proven",
    );
  } else {
    assert(
      "A hits stay on Project A",
      (searchA ?? []).every((row) => row.project_id === projectA),
    );
  }
}

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4c-rls: ok");
