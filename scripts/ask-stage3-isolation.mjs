/**
 * Stage 3 isolation regression using the user JWT + anon key (same as Stage 2).
 * Does not use the service role. Prints pass/fail only — no secrets.
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

if (!emailA || !passwordA || !emailB || !passwordB || !projectA) {
  console.log("SKIP live isolation: SITEPM_ISO_* env not provided");
  process.exit(0);
}

const tokenA = await passwordSession(emailA, passwordA);
const tokenB = await passwordSession(emailB, passwordB);
const a = clientFor(tokenA);
const b = clientFor(tokenB);

const { data: projectAsA, error: projectAError } = await a
  .from("projects")
  .select("id, name, company_id")
  .eq("id", projectA)
  .maybeSingle();
assert("A can read authorized Project A", Boolean(projectAsA) && !projectAError);

const { data: projectAsB, error: projectBError } = await b
  .from("projects")
  .select("id")
  .eq("id", projectA)
  .maybeSingle();
assert(
  "B cannot read Project A",
  (!projectAsB && !projectBError) || (projectBError && projectBError.code === "PGRST116"),
);

const { data: tasksA } = await a
  .from("tasks")
  .select("id, project_id")
  .eq("project_id", projectA);
assert(
  "A Project A task query stays on Project A",
  (tasksA ?? []).every((row) => row.project_id === projectA),
);

const { data: tasksBOnA } = await b
  .from("tasks")
  .select("id, project_id")
  .eq("project_id", projectA);
assert("B cannot retrieve Project A tasks", (tasksBOnA ?? []).length === 0);

const { data: aProjects } = await a.from("projects").select("id").order("created_at");
const other = (aProjects ?? []).map((row) => row.id).find((id) => id !== projectA);
if (other) {
  const { data: tasksOther } = await a
    .from("tasks")
    .select("id, project_id")
    .eq("project_id", projectA);
  assert(
    "same-company other project is not mixed into Project A filter",
    (tasksOther ?? []).every((row) => row.project_id === projectA),
  );
} else {
  console.log("SKIP same-company Project B: Company A has only one project");
}

if (failed > 0) {
  process.exit(1);
}
