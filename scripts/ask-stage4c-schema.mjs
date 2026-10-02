/**
 * Static Stage 4C retrieval SQL contract. Does not connect to a database.
 */
import { readFileSync } from "node:fs";

const sql = readFileSync("sql/week9_document_chunk_retrieval.sql", "utf8");

let failed = 0;
function assert(name, condition) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`PASS ${name}`);
}

assert("defines search_project_document_chunks", sql.includes("search_project_document_chunks"));
assert("security invoker", /security invoker/i.test(sql));
assert("not security definer", !/security definer/i.test(sql));
assert("uses search_vector FTS", sql.includes("c.search_vector @@ q"));
assert("uses pg_catalog.plainto_tsquery", sql.includes("pg_catalog.plainto_tsquery('english'"));
assert("uses pg_catalog.ts_rank_cd", sql.includes("pg_catalog.ts_rank_cd(c.search_vector, q)"));
assert("search_path is pg_catalog, public", sql.includes("set search_path = pg_catalog, public"));
assert("does not take company_id argument", !/p_company_id/.test(sql));
assert("scopes to current_company_id", sql.includes("current_company_id()"));
assert("as-of filter present", sql.includes("c.source_issued_on <= p_as_of"));
assert("hard cap 25", sql.includes("least(greatest(coalesce(p_limit, 25), 1), 25)"));
assert(
  "identity tie-break order ends with c.id",
  sql.includes("c.document_id asc") &&
    sql.includes("c.locator asc") &&
    sql.includes("c.part_index asc") &&
    sql.includes("c.id asc"),
);
assert("empty query returns no rows", sql.includes("char_length(trim(p_query)) = 0"));
assert("grant execute to authenticated", sql.includes("grant execute on function public.search_project_document_chunks(uuid, text, date, integer) to authenticated"));
assert("revoke execute from anon", sql.includes("revoke all on function public.search_project_document_chunks(uuid, text, date, integer) from anon"));
assert("revoke execute from public", sql.includes("revoke all on function public.search_project_document_chunks(uuid, text, date, integer) from public"));
assert("does not grant 4B writer", !/grant execute on function public.replace_ready_document_extraction/.test(sql));
assert("reaffirms writer revoke", sql.includes("revoke all on function public.replace_ready_document_extraction"));
assert("no insert grant on chunks", !/grant insert on table public\.document_chunks/.test(sql));
assert("no insert grant on extractions", !/grant insert on table public\.document_extractions/.test(sql));
assert("no update grant on chunks", !/grant update on table public\.document_chunks/.test(sql));
assert("no delete grant on chunks", !/grant delete on table public\.document_chunks/.test(sql));
assert("no pgvector", !/pgvector/i.test(sql) && !/\bextension\s+vector\b/i.test(sql));
assert("no Ask / provider changes", !/ask_|openai/i.test(sql));

if (failed > 0) {
  process.exit(1);
}
console.log("ask-stage4c-schema: ok");
