import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url, {
  alias: { "@": process.cwd() },
  fsCache: false,
});
const cal = await jiti.import("../lib/construction-calendar.ts");
const dates = await jiti.import("../lib/operational-lookahead.ts");
const types = await jiti.import("../lib/schedule-types.ts");
assert.equal(cal.calendarDays("2026-10-08", "month").length, 42);
assert.equal(cal.calendarDays("2026-10-08", "week")[0], "2026-10-05");
assert.deepEqual(cal.calendarDays("2026-10-08", "day"), ["2026-10-08"]);
assert.equal(cal.navigateDate("2026-01-31", "month", 1), "2026-02-01");
assert.equal(cal.addDays("2028-02-28", 1), "2028-02-29");
assert.equal(cal.addDays("2026-03-08", 1), "2026-03-09");
assert.equal(cal.tradeColor("Electrical"), cal.tradeColor(" electrical "));
const base = {
  id: "a",
  company_id: "a",
  project_id: "one",
  status: "confirmed",
  trade_name: "Electrical",
  start_date: "2026-10-08",
  finish_date: "2026-10-09",
  start_at: "2026-10-08T14:00:00Z",
  finish_at: "2026-10-08T22:00:00Z",
  assignments: [{ resource_id: "crew", expected_workers: 3 }],
};
assert(cal.activityOnDay(base, "2026-10-09"));
const timed = {
  ...base,
  all_day: false,
  start_time: "07:00",
  finish_time: "15:30",
};
assert.equal(cal.activityTimeLabel(timed, "2026-10-08"), "07:00 → continues");
assert.equal(cal.activityTimeLabel(timed, "2026-10-09"), "Continues → 15:30");
assert(!cal.activityOnDay(base, "2026-10-10"));
assert.equal(
  cal.resourceOverlaps([base, { ...base, id: "b", project_id: "two" }]).length,
  1,
);
assert.equal(
  cal.resourceOverlaps([base, { ...base, id: "b", company_id: "b" }]).length,
  0,
);
assert.equal(
  cal.resourceOverlaps([
    base,
    {
      ...base,
      id: "b",
      start_at: base.finish_at,
      finish_at: "2026-10-09T01:00:00Z",
    },
  ]).length,
  0,
);
assert.equal(
  cal.resourceOverlaps([base, { ...base, id: "b", status: "cancelled" }])
    .length,
  0,
);
console.log(
  "PASS month/week/day boundaries, leap/DST-safe date math, stable trade colors, inclusive multi-day rendering and potential overlap scope/adjacency/cancellation",
);
assert.deepEqual(
  cal.scheduleHistoryLines(
    {
      change_type: "assignment_insert",
      after_record: { resource_id: "crew", expected_workers: 3 },
    },
    () => "Electrical crew",
    () => "",
  ),
  ["Assigned: Electrical crew · 3 workers expected"],
);
assert(
  cal
    .scheduleHistoryLines(
      {
        change_type: "update",
        before_record: { status: "confirmed" },
        after_record: { status: "cancelled" },
      },
      () => "",
      () => "",
    )[0]
    .includes("Cancelled"),
);
const id = "11111111-1111-4111-8111-111111111111";
const record = {
  id,
  project_id: id,
  name: "Inspection",
  start_date: "2026-10-08",
  finish_date: "2026-10-08",
  all_day: true,
  timezone: "America/Los_Angeles",
  status: "confirmed",
  activity_type: "inspection",
  assignments: [],
};
function harness(
  result = { data: { id, revision: 1 }, error: null },
  throws = false,
) {
  const calls = [],
    paths = [],
    module = { exports: {} };
  const mocks = {
    "next/cache": { revalidatePath: (p) => paths.push(p) },
    "@/lib/auth-context": {
      requireCompanyContext: async () => ({
        profile: { company_id: "company" },
        supabase: {
          rpc: async (...args) => {
            calls.push(args);
            if (throws) throw Error("transport");
            return result;
          },
        },
      }),
    },
    "@/lib/operational-lookahead": dates,
    "@/lib/schedule-types": types,
  };
  runInNewContext(
    ts.transpileModule(readFileSync("lib/schedule-actions.ts", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { module, exports: module.exports, require: (n) => mocks[n] },
  );
  return { save: module.exports.saveScheduleRecord, calls, paths };
}
function form(r = record) {
  const f = new FormData();
  f.set("kind", "activity");
  f.set("record", JSON.stringify(r));
  f.set("request_id", id);
  return f;
}
let h = harness();
assert.equal((await h.save({}, form())).error, null);
assert.equal(h.calls.length, 1);
assert.equal(h.calls[0][0], "save_construction_schedule");
assert(!("company_id" in h.calls[0][1]));
assert(h.paths.includes("/schedule"));
for (const more of [
  { start_date: "2026-02-30" },
  { finish_date: "2026-10-07" },
  { status: "present" },
  { activity_type: "forecast" },
  { id: "wrong" },
  { name: "" },
]) {
  h = harness();
  assert((await h.save({}, form({ ...record, ...more }))).error);
  assert.equal(h.calls.length, 0);
}
for (const code of ["40001", "42501", "23514", "22023", "P0001", "PGRST202"]) {
  h = harness({ data: null, error: { code, message: "secret details" } });
  const r = await h.save({}, form());
  assert(r.error);
  assert(!r.error.includes("secret details"));
  assert(!r.uncertain);
}
h = harness({}, true);
assert((await h.save({}, form())).uncertain);
h = harness({ data: null, error: null });
assert((await h.save({}, form())).uncertain);
console.log(
  "PASS actual schedule actions: validation before write, single RPC, tenant from authenticated context, sanitized errors, stale rejection and uncertain retry classification",
);

const taskOptions = [{id: "same", project_id: "one", title: "Own task"}, {id: "other", project_id: "two", title: "Other task"}];
assert.deepEqual(cal.scheduleTaskOptions(taskOptions, "one").map(t => t.id), ["same"]);
assert.deepEqual(cal.scheduleTaskOptions(taskOptions, "one", "missing").map(t => t.id), ["same", "missing"]);
assert.equal(cal.scheduleTaskOptions(taskOptions, "one", "same").length, 1);
console.log("PASS task options retain omitted current link without showing another project's task options");
