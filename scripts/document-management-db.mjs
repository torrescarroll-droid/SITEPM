/** Real Auth, RLS and Storage acceptance; loopback only. Fixtures are retained for browser review. */
import { isolatedEnvironment } from "./isolated-environment.mjs";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
const e = isolatedEnvironment(),
  sql = postgres(e.DB_URL, { max: 4 }),
  verifier = postgres(e.DOCUMENT_DATABASE_URL, { max: 3 });
const run = randomUUID(),
  password = "Local-only-SITEPM-test-2026!";
async function account(label) {
  const client = createClient(e.API_URL, e.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    email = `documents-${label}-${run}@example.test`;
  const a = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        company_name: `Isolated documents ${label}`,
        full_name: `Document tester ${label}`,
      },
    },
  });
  assert.ifError(a.error);
  const p = await client.from("profiles").select("company_id").single();
  assert.ifError(p.error);
  const job = await client
    .from("projects")
    .insert({
      company_id: p.data.company_id,
      name: `Document acceptance job ${label}`,
    })
    .select("id")
    .single();
  assert.ifError(job.error);
  return {
    client,
    email,
    user: a.data.user.id,
    company: p.data.company_id,
    project: job.data.id,
  };
}
const bytes = Buffer.from("%PDF-1.4\nIsolated source fixture\n%%EOF\n");
function record(a, extra = {}) {
  const id = randomUUID();
  return {
    id,
    project_id: a.project,
    filename: "source.pdf",
    byte_size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    category: "plans",
    content_type: "application/pdf",
    title: "Permit drawings",
    collection: "Permit set",
    trade: "Electrical",
    notes: "",
    issue_label: "Issued for review",
    storage_path: `${a.company}/${a.project}/${id}/source.pdf`,
    ...extra,
  };
}
const begin = (a, r, k = randomUUID()) =>
  a.client.rpc("begin_document_upload", { p_request: k, p_record: r });
const manage = (a, id, revision, action, data = {}) =>
  a.client.rpc("manage_project_document", {
    p_family: id,
    p_revision: revision,
    p_action: action,
    p_data: data,
  });
