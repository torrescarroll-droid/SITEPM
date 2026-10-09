import assert from "node:assert/strict";
import { uploadDocumentResumable } from "../lib/document-upload-transport";
const original = globalThis.fetch,
  endpoint = "http://127.0.0.1:55461/storage/v1/upload/resumable",
  location = endpoint + "/local-checkpoint",
  file = new File([Buffer.alloc(7 * 1024 * 1024)], "source.pdf");
let offset = 0,
  fail = true,
  posts = 0,
  remembered = "",
  patches = 0;
globalThis.fetch = async (_url, options) => {
  assert(options?.signal, "Network operations must have a deadline");
  const method = options?.method;
  if (method === "POST") {
    posts++;
    return new Response(null, { status: 201, headers: { Location: location } });
  }
  if (method === "HEAD")
    return new Response(null, {
      status: 200,
      headers: { "Upload-Offset": String(offset) },
    });
  if (method === "PATCH") {
    patches++;
    if (offset && fail) {
      fail = false;
      throw Error("Disconnected");
    }
    const h = options.headers as Record<string, string>;
    assert.equal(Number(h["Upload-Offset"]), offset);
    offset += (options.body as Blob).size;
    return new Response(null, {
      status: 204,
      headers: { "Upload-Offset": String(offset) },
    });
  }
  throw Error("Unexpected request");
};
try {
  const data = {
      endpoint,
      token: "scoped-token",
      apikey: "public-test-key",
      access_token: "actor-token",
      storage_path: "registered-path",
      content_type: "application/pdf",
    },
    progress: number[] = [];
  await assert.rejects(() =>
    uploadDocumentResumable(
      data,
      file,
      (p) => progress.push(p),
      undefined,
      (u) => {
        remembered = u;
      },
    ),
  );
  assert.equal(offset, 6 * 1024 * 1024);
  await uploadDocumentResumable(
    data,
    file,
    (p) => progress.push(p),
    remembered,
    () => assert.fail("Must resume same checkpoint"),
  );
  assert.equal(offset, file.size);
  assert.equal(posts, 1);
  assert.equal(patches, 3);
  assert.equal(progress.at(-1), 100);
  assert(!remembered.includes("token"));
  await assert.rejects(() =>
    uploadDocumentResumable(
      data,
      file,
      () => {},
      "https://other.example/upload",
      () => {},
    ),
  );
  console.log(
    "PASS bounded TUS chunks/deadlines; interrupted transport resumes exact offset; tokens excluded from saved checkpoint; foreign destination rejected",
  );
} finally {
  globalThis.fetch = original;
}
