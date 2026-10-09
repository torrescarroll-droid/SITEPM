/** Assemble a fresh LOCAL baseline from canonical SQL. Never use this file on production. */
import { readFileSync, writeFileSync } from "node:fs";
const files = ["week3_core_tables.sql", "week4_auth_rls.sql", "week5_task_rls.sql", "week5_field_log_rls.sql", "week6_documents.sql", "week7_document_intelligence.sql", "week8_document_extraction_write.sql", "week9_document_chunk_retrieval.sql", "week10_document_extraction_executor.sql", "week11_core_job_operations.sql"];
writeFileSync("supabase/migrations/19700101000000_local_baseline.sql", "-- Local-only role: no login and no password.\ncreate role sitepm_extractor nologin;\n" + files.map(name => readFileSync(`sql/${name}`, "utf8")).join("\n"));
console.log("Prepared ignored local-only baseline; no database connection made.");