async function verified(a, r, k) {
  return verifier.begin(async (t) => {
    await t`select set_config('request.jwt.claim.sub',${a.user},true)`;
    return (
      await t`select public.verify_document_upload(${k}::uuid,${r.sha256},${r.byte_size}) as result`
    )[0].result;
  });
}
async function failure(action) {
  let failed = false;
  try {
    await action();
  } catch {
    failed = true;
  }
  assert(failed, "Expected database rejection");
}
async function store(a, r) {
  const result = await a.client.storage
    .from("project-documents")
    .upload(r.storage_path, bytes, {
      contentType: r.content_type,
      upsert: false,
    });
  assert.ifError(result.error);
}
try {
  const [a, b] = await Promise.all([account("a"), account("b")]);
  const r = record(a),
    key = randomUUID();
  const pair = await Promise.all([begin(a, r, key), begin(a, r, key)]);
  pair.forEach((v) => assert.ifError(v.error));
  assert.equal(pair[0].data.document_id, pair[1].data.document_id);
  assert((await begin(a, { ...r, title: "Forged request" }, key)).error);
  assert((await begin(b, { ...record(b), project_id: a.project })).error);
  assert(
    (
      await a.client
        .from("documents")
        .insert({ ...r, company_id: a.company, status: "ready" })
    ).error,
  );
  assert(
    (
      await a.client
        .from("documents")
        .update({ status: "ready" })
        .eq("id", r.id)
    ).error,
  );
  assert(
    (
      await a.client
        .from("document_upload_attempts")
        .update({ verified_at: new Date().toISOString() })
        .eq("request_id", key)
    ).error,
  );
  assert(
    (
      await a.client.rpc("verify_document_upload", {
        p_request: key,
        p_sha: r.sha256,
        p_size: r.byte_size,
      })
    ).error,
  );
  assert((await manage(a, r.id, 1, "promote", { document_id: r.id })).error);
  console.log(
    "PASS atomic registration, duplicate/concurrent request replay, forged receipts/status and premature promotion rejected",
  );
  const arbitrary = `${a.company}/${a.project}/${randomUUID()}/arbitrary.pdf`;
  assert(
    (
      await a.client.storage
        .from("project-documents")
        .upload(arbitrary, bytes, { contentType: "application/pdf" })
    ).error,
  );
  await store(a, r);
  assert(
    (await b.client.storage.from("project-documents").download(r.storage_path))
      .error,
  );
  assert(
    (
      await a.client.storage
        .from("project-documents")
        .upload(r.storage_path, bytes, {
          contentType: "application/pdf",
          upsert: true,
        })
    ).error,
  );
  await failure(() =>
    verifier.begin(async (t) => {
      await t`select set_config('request.jwt.claim.sub',${a.user},true)`;
      await t`select public.verify_document_upload(${key}::uuid,${"0".repeat(64)},${r.byte_size})`;
    }),
  );
  const first = await verified(a, r, key);
  assert(first.verified);
  assert.equal((await verified(a, r, key)).document_id, r.id);
  assert.ifError(
    (await manage(a, r.id, 1, "promote", { document_id: r.id })).error,
  );
  assert.equal(
    (
      await a.client
        .from("current_project_documents")
        .select("id")
        .eq("id", r.id)
    ).data.length,
    1,
  );
  console.log(
    "PASS actual Storage upload, scoped downloads, immutable objects, checksum rejection and interrupted-confirmation replay",
  );
  const r2 = record(a, { family_id: r.id }),
    k2 = randomUUID();
  assert.ifError((await begin(a, r2, k2)).error);
  await store(a, r2);
  await verified(a, r2, k2);
  const concurrent = await Promise.all([
    manage(a, r.id, 2, "promote", { document_id: r2.id }),
    manage(a, r.id, 2, "metadata", {
      title: "Concurrent title",
      category: "plans",
    }),
  ]);
  assert.equal(concurrent.filter((v) => !v.error).length, 1);
  assert.equal(concurrent.filter((v) => v.error?.code === "40001").length, 1);
  let f = (
    await a.client.from("document_families").select("*").eq("id", r.id).single()
  ).data;
  if (f.current_document_id !== r2.id) {
    assert.ifError(
      (await manage(a, r.id, f.revision, "promote", { document_id: r2.id }))
        .error,
    );
    f = (
      await a.client
        .from("document_families")
        .select("*")
        .eq("id", r.id)
        .single()
    ).data;
  }
  assert.equal(
    (await a.client.from("document_versions").select("*").eq("family_id", r.id))
      .data.length,
    2,
  );
  const historical = await a.client.storage
    .from("project-documents")
    .download(r.storage_path);
  assert.ifError(historical.error);
  const task = await a.client
    .from("tasks")
    .insert({
      company_id: a.company,
      project_id: a.project,
      title: "Check source plan",
    })
    .select("id")
    .single();
  assert.ifError(task.error);
  const foreign = await b.client
    .from("tasks")
    .insert({
      company_id: b.company,
      project_id: b.project,
      title: "Other tenant",
    })
    .select("id")
    .single();
  assert.ifError(foreign.error);
  assert(
    (
      await manage(a, r.id, f.revision, "link", {
        id: randomUUID(),
        document_id: r.id,
        task_id: foreign.data.id,
      })
    ).error,
  );
  assert.ifError(
    (
      await manage(a, r.id, f.revision, "link", {
        id: randomUUID(),
        document_id: r.id,
        task_id: task.data.id,
      })
    ).error,
  );
  f.revision++;
  const job2 = await a.client
    .from("projects")
    .insert({ company_id: a.company, name: "Second source job" })
    .select("id")
    .single();
  assert.ifError(job2.error);
  assert(
    (
      await a.client
        .from("tasks")
        .update({ project_id: job2.data.id })
        .eq("id", task.data.id)
    ).error,
    "Scoped FK prevents moving referenced work",
  );
  const wrongTask = await a.client
    .from("tasks")
    .insert({
      company_id: a.company,
      project_id: job2.data.id,
      title: "Other job task",
    })
    .select("id")
    .single();
  assert.ifError(wrongTask.error);
  assert(
    (
      await manage(a, r.id, f.revision, "link", {
        id: randomUUID(),
        document_id: r.id,
        task_id: wrongTask.data.id,
      })
    ).error,
  );
  assert(
    (await begin(a, record(a, { family_id: r.id, project_id: job2.data.id })))
      .error,
  );
  const activityId = randomUUID();
  assert.ifError(
    (
      await a.client.rpc("save_construction_schedule", {
        p_request_id: randomUUID(),
        p_kind: "activity",
        p_record: {
          id: activityId,
          project_id: a.project,
          name: "Isolated linked inspection",
          start_date: "2026-10-09",
          finish_date: "2026-10-09",
          all_day: true,
          timezone: "America/Los_Angeles",
          status: "not_started",
          activity_type: "inspection",
          assignments: [],
        },
      })
    ).error,
  );
  const report = await a.client.rpc("save_field_report", {
    p_request_id: randomUUID(),
    p_project_id: a.project,
    p_report_id: null,
    p_expected_revision: null,
    p_report: {
      log_date: "2026-10-09",
      work_performed: "Reviewed source drawings",
      issue_flag: false,
    },
    p_crews: [],
    p_follow_up: null,
  });
  assert.ifError(report.error);
  for (const target of [
    { activity_id: activityId },
    { field_log_id: report.data[0].report_id },
  ]) {
    assert.ifError(
      (
        await manage(a, r.id, f.revision, "link", {
          id: randomUUID(),
          document_id: r.id,
          ...target,
        })
      ).error,
    );
    f.revision++;
  }
  const anon = createClient(e.API_URL, e.ANON_KEY, {
    auth: { persistSession: false },
  });
  assert(
    (
      await anon.rpc("begin_document_upload", {
        p_request: randomUUID(),
        p_record: record(a),
      })
    ).error,
  );
  assert((await anon.from("document_families").select("id")).error);
  assert((await manage(b, r.id, f.revision, "archive")).error);
  for (const table of [
    "document_families",
    "document_versions",
    "document_upload_attempts",
    "document_events",
    "document_links",
  ]) {
    const result = await b.client
      .from(table)
      .select("*")
      .eq("company_id", a.company);
    assert.ifError(result.error);
    assert.equal(result.data.length, 0);
  }
  assert.equal(
    (
      await b.client.rpc("search_document_families", {
        p_project: a.project,
        p_query: "",
      })
    ).data.length,
    0,
  );
  assert.ifError((await manage(a, r.id, f.revision, "archive")).error);
  f.revision++;
  assert(
    (await a.client.storage.from("project-documents").download(r.storage_path))
      .error,
  );
  assert.equal(
    (
      await a.client
        .from("current_project_documents")
        .select("id")
        .eq("id", r2.id)
    ).data.length,
    0,
  );
  assert.ifError((await manage(a, r.id, f.revision, "restore")).error);
  f.revision++;
  assert.ifError(
    (await a.client.storage.from("project-documents").download(r.storage_path))
      .error,
  );
  assert.equal(
    (await a.client.from("document_links").select("*").eq("document_id", r.id))
      .data.length,
    3,
  );
  console.log(
    "PASS immutable version history, stale/concurrent promotion, exact-version links, target-move rejection, tenant isolation, archive/restore",
  );
  const invalid = record(a, { category: "invalid" }),
    badkey = randomUUID();
  assert((await begin(a, invalid, badkey)).error);
  assert.equal(
    (
      await sql`select count(*)::int n from public.document_families where id=${invalid.id}`
    )[0].n,
    0,
  );
  // Two distinct requests allocate immutable version numbers under the family lock.
  const replacements = [
    record(a, { family_id: r.id }),
    record(a, { family_id: r.id }),
  ];
  const allocated = await Promise.all(replacements.map((x) => begin(a, x)));
  allocated.forEach((x) => assert.ifError(x.error));
  const sequence = await a.client
    .from("document_versions")
    .select("version_number")
    .eq("family_id", r.id)
    .order("version_number");
  assert.ifError(sequence.error);
  assert.deepEqual(
    sequence.data.map((x) => x.version_number),
    [1, 2, 3, 4],
  );
  assert(
    (await begin(a, record(a, { content_type: "image/png" }))).error,
    "MIME must match immutable filename",
  );
  assert(
    (await begin(a, record(a, { byte_size: 21 * 1024 * 1024 }))).error,
    "Database rejects oversized registration",
  );
  for (const table of [
    "document_families",
    "document_versions",
    "document_events",
    "document_links",
  ]) {
    assert(
      (await a.client.from(table).delete().eq("company_id", a.company)).error,
      "Direct mutation must be denied: " + table,
    );
  }
  const attested = await a.client
    .from("document_versions")
    .select("verified_at")
    .eq("document_id", r.id)
    .single();
  assert.ifError(attested.error);
  assert(attested.data.verified_at);
  const restricted =
    await sql`select has_schema_privilege('sitepm_document_writer','public','CREATE') as create_schema,pg_has_role('authenticated','sitepm_document_writer','MEMBER') as writer_member,pg_has_role('authenticated','sitepm_document_verifier','MEMBER') as verifier_member,has_table_privilege('anon','public.current_project_documents','SELECT') as anonymous_view`;
  assert(Object.values(restricted[0]).every((v) => !v));
  const definers =
    await sql`select p.proname,r.rolname,p.proconfig from pg_proc p join pg_roles r on r.oid=p.proowner where p.pronamespace='public'::regnamespace and p.proname in ('begin_document_upload','verify_document_upload','request_document_processing','document_processing_result','manage_project_document')`;
  assert.equal(definers.length, 5);
  assert(
    definers.every(
      (x) =>
        x.rolname === "sitepm_document_writer" &&
        x.proconfig.includes('search_path=""') &&
        x.proconfig.includes("row_security=on"),
    ),
  );
  console.log(
    "PASS concurrent version allocation, MIME/size constraints, direct-mutation denial, verified provenance and explicit owner/search_path/membership privileges",
  );
  const acl =
    await sql`select rolname,rolsuper,rolbypassrls from pg_roles where rolname in ('sitepm_document_writer','sitepm_document_verifier')`;
  assert(acl.every((v) => !v.rolsuper && !v.rolbypassrls));
  await failure(() => verifier`select * from public.documents`);
  const dangerous =
    await sql`select has_function_privilege('authenticated','public.verify_document_upload(uuid,text,bigint)','EXECUTE') v,has_table_privilege('authenticated','public.document_versions','INSERT') i,has_column_privilege('authenticated','public.documents','status','UPDATE') u`;
  assert(Object.values(dangerous[0]).every((v) => !v));
  console.log(
    "PASS transaction rollback and restricted function/table/role privileges",
  );
  writeFileSync(
    ".env.document-browser.local",
    `EMAIL_A=${a.email}\nEMAIL_B=${b.email}\nPASSWORD=${password}\nPROJECT_A=${a.project}\nPROJECT_B=${b.project}\nFAMILY_A=${r.id}\nDOCUMENT_A=${r.id}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Saved ignored local browser fixture references; credentials not printed.",
  );
} finally {
  await Promise.all([sql.end(), verifier.end()]);
}
