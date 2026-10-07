/**
 * Core Job Operations v0.1 — schedule, daily report, photos, evidence.
 * Does not call Supabase or the model.
 */

import { ASK_SYSTEM_PROMPT } from "@/lib/ai/provider";
import { assembleAskEvidencePack, fieldLogEvidenceItem, scheduleEvidenceItem } from "@/lib/ask-evidence";
import { answerNextScheduledWork, questionAsksNextScheduledWork } from "@/lib/ask-schedule";
import { parseCrewRows, formatCrewLine, reportHasSubstance } from "@/lib/daily-report";
import { buildJobDesk } from "@/lib/job-desk";
import { detectPhoto, photoObjectAllowed } from "@/lib/photo-types";
import {
  activityIsCurrent,
  activityIsLate,
  dependencyWouldCycle,
  finishFromDuration,
  summarizeSchedule,
} from "@/lib/schedule-logic";
import type { ScheduleActivity } from "@/lib/schedule-types";
import type { ProjectRecord } from "@/lib/projects";
import type { FieldLogRecord } from "@/lib/field-log-types";
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

assert("1-day duration finishes on the start date", finishFromDuration("2026-10-06", 1) === "2026-10-06");
assert("3-day duration is inclusive", finishFromDuration("2026-10-06", 3) === "2026-10-08");
assert("bad duration is rejected", finishFromDuration("2026-10-06", 0) === null);

const base = {
  company_id: "c",
  project_id: "p",
  notes: null,
  trade_name: "Plumbing",
  is_milestone: false,
  sort_order: 0,
  created_by: null,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
  predecessor_id: null,
  predecessor_name: null,
} satisfies Omit<ScheduleActivity, "id" | "name" | "start_date" | "finish_date" | "status">;

function activity(
  partial: Pick<ScheduleActivity, "id" | "name" | "status"> &
    Partial<ScheduleActivity>,
): ScheduleActivity {
  return {
    ...base,
    start_date: "2026-10-01",
    finish_date: "2026-10-02",
    ...partial,
  };
}

const today = "2026-10-06";
const late = activity({
  id: "late",
  name: "Primary Bath Rough Plumbing",
  status: "in_progress",
  finish_date: "2026-10-04",
});
const current = activity({
  id: "current",
  name: "Primary Bath Waterproofing",
  status: "not_started",
  start_date: "2026-10-06",
  finish_date: "2026-10-07",
});
const upcoming = activity({
  id: "next",
  name: "Primary Bath Tile",
  status: "not_started",
  start_date: "2026-10-10",
  finish_date: "2026-10-12",
  predecessor_id: "flood",
  predecessor_name: "Primary Bath Flood Test",
});
const held = activity({
  id: "held",
  name: "Held work",
  status: "held",
  finish_date: "2026-10-01",
});

assert("finish before today is late", activityIsLate(late, today));
assert("held work is not late", !activityIsLate(held, today));
assert("in-progress dated today is current", activityIsCurrent(current, today));
assert("late work is not also current", !activityIsCurrent(late, today));

const summary = summarizeSchedule([late, current, upcoming, held], today);
assert("summary separates late current upcoming", summary.late.length === 1 && summary.current.length === 1 && summary.upcoming[0]?.name === "Primary Bath Tile");

assert(
  "self predecessor cycles",
  dependencyWouldCycle([], "tile", "tile"),
);
assert(
  "a chain back to the activity cycles",
  dependencyWouldCycle(
    [
      { activityId: "water", predecessorId: "plumb" },
      { activityId: "flood", predecessorId: "water" },
    ],
    "plumb",
    "flood",
  ),
);
assert(
  "a forward predecessor does not cycle",
  !dependencyWouldCycle(
    [{ activityId: "water", predecessorId: "plumb" }],
    "tile",
    "flood",
  ),
);

