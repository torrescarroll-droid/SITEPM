import { isolatedEnvironment } from "./isolated-environment.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID, createHash } from "node:crypto";
import { createJiti } from "jiti";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
const e = isolatedEnvironment(),
  fixture = parseEnv(readFileSync(".env.document-browser.local", "utf8"));
process.env.SITEPM_EXTRACTOR_DATABASE_URL = e.EXTRACTOR_DATABASE_URL;
const jiti = createJiti(import.meta.url, { alias: { "@": process.cwd() } });
const { persistReadyPdfExtraction, defaultPersistReadyPdfExtractionDeps } =
  await jiti.import("../lib/document-extraction-persist.ts");
const verifier = postgres(e.DOCUMENT_DATABASE_URL, { max: 2 });
const client = createClient(e.API_URL, e.ANON_KEY),
  b = createClient(e.API_URL, e.ANON_KEY);
assert.ifError(
  (
    await client.auth.signInWithPassword({
      email: fixture.EMAIL_A,
      password: fixture.PASSWORD,
    })
  ).error,
);
assert.ifError(
  (
    await b.auth.signInWithPassword({
      email: fixture.EMAIL_B,
      password: fixture.PASSWORD,
    })
  ).error,
);
const user = (await client.auth.getUser()).data.user.id,
  company = (await client.from("profiles").select("company_id").single()).data
    .company_id;
const bytes = readFileSync(
    "tests/fixtures/pdf-text-extract/normal-multi-page.pdf",
  ),
  hash = createHash("sha256").update(bytes).digest("hex");
async function trusted(fn, id, state) {
  return verifier.begin(async (t) => {
    await t`select set_config('request.jwt.claim.sub',${user},true)`;
    if (fn === "verify")
      return t`select public.verify_document_upload(${id}::uuid,${hash},${bytes.length})`;
    if (fn === "begin")
      return t`select public.request_document_processing(${id}::uuid)`;
    return t`select public.document_processing_result(${id}::uuid,${state})`;
  });
}
async function upload(family) {
  const id = randomUUID(),
    request = randomUUID(),
    record = {
      id,
      project_id: fixture.PROJECT_A,
      family_id: family ?? null,
      title: "Search acceptance PDF",
      category: "plans",
      filename: "search.pdf",
      byte_size: bytes.length,
      sha256: hash,
      content_type: "application/pdf",
      storage_path: `${company}/${fixture.PROJECT_A}/${id}/search.pdf`,
    };
  const started = await client.rpc("begin_document_upload", {
    p_request: request,
    p_record: record,
  });
  assert.ifError(started.error);
  assert.ifError(
    (
      await client.storage
        .from("project-documents")
        .upload(record.storage_path, bytes, { contentType: "application/pdf" })
    ).error,
  );
  await trusted("verify", request);
  const d = await client.from("documents").select("*").eq("id", id).single();
  assert.ifError(d.error);
  return d.data;
}
const search = () =>
  client.rpc("search_project_document_chunks", {
    p_project_id: fixture.PROJECT_A,
    p_query: "hydronic",
    p_as_of: null,
    p_limit: 25,
  });
try {
  const d = await upload();
  await trusted("begin", d.id);
  await assert.rejects(() => trusted("begin", d.id));
  assert(
    (await client.rpc("request_document_processing", { p_document: d.id }))
      .error,
  );
  const extracted = await persistReadyPdfExtraction(
    { document: d, callerCompanyId: company },
    {
      ...defaultPersistReadyPdfExtractionDeps,
      downloadCanonicalObject: async (path) => {
        const result = await client.storage
          .from("project-documents")
          .download(path);
        assert.ifError(result.error);
        return Buffer.from(await result.data.arrayBuffer());
      },
    },
  );
  assert(extracted.extractionId);
  await trusted("result", d.id, "searchable");
  assert.equal(
    (await client.from("document_chunks").select("*").eq("document_id", d.id))
      .data.length,
    0,
    "Candidate text is not active evidence",
  );
  assert.ifError(
    (
      await client.rpc("manage_project_document", {
        p_family: d.id,
        p_revision: 1,
        p_action: "promote",
        p_data: { document_id: d.id },
      })
    ).error,
  );
  const chunks = await client
    .from("document_chunks")
    .select("*")
    .eq("document_id", d.id);
  assert.ifError(chunks.error);
  assert.equal(chunks.data.length, 3);
  assert(
    chunks.data.every(
      (c) => c.source_sha256 === hash && c.locator.startsWith("page-"),
    ),
  );
  const found = await search();
  assert.ifError(found.error);
  assert(found.data.some((c) => c.document_id === d.id));
  const d2 = await upload(d.id);
  assert.ifError(
    (
      await client.rpc("manage_project_document", {
        p_family: d.id,
        p_revision: 2,
        p_action: "promote",
        p_data: { document_id: d2.id },
      })
    ).error,
  );
  assert.equal(
    (await client.from("document_chunks").select("*").eq("document_id", d.id))
      .data.length,
    0,
    "Superseded source excluded before ranking",
  );
  assert(!(await search()).data.some((c) => c.document_id === d.id));
  assert.equal(
    (await b.from("document_chunks").select("*").eq("company_id", company)).data
      .length,
    0,
  );
  assert.ifError(
    (
      await client.rpc("manage_project_document", {
        p_family: d.id,
        p_revision: 3,
        p_action: "archive",
        p_data: {},
      })
    ).error,
  );
  assert(
    !(await search()).data.some((c) => [d.id, d2.id].includes(c.document_id)),
  );
  console.log(
    "PASS real stored PDF extraction/persistence; page/hash provenance; candidate/superseded/archived default exclusion; FTS and tenant isolation; processing lease/privileges",
  );
} finally {
  await verifier.end();
}
