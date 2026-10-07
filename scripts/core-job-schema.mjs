/**
 * Static Core Job Operations v0.1 SQL contract. Does not connect to a database.
 */
import { readFileSync } from "node:fs";

const sql = readFileSync("sql/week11_core_job_operations.sql", "utf8");

let failed = 0;
function assert(name, condition) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`PASS ${name}`);
}

assert("does not drop product tables", !/\bdrop table\b/i.test(sql));
assert("does not grant service_role", !/to\s+service_role/i.test(sql));
assert("daily report columns are additive", sql.includes("add column if not exists work_performed"));
assert("crews keep a trade without requiring a company name", sql.includes("company_name text") && sql.includes("trade_name text not null"));
assert("crew RLS is enabled", sql.includes("alter table public.field_log_crews enable row level security"));
assert("photos RLS is enabled", sql.includes("alter table public.photos enable row level security"));
assert("schedule RLS is enabled", sql.includes("alter table public.schedule_activities enable row level security"));
assert("dependency RLS is enabled", sql.includes("alter table public.schedule_dependencies enable row level security"));
assert("photo bucket is private", sql.includes("'job-photos'") && sql.includes("false"));
assert("photos are not granted delete", !/grant delete on table public\.photos/i.test(sql));
assert("photo update is limited to status and caption", sql.includes("grant update (status, caption) on table public.photos"));
assert("storage select requires the photo helper", sql.includes("project_photo_object_allowed"));
assert("no storage delete policy", !/job_photos_delete/i.test(sql));
assert("dependency cycle is rejected", sql.includes("Schedule dependency would create a cycle"));
assert("predecessor must share the job", sql.includes("Predecessor must be on the same job"));
assert("report source must share the job", sql.includes("tasks_require_same_job_report"));
assert("source report is not a required task", sql.includes("on delete set null"));
assert("align functions are revoked from authenticated", sql.includes("revoke all on function public.photos_align_from_report() from authenticated"));

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("core job schema ok");