const crews = parseCrewRows(
  (() => {
    const form = new FormData();
    form.append("crew_company", "Martinez Drywall");
    form.append("crew_trade", "Drywall");
    form.append("crew_count", "4");
    form.append("crew_company", "");
    form.append("crew_trade", "Painting");
    form.append("crew_count", "2");
    form.append("crew_company", "");
    form.append("crew_trade", "");
    form.append("crew_count", "");
    return form;
  })(),
);
assert("crew allows a trade without a company", crews.length === 2 && crews[1]?.companyName === null && crews[1]?.tradeName === "Painting");
assert(
  "crew line names company trade and count",
  formatCrewLine(crews[0]!) === "Martinez Drywall — Drywall — 4 workers",
);
assert(
  "missing trade is rejected",
  (() => {
    const form = new FormData();
    form.append("crew_company", "ABC");
    form.append("crew_trade", "");
    form.append("crew_count", "2");
    try {
      parseCrewRows(form);
      return false;
    } catch {
      return true;
    }
  })(),
);
assert(
  "work performed is enough to save a report",
  reportHasSubstance({
    notes: null,
    workPerformed: "Hung drywall",
    delays: null,
    deliveries: null,
  }),
);
assert(
  "an empty report is not enough",
  !reportHasSubstance({ notes: "  ", workPerformed: null, delays: null, deliveries: null }),
);

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);
assert("jpeg magic is accepted", detectPhoto(jpeg)?.mime === "image/jpeg");
assert("png magic is accepted", detectPhoto(png)?.mime === "image/png");
assert("webp magic is accepted", detectPhoto(webp)?.mime === "image/webp");
assert("pdf bytes are rejected", detectPhoto(new Uint8Array([0x25, 0x50, 0x44, 0x46])) === null);
assert(
  "photo path must match company and job",
  photoObjectAllowed("company/job/photo/photo.jpg", "company", "job") &&
    !photoObjectAllowed("other/job/photo/photo.jpg", "company", "job"),
);

const desk = buildJobDesk({
  tasks: [],
  fieldLogs: [],
  documents: [],
  activities: [late, upcoming],
  today,
});
assert("late schedule needs attention", desk.hasAttention && desk.schedule.late.length === 1);
const quiet = buildJobDesk({ tasks: [], fieldLogs: [], documents: [], today });
assert("missing schedule does not invent attention", !quiet.hasAttention && quiet.schedule.activityCount === 0);

const log: FieldLogRecord = {
  id: "report",
  company_id: "company",
  project_id: "job",
  created_by: "user",
  created_by_name: "Romulo",
  log_date: "2026-10-06",
  notes: null,
  work_performed: "Drywall crew completed upstairs hanging except primary bath.",
  delays: "Primary bath work held pending plumbing valve completion.",
  deliveries: "Tile delivery received.",
  tomorrow: "Complete remaining drywall.",
  issue_flag: false,
  created_at: "2026-10-06T00:00:00.000Z",
  crews: [
    {
      id: "crew",
      field_log_id: "report",
      company_name: "Martinez Drywall",
      trade_name: "Drywall",
      worker_count: 4,
    },
  ],
};
const item = fieldLogEvidenceItem("job", log, ["Valve photo"]);
assert(
  "report evidence includes crew delay and caption",
  item.data.crews === "Martinez Drywall — Drywall — 4 workers" &&
    item.data.delays === log.delays &&
    item.data.photo_captions === "Valve photo" &&
    !("storage_path" in item.data),
);
const scheduled = scheduleEvidenceItem("job", upcoming);
assert("schedule evidence keeps its own source type", scheduled.sourceType === "schedule_activity");
assert(
  "a to-do linked from a report stays a task",
  fieldLogEvidenceItem("job", log).sourceType === "field_log",
);

const project: ProjectRecord = {
  id: "job",
  company_id: "company",
  name: "250 Sea Cliff",
  client_name: null,
  address: null,
  status: "active",
  start_date: null,
  target_completion_date: null,
  description: null,
};
const pack = assembleAskEvidencePack({
  project,
  tasks: [],
  fieldLogs: [log],
  documents: [],
  activities: [upcoming],
  photos: [
    {
      id: "photo",
      company_id: "company",
      project_id: "job",
      field_log_id: "report",
      caption: "Jobsite",
      content_type: "image/jpeg",
      byte_size: 10,
      uploaded_by: "user",
      created_at: "2026-10-06T00:00:00.000Z",
      status: "ready",
    },
  ],
});
assert(
  "assembled evidence has no storage path",
  pack.evidence.every((entry) => !("storage_path" in entry.data) && !("company_id" in entry.data)),
);
assert(
  "assembled evidence includes the schedule activity",
  pack.evidence.some((entry) => entry.sourceType === "schedule_activity"),
);

assert("scheduled next is a schedule question", questionAsksNextScheduledWork("What is scheduled next?"));
assert("next on the schedule is a schedule question", questionAsksNextScheduledWork("What is next on the schedule?"));
assert("next scheduled work is a schedule question", questionAsksNextScheduledWork("What is the next scheduled work?"));
assert("an open to-do question is not a schedule question", !questionAsksNextScheduledWork("What to-dos are open?"));
assert("the next to-do is not a schedule question", !questionAsksNextScheduledWork("What is the next to-do?"));
assert(
  "a predecessor question is not a next-scheduled question",
  !questionAsksNextScheduledWork("What needs to happen before tile?"),
);

