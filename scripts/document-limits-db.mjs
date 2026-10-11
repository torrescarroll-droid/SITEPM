/** Guarded loopback-only quota acceptance; synthetic metadata is retained, no production access. */
import { isolatedEnvironment } from "./isolated-environment.mjs";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import assert from "node:assert/strict";
const e = isolatedEnvironment(),
  client = createClient(e.API_URL, e.ANON_KEY),
  run = randomUUID(),
  sql = postgres(e.DB_URL, { max: 1, onnotice: () => {} });
try {
  const signup = await client.auth.signUp({
    email: `document-limits-${run}@example.test`,
    password: "Local-only-SITEPM-test-2026!",
    options: {
      data: {
        company_name: "Isolated document limits",
        full_name: "Limits fixture",
      },
    },
  });
  assert.ifError(signup.error);
  const company = (await client.from("profiles").select("company_id").single())
    .data.company_id;
  const job = await client
    .from("projects")
    .insert({ company_id: company, name: "Isolated quota acceptance" })
    .select("id")
    .single();
  assert.ifError(job.error);
  function record() {
    const id = randomUUID();
    return {
      id,
      project_id: job.data.id,
      title: "Isolated pending quota fixture",
      category: "other",
      filename: "limit.pdf",
      byte_size: 1,
      sha256: "a".repeat(64),
      content_type: "application/pdf",
      storage_path: `${company}/${job.data.id}/${id}/limit.pdf`,
    };
  }
  let first;
  for (let i = 0; i < 50; i++) {
    const r = record(),
      key = randomUUID(),
      saved = await client.rpc("begin_document_upload", {
        p_request: key,
        p_record: r,
      });
    assert.ifError(saved.error);
    first ??= { r, key };
  }
  assert(
    (
      await client.rpc("begin_document_upload", {
        p_request: randomUUID(),
        p_record: record(),
      })
    ).error?.message.includes("Upload limit reached"),
  );
  assert.ifError(
    (
      await client.rpc("begin_document_upload", {
        p_request: first.key,
        p_record: first.r,
      })
    ).error,
  );
  // Age only this isolated fixture's rate-limit timestamps, then reach retained company capacity.
  await sql`update public.document_upload_attempts set created_at=now()-interval '2 hours' where company_id=${company}`;
  for (let i = 0; i < 50; i++)
    assert.ifError(
      (
        await client.rpc("begin_document_upload", {
          p_request: randomUUID(),
          p_record: record(),
        })
      ).error,
    );
  await sql`update public.document_upload_attempts set created_at=now()-interval '2 hours' where company_id=${company}`;
  for (let i = 0; i < 2; i++)
    assert.ifError(
      (
        await client.rpc("begin_document_upload", {
          p_request: randomUUID(),
          p_record: record(),
        })
      ).error,
    );
  assert(
    (
      await client.rpc("begin_document_upload", {
        p_request: randomUUID(),
        p_record: record(),
      })
    ).error?.message.includes("Company document capacity reached"),
  );
  assert.equal(
    (
      await sql`select count(*)::int n from public.documents where company_id=${company}`
    )[0].n,
    102,
  );
  console.log(
    "PASS database-enforced 50 registrations/hour, idempotent retry at limit, reserved 2 GiB company capacity despite 1-byte declarations and rejection rollback (metadata-only isolated fixtures)",
  );
} finally {
  await sql.end();
}
