import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createJiti } from "jiti";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": root }, fsCache: false });
const dates = await jiti.import("../lib/operational-lookahead.ts");

// Execute the actual action module with a recording database boundary. Never contacts hosted data.
function harness({ company = "company-a", project = { id: "job-a" }, task = null, report = { id: "report-a" }, writeError = null, writeRows = [{ id: "saved" }] } = {}) {
  const calls = [];
  const revalidated = [];
  const supabase = { from(table) {
    const call = { table, filters: [], operation: "select", payload: null };
    calls.push(call);
    const query = {
      select() { return query; },
      eq(key, value) { call.filters.push([key, value]); return query; },
      insert(payload) { call.operation = "insert"; call.payload = payload; return query; },
      update(payload) { call.operation = "update"; call.payload = payload; return query; },
      maybeSingle() { return Promise.resolve({ data: report, error: null }); },
      then(resolve, reject) { return Promise.resolve({ data: writeRows, error: writeError }).then(resolve, reject); },
    };
    return query;
  } };
  const module = { exports: {} };
  const mocks = {
    "next/cache": { revalidatePath: (...args) => revalidated.push(args) },
    "@/lib/auth-context": { requireCompanyContext: async () => ({ supabase, profile: company ? { company_id: company } : null }) },
    "@/lib/projects": { findAuthorizedProject: async () => project },
    "@/lib/tasks": { getAuthorizedTask: async () => task },
    "@/lib/operational-lookahead": dates,
  };
  const output = ts.transpileModule(readFileSync(join(root, "lib/task-actions.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(output, { module, exports: module.exports, require: (name) => {
    assert(name in mocks, `Unexpected action dependency ${name}`); return mocks[name];
  }, Date });
  return { actions: module.exports, calls, revalidated };
}
const form = (values) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
const values = { project_id: "job-a", title: "Confirm delivery", source_field_log_id: "report-a", responsible_name: "Lee", due_date: "2026-10-20", trade_name: "Plumbing", company_id: "company-b" };
let h = harness();
assert.equal((await h.actions.createTask({}, form(values))).error, null);
assert.deepEqual(h.calls[0].filters, [["id", "report-a"], ["company_id", "company-a"], ["project_id", "job-a"]]);
assert.equal(h.calls[1].payload.company_id, "company-a", "forged company ignored");
assert.equal(h.calls[1].payload.source_field_log_id, "report-a");
assert.equal(h.calls[1].payload.responsible_name, "Lee");
assert(h.revalidated.some(([path]) => path === "/projects/job-a/lookahead"));
for (const options of [{ report: null }, { project: null }, { company: null }]) {
  h = harness(options);
  assert((await h.actions.createTask({}, form(values))).error);
  assert(!h.calls.some((call) => call.operation === "insert"));
}
h = harness();
assert((await h.actions.createTask({}, form({ ...values, due_date: "2026-02-30" }))).error);
assert.equal(h.calls.length, 0);
assert((await h.actions.createTask({}, form({ ...values, title: " " }))).error);
h = harness({ writeError: { message: "DB refused write" } });
assert((await h.actions.createTask({}, form(values))).error);
assert.equal(h.revalidated.length, 0);
const task = { id: "task-a", project_id: "job-a", company_id: "company-a", status: "open", completed_at: null };
h = harness({ task });
assert.equal((await h.actions.changeTaskStatus({}, form({ task_id: "task-a", status: "done" }))).error, null);
assert.deepEqual(h.calls[0].filters, [["id", "task-a"], ["company_id", "company-a"], ["project_id", "job-a"], ["status", "open"]]);
assert(h.calls[0].payload.completed_at);
h = harness({ task: { ...task, status: "done", completed_at: "original-timestamp" } });
await h.actions.changeTaskStatus({}, form({ task_id: "task-a", status: "done" }));
assert.equal(h.calls[0].payload.completed_at, "original-timestamp");
h = harness({ task: { ...task, status: "done", completed_at: "original-timestamp" } });
await h.actions.changeTaskStatus({}, form({ task_id: "task-a", status: "open" }));
assert.equal(h.calls[0].payload.completed_at, null);
for (const options of [{ task: null }, { task: { ...task, company_id: "company-b" } }, { company: null, task }]) {
  h = harness(options);
  assert((await h.actions.changeTaskStatus({}, form({ task_id: "task-a", status: "done" }))).error);
  assert.equal(h.calls.length, 0);
}
for (const options of [{ task, writeRows: [] }, { task, writeError: { message: "denied" } }]) {
  h = harness(options);
  assert((await h.actions.changeTaskStatus({}, form({ task_id: "task-a", status: "done" }))).error);
  assert.equal(h.revalidated.length, 0);
}
h = harness({ task });
assert((await h.actions.changeTaskStatus({}, form({ task_id: "task-a", status: "invalid" }))).error);
assert.equal(h.calls.length, 0);
console.log("operational actions: actual server actions passed authorization, scoped queries, persistence payloads, validation, failed writes, stale writes and completion/reopen tests");
h = harness({ task });
assert.equal((await h.actions.updateTask({}, form({ task_id: "task-a", title: "Revised", responsible_name: "Lee", due_date: "2026-10-20", status: "done" }))).error, null);
assert.equal(h.calls[0].payload.responsible_name, "Lee");
assert.equal(h.calls[0].payload.due_date, "2026-10-20");
assert(h.calls[0].filters.some(([key, value]) => key === "company_id" && value === "company-a"));
h = harness({ task, writeRows: [] });
assert((await h.actions.updateTask({}, form({ task_id: "task-a", title: "Revised" }))).error);
assert.equal(h.revalidated.length, 0);
h = harness({ task });
assert((await h.actions.updateTask({}, form({ task_id: "task-a", title: "Revised", due_date: "2026-02-30" }))).error);
assert.equal(h.calls.length, 0);
console.log("task editing: owner/date persistence, invalid dates and zero-row writes passed");
