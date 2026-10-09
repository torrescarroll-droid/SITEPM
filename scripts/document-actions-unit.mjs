import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createHash } from "node:crypto";
import ts from "typescript";
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url, { alias: { "@": process.cwd() } }),
  files = await jiti.import("../lib/document-file.ts"),
  types = await jiti.import("../lib/document-types.ts");
const project = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222",
  request = "33333333-3333-4333-8333-333333333333";
const bytes = readFileSync(
    "tests/fixtures/pdf-text-extract/normal-multi-page.pdf",
  ),
  hash = createHash("sha256").update(bytes).digest("hex");
function harness(options = {}) {
  const calls = [],
    trusted = [],
    module = { exports: {} };
  const document = {
    id,
    project_id: project,
    company_id: "company-a",
    filename: "source.pdf",
    storage_path: "canonical",
    byte_size: bytes.length,
    sha256: hash,
    content_type: "application/pdf",
    status: options.alreadyVerified ? "ready" : "pending",
  };
  const chain = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle: async () => ({
      data: {
        document_id: id,
        family_id: id,
        verified_at: options.alreadyVerified ? "2026-10-09" : null,
      },
    }),
  };
  const supabase = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "local-test-token" } },
      }),
    },
    from: () => chain,
    rpc: async (name, args) => {
      calls.push({ name, args });
      return options.rpcError
        ? { error: { code: options.rpcError, message: options.rpcMessage } }
        : {
            data: { document_id: id, family_id: id, storage_path: "canonical" },
          };
    },
    storage: {
      from: () => ({
        createSignedUploadUrl: async () => ({
          data: { token: "scoped-test-token" },
        }),
        download: async () => ({
          data: new Blob([options.wrongBytes ? Buffer.from("wrong") : bytes]),
        }),
      }),
    },
  };
  const mocks = {
    "node:crypto": { createHash },
    "next/cache": {
      revalidatePath() {
        if (options.cacheThrows) throw Error("Cache failed");
      },
    },
    "@/lib/auth-context": {
      requireCompanyContext: async () => ({
        user: { id: "actor-a" },
        profile: { company_id: "company-a" },
        supabase,
      }),
    },
    "@/lib/document-types": types,
    "@/lib/document-file": files,
    "@/lib/document-verifier": {
      documentVerifierConfigured: () => !options.unconfigured,
      trustedDocumentOperation: async (actor, operation, input) => {
        trusted.push({ actor, operation, input });
        return { document_id: id, family_id: id, verified: true };
      },
    },
    "@/lib/documents": {
      getAuthorizedDocument: async () => (options.denied ? null : document),
    },
    "@/lib/document-extraction-persist": {
      persistReadyPdfExtraction: async () => ({
        skipped: "extractor_unconfigured",
      }),
    },
  };
  runInNewContext(
    ts.transpileModule(
      readFileSync("lib/document-management-actions.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      module,
      exports: module.exports,
      require: (n) => {
        assert(n in mocks, n);
        return mocks[n];
      },
      process: {
        env: {
          SUPABASE_URL: "http://127.0.0.1:55451",
          SUPABASE_ANON_KEY: "local-public-test-key",
        },
      },
      Buffer,
      Blob,
    },
  );
  return { actions: module.exports, calls, trusted };
}
const input = {
  id,
  project_id: project,
  filename: "source.pdf",
  sha256: hash,
  byte_size: bytes.length,
  category: "plans",
  company_id: "forged",
};
let h = harness(),
  result = await h.actions.startDocumentUpload(request, input);
assert(result.data);
assert.equal(h.calls.length, 1);
assert(h.calls[0].args.p_record.storage_path.startsWith("company-a/"));
assert.equal(result.data.content_type, "application/pdf");
for (const invalid of [
  { id: "invalid" },
  { filename: "macro.docm" },
  { byte_size: 20971521 },
  { sha256: "forged" },
]) {
  h = harness();
  assert(
    (await h.actions.startDocumentUpload(request, { ...input, ...invalid }))
      .error,
  );
  assert.equal(h.calls.length, 0);
}
h = harness({ unconfigured: true });
assert((await h.actions.startDocumentUpload(request, input)).error);
assert.equal(h.calls.length, 0);
h = harness();
result = await h.actions.confirmDocumentUpload(request);
assert(result.data.verified);
assert.equal(h.trusted[0].actor, "actor-a");
assert.equal(h.trusted[0].input.sha, hash);
for (const options of [{ wrongBytes: true }, { denied: true }]) {
  h = harness(options);
  assert((await h.actions.confirmDocumentUpload(request)).error);
  assert.equal(h.trusted.length, 0);
}
h = harness({ cacheThrows: true });
assert((await h.actions.confirmDocumentUpload(request)).data.verified);
h = harness({ rpcError: "40001" });
assert.match(
  (await h.actions.manageDocument(id, 1, "promote", { document_id: id })).error,
  /Reload/,
);
h = harness();
assert((await h.actions.manageDocument(id, 1, "delete", {})).error);
assert.equal(h.calls.length, 0);
for (const [rpcMessage, expected] of [
  ["Upload limit reached; retry later", /50 uploads/],
  ["Company document capacity reached", /capacity is full/],
]) {
  h = harness({ rpcError: "P0001", rpcMessage });
  assert.match(
    (await h.actions.startDocumentUpload(request, input)).error,
    expected,
  );
}
h = harness({ alreadyVerified: true, wrongBytes: true });
assert((await h.actions.confirmDocumentUpload(request)).data.verified);
assert.equal(h.trusted.length, 0);
console.log(
  "PASS actual document actions: validation, derived tenant/path/MIME, unavailable verifier, authorized byte/hash confirmation, rejection, stale edits and cache-failure success",
);