const framing = activity({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Wall framing",
  status: "in_progress",
  start_date: "2026-09-29",
  finish_date: "2026-10-08",
  trade_name: "Framing",
  sort_order: 1,
});
const membrane = activity({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Membrane",
  status: "not_started",
  start_date: "2026-10-09",
  finish_date: "2026-10-10",
  trade_name: "Waterproofing",
  sort_order: 2,
  predecessor_id: framing.id,
  predecessor_name: framing.name,
});
const sameDayLater = activity({
  id: "33333333-3333-4333-8333-333333333333",
  name: "Same-day later trade",
  status: "not_started",
  start_date: "2026-10-09",
  finish_date: "2026-10-09",
  sort_order: 9,
});
const surface = activity({
  id: "44444444-4444-4444-8444-444444444444",
  name: "Surface finish",
  status: "not_started",
  start_date: "2026-10-14",
  finish_date: "2026-10-17",
  trade_name: "Finish",
  sort_order: 4,
  predecessor_id: membrane.id,
  predecessor_name: membrane.name,
});
const paused = activity({
  id: "55555555-5555-4555-8555-555555555555",
  name: "Paused delivery",
  status: "held",
  start_date: "2026-10-07",
  finish_date: "2026-10-07",
  sort_order: 0,
});
const overdueTodo: TaskRecord = {
  id: "66666666-6666-4666-8666-666666666666",
  company_id: "company",
  project_id: "job",
  title: "Inspect equipment",
  description: "Overdue follow-up",
  assigned_to: null,
  due_date: "2026-09-24",
  priority: "medium",
  status: "open",
  ai_suggested: false,
  created_at: "2026-09-01T00:00:00.000Z",
  completed_at: null,
};
const soonerTodo: TaskRecord = {
  ...overdueTodo,
  id: "77777777-7777-4777-8777-777777777777",
  title: "Order fittings",
  description: "Due before the next activity starts",
  due_date: "2026-10-07",
};
const mixed = assembleAskEvidencePack({
  project,
  tasks: [overdueTodo, soonerTodo],
  fieldLogs: [],
  documents: [],
  activities: [surface, paused, membrane, sameDayLater, framing],
  today,
});
const nextEvidence = mixed.evidence.find((entry) => entry.data.schedule_position === "next");
const overdueEvidence = mixed.evidence.find((entry) => entry.sourceId === overdueTodo.id);
const membraneEvidence = mixed.evidence.find((entry) => entry.sourceId === membrane.id);
assert(
  "next schedule position is the earliest upcoming activity",
  nextEvidence?.sourceId === membrane.id && nextEvidence.sourceType === "schedule_activity",
);
assert(
  "a same-day later activity does not take the next position",
  mixed.evidence.find((entry) => entry.sourceId === sameDayLater.id)?.data.schedule_position === "upcoming",
);
assert(
  "held work is not the next scheduled activity",
  mixed.evidence.find((entry) => entry.sourceId === paused.id)?.data.schedule_position === "held",
);
assert(
  "an overdue to-do stays a task",
  overdueEvidence?.sourceType === "task" && overdueEvidence.data.schedule_position === undefined,
);
assert(
  "schedule evidence keeps the predecessor",
  membraneEvidence?.data.predecessor_name === framing.name &&
    membraneEvidence.sourceType === "schedule_activity",
);
const scheduledNext = answerNextScheduledWork("What is scheduled next?", mixed);
assert(
  "scheduled next cites the next activity and not a to-do",
  scheduledNext?.citations.length === 1 &&
    scheduledNext.citations[0]?.type === "schedule_activity" &&
    scheduledNext.citations[0]?.id === membrane.id &&
    scheduledNext.epistemicKind === "documented_fact" &&
    scheduledNext.answer.includes("Membrane") &&
    !scheduledNext.answer.includes(overdueTodo.title) &&
    !scheduledNext.answer.includes(soonerTodo.title),
);
assert(
  "a to-do question still leaves task evidence on the normal path",
  answerNextScheduledWork("What to-dos are open?", mixed) === null &&
    mixed.evidence.some((entry) => entry.sourceType === "task" && entry.sourceId === overdueTodo.id),
);
assert(
  "a dependency question stays on the normal path with schedule evidence",
  answerNextScheduledWork("What needs to happen before tile?", mixed) === null &&
    membraneEvidence?.sourceType === "schedule_activity",
);
assert(
  "schedule prompt calls activities activities",
  ASK_SYSTEM_PROMPT.includes("Call it an activity or scheduled work. Do not call it a task.") &&
    ASK_SYSTEM_PROMPT.includes("A to-do due date is not the job schedule."),
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("core job unit ok");
