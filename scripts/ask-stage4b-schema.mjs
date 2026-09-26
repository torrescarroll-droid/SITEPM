/**
 * Static Stage 4B write-hook contract. Does not connect to a database.
 */
import { readFileSync } from "node:fs";

const sql = readFileSync("sql/week8_document_extraction_write.sql", "utf8");

let failed = 0;
function assert(name, condition) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`PASS ${name}`);
}

assert("defines bounded writer", sql.includes("replace_ready_document_extraction"));
assert("does not take company_id argument", !/p_company_id/.test(sql));
assert("does not take project_id argument", !/p_project_id/.test(sql));
assert("ready parent required", sql.includes("Extraction parent document must be ready"));
assert("hash bound to parent", sql.includes("Extraction source_sha256 must match the parent document hash"));
assert("replaces by document_id only", sql.includes("delete from public.document_extractions") && sql.includes("where document_id = p_document_id"));
assert("execute revoked from authenticated", sql.includes("from authenticated"));
assert("execute revoked from anon", sql.includes("from anon"));
assert("keeps 4A refused hook revoked", sql.includes("revoke all on function public.replace_document_extraction() from authenticated"));
assert("chunks bind content_kind from extraction args not client company", sql.includes("p_content_kind") && sql.includes("add column if not exists content_kind"));
assert("no pgvector", !/pgvector/i.test(sql));
assert("no Ask changes", !/ask_/i.test(sql));

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4b-schema: ok");
