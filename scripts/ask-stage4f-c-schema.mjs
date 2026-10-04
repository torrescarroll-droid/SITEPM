/**
 * Static Stage 4F-C persist-boundary contract. Does not connect to a database.
 */
import { readFileSync } from "node:fs";

const sql = readFileSync("sql/week10_document_extraction_executor.sql", "utf8");
const persist = readFileSync("lib/document-extraction-persist.ts", "utf8");
const extractorDb = readFileSync("lib/document-extractor-db.ts", "utf8");
const actions = readFileSync("lib/document-actions.ts", "utf8");
const env = readFileSync("lib/supabase/env.ts", "utf8");
const child = readFileSync("lib/pdf-text-extract.ts", "utf8");
const week8 = readFileSync("sql/week8_document_extraction_write.sql", "utf8");
const week9 = readFileSync("sql/week9_document_chunk_retrieval.sql", "utf8");
const retrieval = readFileSync("lib/document-chunk-retrieval.ts", "utf8");
const week4d = readFileSync("lib/ask-evidence.ts", "utf8");

let failed = 0;
function assert(name, condition) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`PASS ${name}`);
}

assert("A revoke EXECUTE from anon", sql.includes("from anon"));
assert("B revoke EXECUTE from authenticated", sql.includes("from authenticated"));
assert("C revoke EXECUTE from service_role", sql.includes("from service_role"));
assert("C persist client never uses service_role key", !/SUPABASE_SERVICE_ROLE/i.test(extractorDb));
assert("C persist orchestration never uses service_role key", !/SUPABASE_SERVICE_ROLE/i.test(persist));
assert("C env helper remains anon-only", env.includes("SUPABASE_ANON_KEY") && !/SERVICE_ROLE/i.test(env));
assert("D revoke table DML/SELECT from extractor", sql.includes("revoke all on table public.document_chunks from sitepm_extractor"));
assert("D no table GRANT to extractor", !/grant (select|insert|update|delete|all) on table/i.test(sql));
assert("E revoke documents SELECT path", sql.includes("revoke all on table public.documents from sitepm_extractor"));
assert("F revoke storage schema", sql.includes("revoke usage on schema storage from sitepm_extractor"));
assert("F revoke auth schema", sql.includes("revoke usage on schema auth from sitepm_extractor"));
assert("writer search_path is pg_catalog, public", sql.includes("set search_path = pg_catalog, public"));
assert("preserves SECURITY DEFINER", sql.includes("security definer"));
assert("empty chunk SQL defense", sql.includes("jsonb_array_length(p_chunks) = 0"));
assert("transaction advisory lock", sql.includes("pg_advisory_xact_lock") && !/pg_advisory_lock\(/.test(sql));
assert("grant EXECUTE only to sitepm_extractor", sql.includes("to sitepm_extractor"));
assert("does not take company_id argument", !/p_company_id/.test(sql));
assert("does not take project_id argument", !/p_project_id/.test(sql));
assert("does not create role with password", !/^\s*create role/im.test(sql) && !/password\s+'/i.test(sql));
assert("fails closed if role missing", sql.includes("if not exists (select 1 from pg_roles where rolname = 'sitepm_extractor')"));
assert("atomic replace by document_id", sql.includes("delete from public.document_extractions") && sql.includes("where document_id = p_document_id"));
assert("no extraction history table", !/create table/i.test(sql));
assert("persist uses timeout-child parser", persist.includes('parser: "timeout-child"'));
assert("persist uses SITEPM_EXTRACTOR_DATABASE_URL", extractorDb.includes("SITEPM_EXTRACTOR_DATABASE_URL"));
assert("no NEXT_PUBLIC extractor URL", !/NEXT_PUBLIC_.*EXTRACTOR/.test(extractorDb) && !/NEXT_PUBLIC_.*EXTRACTOR/.test(persist));
assert("upload wires persist after ready", actions.includes("persistReadyPdfExtractionBestEffort"));
assert("upload still marks ready before persist", actions.indexOf('.update({ status: "ready" })') < actions.indexOf("await persistReadyPdfExtractionBestEffort"));
assert("writer client has no generic query export", !/export async function query/.test(extractorDb));
assert("4C retrieval file unchanged by this SQL", !sql.includes("ts_rank_cd"));
assert("week8 ranking not rewritten here", !/ts_rank_cd/.test(week8));
assert("week9 ranking SQL still present", week9.includes("ts_rank_cd"));
assert("4C retrieval module still present", retrieval.includes("search_project_document_chunks"));
assert("4D citation module still present", week4d.includes("documentChunkCitationLabel"));
assert("child env still allowlisted", child.includes("pdfParserChildEnv") && child.includes("SITEPM_EXTRACTOR_DATABASE_URL"));

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4f-c-schema: ok");
