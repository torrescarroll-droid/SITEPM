/** Called only by the guarded local replay tool, before the Sprint 5 boundary exists. */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
export async function legacyFixture(e) {
  const client = createClient(e.API_URL, e.ANON_KEY),
    password = "Local-only-SITEPM-test-2026!",
    email = `legacy-${randomUUID()}@example.test`;
  assert.ifError(
    (
      await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            company_name: "Isolated legacy upgrade",
            full_name: "Legacy tester",
          },
        },
      })
    ).error,
  );
  const profile = (
    await client.from("profiles").select("id,company_id").single()
  ).data;
  const job = await client
    .from("projects")
    .insert({ company_id: profile.company_id, name: "Legacy upgrade job" })
    .select("id")
    .single();
  assert.ifError(job.error);
  const bytes = readFileSync(
    "tests/fixtures/pdf-text-extract/normal-multi-page.pdf",
  );
  const docs = [];
  for (const status of ["ready", "pending", "failed"]) {
    const id = randomUUID(),
      d = {
        id,
        company_id: profile.company_id,
        project_id: job.data.id,
        filename: status + ".pdf",
        storage_path: `${profile.company_id}/${job.data.id}/${id}/${status}.pdf`,
        document_type: "plans",
        content_type: "application/pdf",
        byte_size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        uploaded_by: profile.id,
        status: "pending",
      };
    assert.ifError((await client.from("documents").insert(d)).error);
    if (status === "ready")
      assert.ifError(
        (
          await client.storage
            .from("project-documents")
            .upload(d.storage_path, bytes, { contentType: "application/pdf" })
        ).error,
      );
    if (status !== "pending")
      assert.ifError(
        (await client.from("documents").update({ status }).eq("id", id)).error,
      );
    docs.push({ ...d, status });
  }
  return async () => {
    for (let i = 0; i < 20; i++) {
      const ready = await client
        .from("document_families")
        .select("id")
        .limit(1);
      if (!ready.error) break;
      if (ready.error.code !== "PGRST205") assert.ifError(ready.error);
      await new Promise((r) => setTimeout(r, 250));
    }
    for (const d of docs) {
      const canonical = await client
        .from("documents")
        .select("*")
        .eq("id", d.id)
        .single();
      assert.ifError(canonical.error);
      for (const key of [
        "id",
        "company_id",
        "project_id",
        "storage_path",
        "sha256",
        "status",
      ])
        assert.equal(canonical.data[key], d[key]);
      const family = await client
        .from("document_families")
        .select("*")
        .eq("id", d.id)
        .single();
      assert.ifError(family.error);
      assert.equal(
        family.data.current_document_id,
        d.status === "ready" ? d.id : null,
      );
      const versions = await client
        .from("document_versions")
        .select("*")
        .eq("document_id", d.id);
      assert.ifError(versions.error);
      assert.equal(versions.data.length, 1);
      assert.equal(versions.data[0].version_number, 1);
      if (d.status === "ready")
        assert.ifError(
          (
            await client.storage
              .from("project-documents")
              .download(d.storage_path)
          ).error,
        );
    }
    console.log(
      "PASS populated legacy ready/pending/failed backfill; IDs/paths/hashes/status/storage retained",
    );
  };
}
