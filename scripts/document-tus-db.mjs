import { isolatedEnvironment } from "./isolated-environment.mjs";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
const e = isolatedEnvironment(),
  f = parseEnv(readFileSync(".env.document-browser.local", "utf8")),
  client = createClient(e.API_URL, e.ANON_KEY);
assert.ifError(
  (
    await client.auth.signInWithPassword({
      email: f.EMAIL_A,
      password: f.PASSWORD,
    })
  ).error,
);
const company = (await client.from("profiles").select("company_id").single())
  .data.company_id;
const bytes = Buffer.concat([
    readFileSync("tests/fixtures/pdf-text-extract/normal-multi-page.pdf"),
    Buffer.alloc(7 * 1024 * 1024, 32),
    Buffer.from("\n%%EOF\n"),
  ]),
  id = randomUUID(),
  request = randomUUID(),
  path = `${company}/${f.PROJECT_A}/${id}/transport.pdf`;
assert.ifError(
  (
    await client.rpc("begin_document_upload", {
      p_request: request,
      p_record: {
        id,
        project_id: f.PROJECT_A,
        title: "Isolated resumable acceptance",
        category: "plans",
        filename: "transport.pdf",
        byte_size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        storage_path: path,
        content_type: "application/pdf",
      },
    })
  ).error,
);
const signed = await client.storage
  .from("project-documents")
  .createSignedUploadUrl(path, { upsert: false });
assert.ifError(signed.error);
const headers = {
  "Tus-Resumable": "1.0.0",
  "x-signature": signed.data.token,
  apikey: e.ANON_KEY,
  Authorization:
    "Bearer " + (await client.auth.getSession()).data.session.access_token,
};
const metadata = Object.entries({
  bucketName: "project-documents",
  objectName: path,
  contentType: "application/pdf",
})
  .map(([k, v]) => `${k} ${btoa(v)}`)
  .join(",");
const created = await fetch(e.API_URL + "/storage/v1/upload/resumable", {
  method: "POST",
  headers: {
    ...headers,
    "Upload-Length": String(bytes.length),
    "Upload-Metadata": metadata,
  },
});
assert.equal(created.status, 201);
const location = created.headers.get("Location");
assert.equal(new URL(location).origin, new URL(e.API_URL).origin);
const first = 6 * 1024 * 1024;
assert.equal(
  (
    await fetch(location, {
      method: "PATCH",
      headers: {
        ...headers,
        "Upload-Offset": "0",
        "Content-Type": "application/offset+octet-stream",
      },
      body: bytes.subarray(0, first),
    })
  ).status,
  204,
);
const checkpoint = await fetch(location, { method: "HEAD", headers });
assert.equal(checkpoint.status, 200);
assert.equal(Number(checkpoint.headers.get("Upload-Offset")), first);
assert.equal(
  (
    await fetch(location, {
      method: "PATCH",
      headers: {
        ...headers,
        "Upload-Offset": String(first),
        "Content-Type": "application/offset+octet-stream",
      },
      body: bytes.subarray(first),
    })
  ).status,
  204,
);
const downloaded = await client.storage
  .from("project-documents")
  .download(path);
assert.ifError(downloaded.error);
assert.equal(
  createHash("sha256")
    .update(Buffer.from(await downloaded.data.arrayBuffer()))
    .digest("hex"),
  createHash("sha256").update(bytes).digest("hex"),
);
console.log(
  "PASS real Storage TUS multi-chunk upload, authenticated signed token, HEAD checkpoint resume and complete byte/hash preservation",
);
