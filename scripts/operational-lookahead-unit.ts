import assert from "node:assert/strict";
import { buildOperationalLookahead, validCalendarDate } from "@/lib/operational-lookahead";
import type { TaskRecord } from "@/lib/task-types";
import type { FieldLogRecord } from "@/lib/field-log-types";
import type { ScheduleActivity } from "@/lib/schedule-types";
import type { PhotoRecord } from "@/lib/photo-types";

const scope = { company_id: "company-a", project_id: "job-a" };
const stamp = "2026-10-01T12:00:00Z";
const task = (id: string, more: Partial<TaskRecord> = {}): TaskRecord => ({
  ...scope, id, title: id, description: null, assigned_to: null, due_date: null,
  priority: "medium", status: "open", ai_suggested: false, created_at: stamp, completed_at: null, ...more,
});
const report = (id: string, more: Partial<FieldLogRecord> = {}): FieldLogRecord => ({
  ...scope, id, created_by: null, created_by_name: null, log_date: "2026-10-07",
  notes: null, issue_flag: true, created_at: stamp, ...more,
});
const activity = (id: string, more: Partial<ScheduleActivity> = {}): ScheduleActivity => ({
  ...scope, id, name: id, notes: null, start_date: "2026-10-07", finish_date: "2026-10-08", status: "not_started",
  trade_name: null, is_milestone: false, sort_order: 0, created_by: null, created_at: stamp, updated_at: stamp,
  predecessor_id: null, predecessor_name: null, ...more,
});
const photo = (id: string, more: Partial<PhotoRecord> = {}): PhotoRecord => ({
  ...scope, id, field_log_id: "uncovered", caption: null, content_type: "image/jpeg", byte_size: 100,
  uploaded_by: null, created_at: stamp, status: "ready", ...more,
});
const data = {
  companyId: scope.company_id, projectId: scope.project_id, today: "2026-10-07",
  tasks: [task("late", { due_date: "2026-10-06", trade_name: "Plumbing", responsible_name: "Lee" }),
    task("edge", { due_date: "2026-10-20", trade_name: " plumbing " }), task("beyond", { due_date: "2026-10-21" }),
    task("finished", { status: "done", due_date: "2026-10-01", source_field_log_id: "completed" }),
    task("undated", { source_field_log_id: "open" }), task("future-owner", { due_date: "2026-12-01", responsible_name: " " }),
    task("foreign", { company_id: "company-b", source_field_log_id: "uncovered" }),
    task("other-job", { project_id: "job-b", source_field_log_id: "uncovered" })],
  reports: [report("uncovered"), report("completed"), report("open"), report("quiet", { issue_flag: false }),
    report("delay", { issue_flag: false, delays: "Material missing" }), report("future", { log_date: "2026-12-01", issue_flag: false }),
    report("foreign-report", { company_id: "company-b" }), report("other-report", { project_id: "job-b" })],
  activities: [activity("current", { status: "in_progress", trade_name: "PLUMBING" }),
    activity("edge", { start_date: "2026-10-20", finish_date: "2026-10-22", predecessor_id: "current" }),
    activity("future", { start_date: "2026-10-21", finish_date: "2026-10-23" }),
    activity("held", { status: "held", start_date: null, finish_date: null }),
    activity("late", { finish_date: "2026-10-06", predecessor_id: "finished" }),
    activity("finished", { status: "done" }), activity("unknown", { predecessor_id: "foreign-activity" }),
    activity("foreign-activity", { company_id: "company-b", status: "done" }), activity("other-job", { project_id: "job-b" })],
  photos: [photo("ready"), photo("pending", { status: "pending" }), photo("failed", { status: "failed" }),
    photo("foreign", { company_id: "company-b" }), photo("other-job", { project_id: "job-b" })],
};
const before = JSON.stringify(data);
const view = buildOperationalLookahead(data);
assert.equal(view.through, "2026-10-20");
assert.deepEqual(view.dueTasks.map((item) => item.id), ["late", "edge"]);
assert.equal(view.taskProgress.total, 6);
assert.equal(view.taskProgress.done, 1);
assert.equal(view.scheduleProgress.total, 7);
assert.equal(view.scheduleProgress.done, 1);
assert.equal(view.activities.find((item) => item.activity.id === "edge")?.predecessorPending, true);
assert.equal(view.activities.find((item) => item.activity.id === "late")?.predecessorPending, false);
assert.equal(view.activities.find((item) => item.activity.id === "late")?.late, true);
assert.equal(view.activities.find((item) => item.activity.id === "unknown")?.predecessorName, "Unavailable predecessor");
assert(view.activities.some((item) => item.activity.id === "held"));
assert(!view.activities.some((item) => item.activity.id === "future"));
assert.equal(view.reportFollowUps.find((item) => item.report.id === "uncovered")?.state, "needs_action");
assert.equal(view.reportFollowUps.find((item) => item.report.id === "completed")?.state, "completed");
assert.equal(view.reportFollowUps.find((item) => item.report.id === "open")?.state, "open");
assert.equal(view.reportFollowUps.find((item) => item.report.id === "uncovered")?.photoCount, 1);
assert(view.reportFollowUps.some((item) => item.report.id === "delay"));
assert(!view.reportFollowUps.some((item) => item.report.id === "quiet"));
assert.equal(view.latestReport?.log_date, "2026-10-07");
assert.equal(view.trades.filter((item) => item.name.toLowerCase() === "plumbing").length, 1);
assert.equal(view.trades.find((item) => item.name.toLowerCase() === "plumbing")?.tasks.length, 2);
assert(view.unassigned.some((item) => item.id === "future-owner"));
assert.deepEqual(view.undated.map((item) => item.id), ["undated"]);
assert.equal(JSON.stringify(data), before, "derived views must not mutate evidence");
assert(validCalendarDate("2028-02-29"));
for (const invalid of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-10-7", "garbage"]) assert(!validCalendarDate(invalid));
assert.throws(() => buildOperationalLookahead({ ...data, today: "2026-02-30" }));
assert.equal(buildOperationalLookahead({ ...data, today: "2026-12-25" }).through, "2027-01-07");
const empty = buildOperationalLookahead({ ...data, tasks: [], reports: [], activities: [], photos: [] });
assert.equal(empty.latestReport, null);
assert.deepEqual(empty.trades, []);
assert.equal(empty.taskProgress.total, 0);
console.log("operational lookahead: date boundaries, follow-through, evidence, trades, progress, company/project isolation and empty state passed");
