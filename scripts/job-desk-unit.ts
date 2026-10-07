/**
 * Slice 2 — Job Desk presentation, Ask composer, and local greeting.
 * Does not call Supabase or the model.
 */

import { askComposerKeyIntent, shouldSubmitAskQuestion } from "@/lib/ask-composer";
import type { DocumentRecord } from "@/lib/document-types";
import type { FieldLogRecord } from "@/lib/field-log-types";
import { buildJobDesk, JOB_DESK_LIST_CAP } from "@/lib/job-desk";
import { greetingForHour } from "@/lib/time-greeting";
import type { TaskRecord } from "@/lib/task-types";

let failed = 0;
function assert(name: string, condition: boolean) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`PASS ${name}`);
}

const PROJECT = "3fb9aa08-44ae-49bb-80f3-2809b8cb5f4f";
const COMPANY = "b3899021-1203-47b7-8475-4c525bf9d4af";

function task(partial: Partial<TaskRecord> & Pick<TaskRecord, "id" | "title" | "status">): TaskRecord {
  return {
    company_id: COMPANY,
    project_id: PROJECT,
    description: null,
    assigned_to: null,
    due_date: null,
    priority: null,
    ai_suggested: false,
    created_at: "2026-10-01T00:00:00.000Z",
    completed_at: null,
    ...partial,
  };
}

function log(partial: Partial<FieldLogRecord> & Pick<FieldLogRecord, "id">): FieldLogRecord {
  return {
    company_id: COMPANY,
    project_id: PROJECT,
    created_by: null,
    created_by_name: null,
    log_date: "2026-10-01",
    notes: null,
    issue_flag: false,
    created_at: "2026-10-01T00:00:00.000Z",
    ...partial,
  };
}

function document(id: string): DocumentRecord {
  return {
    id,
    company_id: COMPANY,
    project_id: PROJECT,
    filename: `${id}.pdf`,
    storage_path: `${COMPANY}/${PROJECT}/${id}/${id}.pdf`,
    document_type: "plans",
    uploaded_by: null,
    uploaded_by_name: null,
    created_at: "2026-10-02T15:00:00.000Z",
    content_type: "application/pdf",
    byte_size: 1200,
    sha256: "a".repeat(64),
    status: "ready",
  };
}

assert("hour 4 is evening", greetingForHour(4) === "Good evening");
assert("hour 5 is morning", greetingForHour(5) === "Good morning");
assert("hour 11 is morning", greetingForHour(11) === "Good morning");
assert("hour 12 is afternoon", greetingForHour(12) === "Good afternoon");
assert("hour 16 is afternoon", greetingForHour(16) === "Good afternoon");
assert("hour 17 is evening", greetingForHour(17) === "Good evening");
assert("hour 23 is evening", greetingForHour(23) === "Good evening");

assert("enter submits", askComposerKeyIntent("Enter", false) === "submit");
assert("shift enter is newline", askComposerKeyIntent("Enter", true) === "newline");
assert("other keys pass through", askComposerKeyIntent("a", false) === "default");
assert("question submits", shouldSubmitAskQuestion("When is inspection?", false));
assert("blank does not submit", !shouldSubmitAskQuestion("   ", false));
assert("empty does not submit", !shouldSubmitAskQuestion("", false));
assert("pending blocks submit", !shouldSubmitAskQuestion("When is inspection?", true));

const today = new Date();
today.setHours(0, 0, 0, 0);
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);
const due = yesterday.toISOString().slice(0, 10);

const open = task({ id: "open", title: "Set door hardware", status: "open", priority: "medium" });
const overdueHigh = task({
  id: "overdue",
  title: "Call inspector",
  status: "in_progress",
  priority: "high",
  due_date: due,
});
const high = task({
  id: "high",
  title: "Confirm tile",
  status: "open",
  priority: "high",
  due_date: "2099-01-01",
});
const done = task({ id: "done", title: "Finished", status: "done", priority: "high", due_date: due });
const flagged = log({ id: "flag", issue_flag: true, notes: "Water at the west wall.", log_date: "2026-10-04" });
const plain = log({ id: "plain", notes: "Crew on site.", log_date: "2026-10-03" });

const desk = buildJobDesk({
  tasks: [done, open, overdueHigh, high],
  fieldLogs: [flagged, plain],
  documents: [document("sheet")],
});

assert("done work is not an open item", desk.openItems.every((item) => item.id !== "done"));
assert("open items keep incomplete work", desk.openItems.map((item) => item.id).join(",") === "open,overdue,high");
assert("overdue item needs attention", desk.attention.overdue.some((item) => item.id === "overdue"));
assert("overdue high item is not listed twice", !desk.attention.highPriority.some((item) => item.id === "overdue"));
assert("other high item needs attention", desk.attention.highPriority.some((item) => item.id === "high"));
assert("flagged daily log needs attention", desk.attention.flaggedLogs.some((item) => item.id === "flag"));
assert("unflagged log stays in recent logs", desk.recentLogs.some((item) => item.id === "plain"));
assert("ready file remains available", desk.documents[0]?.filename === "sheet.pdf");
assert("desk has attention", desk.hasAttention);
assert("view has no weather field", !("weather" in desk));
assert("view has no cost field", !("cost" in desk));

const many = buildJobDesk({
  tasks: Array.from({ length: JOB_DESK_LIST_CAP + 3 }, (_, index) =>
    task({ id: `t${index}`, title: `Item ${index}`, status: "open" }),
  ),
  fieldLogs: [],
  documents: [],
});
assert("open item list is capped", many.openItems.length === JOB_DESK_LIST_CAP);
assert("open item count keeps the full number", many.openItemCount === JOB_DESK_LIST_CAP + 3);

const quiet = buildJobDesk({ tasks: [done], fieldLogs: [plain], documents: [] });
assert("quiet job has no fabricated attention", !quiet.hasAttention);
assert("quiet job still shows the daily log", quiet.recentLogs.length === 1);
assert("quiet job has no files", quiet.documentCount === 0);

if (failed > 0) {
  console.error(`job-desk-unit: ${failed} failed`);
  process.exit(1);
}
console.log("job-desk-unit: ok");
