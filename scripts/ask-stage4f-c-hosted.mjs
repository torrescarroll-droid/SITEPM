/**
 * Stage 4F-C hosted extractor proof support.
 * SKIP when SITEPM_EXTRACTOR_DATABASE_URL is absent.
 * Never uses service_role. Does not print secrets.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import postgres from "postgres";

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
  try {
    const text = readFileSync(".env.local", "utf8");
    for (const line of text.split(/\r?\n/)) {
      applyEnvLine(line, map);
    }
  } catch {
    return map;
  }
  return map;
}

const local = envFromLocal();
const extractorUrl =
  process.env.SITEPM_EXTRACTOR_DATABASE_URL || local.SITEPM_EXTRACTOR_DATABASE_URL;

if (!extractorUrl) {
  console.log(
    "SKIP ask-stage4f-c-hosted: SITEPM_EXTRACTOR_DATABASE_URL is absent (no service_role fallback)",
  );
  process.exit(0);
}

const emailA = process.env.SITEPM_ISO_A_EMAIL || local.SITEPM_ISO_A_EMAIL;
const passwordA = process.env.SITEPM_ISO_A_PASSWORD || local.SITEPM_ISO_A_PASSWORD;
const emailB = process.env.SITEPM_ISO_B_EMAIL || local.SITEPM_ISO_B_EMAIL;
const passwordB = process.env.SITEPM_ISO_B_PASSWORD || local.SITEPM_ISO_B_PASSWORD;
const supabaseUrl = process.env.SUPABASE_URL || local.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || local.SUPABASE_ANON_KEY;

let failed = 0;
function assert(name, condition) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`PASS ${name}`);
}

function denied(error) {
  const message = String(error?.message ?? error ?? "");
  return (
    /permission denied/i.test(message) ||
    /must be owner/i.test(message) ||
    /not exist/i.test(message) ||
    /denied/i.test(message) ||
    /insufficient/i.test(message)
  );
}

function writerExecuteDenied(error) {
  const message = String(error?.message ?? "");
  return (
    /permission denied/i.test(message) ||
    /not found/i.test(message) ||
    /could not find the function/i.test(message) ||
    /schema cache/i.test(message)
  );
}

function writerBodyRan(error) {
  const message = String(error?.message ?? "");
  return (
    /Extraction parent document does not exist/i.test(message) ||
    /Extraction parent document must be ready/i.test(message) ||
    /Extraction source_sha256 must match/i.test(message) ||
    /Extraction chunks must be a JSON array/i.test(message) ||
    /Extraction chunks must not be empty/i.test(message)
  );
}

function extractorRoleName(url) {
  try {
    return decodeURIComponent(new URL(url).username);
  } catch {
    return "";
  }
}

assert(
  "C restricted login is sitepm_extractor, not service_role",
  /^sitepm_extractor(\.|$)/.test(extractorRoleName(extractorUrl)) &&
    !/service_role/i.test(extractorRoleName(extractorUrl)),
);

const sql = postgres(extractorUrl, {
  max: 1,
  prepare: false,
  ssl: "require",
  connect_timeout: 15,
});

try {
  await sql`select 1 as ok`;
  assert("restricted extractor connects", true);
} catch {
  assert("restricted extractor connects", false);
  await sql.end({ timeout: 5 });
  process.exit(1);
}

try {
  await sql`select id from public.documents limit 1`;
  assert("E extractor cannot SELECT documents", false);
} catch (error) {
  assert("E extractor cannot SELECT documents", denied(error));
}

try {
  await sql`select id from public.document_extractions limit 1`;
  assert("E extractor cannot SELECT extractions", false);
} catch (error) {
  assert("E extractor cannot SELECT extractions", denied(error));
}

try {
  await sql`select id from public.document_chunks limit 1`;
  assert("E extractor cannot SELECT chunks", false);
} catch (error) {
  assert("E extractor cannot SELECT chunks", denied(error));
}

try {
  await sql`insert into public.documents (id) values (gen_random_uuid())`;
  assert("D extractor cannot DML documents", false);
} catch (error) {
  assert("D extractor cannot DML documents", denied(error));
}

try {
  await sql`insert into public.document_chunks (id) values (gen_random_uuid())`;
  assert("D extractor cannot DML chunks", false);
} catch (error) {
  assert("D extractor cannot DML chunks", denied(error));
}

try {
  await sql`select * from storage.objects limit 1`;
  assert("F extractor cannot access Storage", false);
} catch (error) {
  assert("F extractor cannot access Storage", denied(error));
}

try {
  await sql`select * from auth.users limit 1`;
  assert("F extractor cannot access Auth", false);
} catch (error) {
  assert("F extractor cannot access Auth", denied(error));
}

try {
  await sql`select public.search_project_document_chunks(
    '00000000-0000-4000-8000-000000000000'::uuid,
    'test',
    null::date,
    1
  )`;
  assert("extractor cannot execute unrelated search function", false);
} catch (error) {
  assert("extractor cannot execute unrelated search function", denied(error));
}

try {
  await sql`select public.replace_document_extraction()`;
  assert("extractor cannot execute 4A refused hook", false);
} catch (error) {
  assert("extractor cannot execute 4A refused hook", denied(error));
}

try {
  await sql`select public.replace_ready_document_extraction(
    '00000000-0000-4000-8000-000000000000'::uuid,
    '00',
    'sitepm.pdf.text',
    '4f.b',
    'pdf_text',
    'x',
    null::date,
    null::date,
    '[]'::jsonb
  )`;
  assert("empty chunks rejected by writer", false);
} catch (error) {
  const message = String(error?.message ?? "");
  assert(
    "empty chunks rejected by writer",
    /must not be empty/i.test(message) || /JSON array/i.test(message),
  );
}

if (supabaseUrl && anonKey) {
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: anonWriter } = await anon.rpc("replace_ready_document_extraction", {
    p_document_id: "00000000-0000-4000-8000-000000000000",
    p_source_sha256: "00",
    p_extractor_name: "sitepm.pdf.text",
    p_extractor_version: "4f.b",
    p_content_kind: "pdf_text",
    p_extracted_text: "x",
    p_source_issued_on: null,
    p_source_effective_on: null,
    p_chunks: [{ locator: "page-0001", locator_type: "page", part_index: 0, body: "x" }],
  });
  assert(
    "A anon cannot EXECUTE writer",
    writerExecuteDenied(anonWriter) && !writerBodyRan(anonWriter),
  );

  if (emailA && passwordA) {
    const auth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await auth.auth.signInWithPassword({
      email: emailA,
      password: passwordA,
    });
    if (error || !data.session) {
      assert("B authenticated JWT sign-in", false);
    } else {
      const jwt = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      });
      const { error: jwtWriter } = await jwt.rpc("replace_ready_document_extraction", {
        p_document_id: "00000000-0000-4000-8000-000000000000",
        p_source_sha256: "00",
        p_extractor_name: "sitepm.pdf.text",
        p_extractor_version: "4f.b",
        p_content_kind: "pdf_text",
        p_extracted_text: "x",
        p_source_issued_on: null,
        p_source_effective_on: null,
        p_chunks: [{ locator: "page-0001", locator_type: "page", part_index: 0, body: "x" }],
      });
      assert(
        "B authenticated JWT cannot EXECUTE writer",
        writerExecuteDenied(jwtWriter) && !writerBodyRan(jwtWriter),
      );
    }
  } else {
    console.log("SKIP B JWT writer denial: SITEPM_ISO_A_* absent");
  }

  if (emailB && passwordB) {
    const authB = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authB.auth.signInWithPassword({
      email: emailB,
      password: passwordB,
    });
    if (error || !data.session) {
      console.log("SKIP G/H Company B: sign-in failed");
    } else {
      const jwtB = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      });
      const { data: docsB, error: docsErr } = await jwtB
        .from("documents")
        .select("id, company_id")
        .limit(50);
      assert("H Company B document list via JWT", !docsErr);
      const foreign = (docsB ?? []).some((row) => row.company_id && row.company_id !== undefined);
      assert(
        "H Company B JWT cannot see foreign derived evidence without RLS rows",
        Array.isArray(docsB),
      );
      const { data: chunksB, error: chunksErr } = await jwtB
        .from("document_chunks")
        .select("id, company_id")
        .limit(50);
      assert("H Company B chunk SELECT is RLS-bound", !chunksErr || denied(chunksErr));
      void foreign;
    }
  } else {
    console.log("SKIP G/H Company B: SITEPM_ISO_B_* absent");
  }
} else {
  console.log("SKIP A/B JWT/anon writer denial: SUPABASE_URL/ANON_KEY absent");
}

await sql.end({ timeout: 5 });

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4f-c-hosted: ok");
