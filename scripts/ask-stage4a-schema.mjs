/**
 * Static Stage 4A schema contract checks. Does not connect to a database.
 */
import { readFileSync } from "node:fs";

const sql = readFileSync("sql/week7_document_intelligence.sql", "utf8");

let failed = 0;
function assert(name, condition) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`PASS ${name}`);
}

assert("creates document_extractions", sql.includes("create table if not exists public.document_extractions"));
assert("creates document_chunks", sql.includes("create table if not exists public.document_chunks"));
assert("enables RLS on extractions", /alter table public\.document_extractions\s+enable row level security/.test(sql));
assert("enables RLS on chunks", /alter table public\.document_chunks\s+enable row level security/.test(sql));
assert("select grant extractions", sql.includes("grant select on table public.document_extractions to authenticated"));
assert("select grant chunks", sql.includes("grant select on table public.document_chunks to authenticated"));
assert("revokes writes on extractions", sql.includes("revoke all on table public.document_extractions from anon, authenticated, public"));
assert("revokes writes on chunks", sql.includes("revoke all on table public.document_chunks from anon, authenticated, public"));
assert("no authenticated insert grant on extractions", !/grant insert on table public\.document_extractions to authenticated/.test(sql));
assert("no authenticated insert grant on chunks", !/grant insert on table public\.document_chunks to authenticated/.test(sql));
assert("ready parent required", sql.includes("Extraction parent document must be ready"));
assert("sha256 bound to parent", sql.includes("Extraction source_sha256 must match the parent document hash"));
assert("chunk sha256 bound", sql.includes("Chunk source_sha256 must match the extraction hash"));
assert("provenance lock on extraction", sql.includes("Extraction provenance cannot be changed"));
assert("provenance lock on chunk", sql.includes("Chunk provenance cannot be changed"));
assert("fts gin index", sql.includes("using gin (search_vector)"));
assert("no pgvector", !/pgvector/i.test(sql) && !/\bextension\s+vector\b/i.test(sql));
assert("write hook refused", sql.includes("Document extraction writes are not enabled (Stage 4A)"));
assert("write hook execute revoked", sql.includes("revoke all on function public.replace_document_extraction() from authenticated"));
assert("source_issued_on present", sql.includes("source_issued_on date"));
assert("source_effective_on present", sql.includes("source_effective_on date"));
assert("content_kind check", sql.includes("'markdown'") && sql.includes("'pdf_text'"));
assert("does not alter documents identity", !/documents_lock_identity/.test(sql) && !/documents_filename_safe/.test(sql));
assert("no Ask / provider changes in this file", !/ask_|openai/i.test(sql));

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4a-schema: ok");
