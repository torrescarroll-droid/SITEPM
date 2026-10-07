import type { DocumentRecord } from "@/lib/document-types";
import type { FieldLogRecord } from "@/lib/field-log-types";
import type { PhotoRecord } from "@/lib/photo-types";
import { localTodayIso, summarizeSchedule } from "@/lib/schedule-logic";
import type { ScheduleActivity } from "@/lib/schedule-types";
import { taskIsOverdue, type TaskRecord } from "@/lib/task-types";

export const JOB_DESK_LIST_CAP = 8;

export type JobDeskAttention = {
  overdue: TaskRecord[];
  highPriority: TaskRecord[];
  flaggedLogs: FieldLogRecord[];
};

export type JobDeskView = {
  openItems: TaskRecord[];
  openItemCount: number;
  recentLogs: FieldLogRecord[];
  logCount: number;
  documents: DocumentRecord[];
  documentCount: number;
  attention: JobDeskAttention;
  hasAttention: boolean;
  schedule: ReturnType<typeof summarizeSchedule> & { activityCount: number };
  recentPhotos: PhotoRecord[];
};

function cap<T>(items: T[]) {
  return items.slice(0, JOB_DESK_LIST_CAP);
}

/**
 * Arrange records the job page already loaded. Does not fetch, rank by
 * model, or invent schedule, weather, or cost.
 */
export function buildJobDesk(input: {
  tasks: TaskRecord[];
  fieldLogs: FieldLogRecord[];
  documents: DocumentRecord[];
  activities?: ScheduleActivity[];
  photos?: PhotoRecord[];
  today?: string;
}): JobDeskView {
  const activities = input.activities ?? [];
  const scheduleSummary = summarizeSchedule(activities, input.today ?? localTodayIso());
  const openItems = input.tasks.filter((task) => task.status !== "done");
  const overdue = openItems.filter(taskIsOverdue);
  const overdueIds = new Set(overdue.map((task) => task.id));
  const highPriority = openItems.filter(
    (task) => task.priority === "high" && !overdueIds.has(task.id),
  );
  const flaggedLogs = input.fieldLogs.filter((log) => log.issue_flag);
  const attention = {
    overdue: cap(overdue),
    highPriority: cap(highPriority),
    flaggedLogs: cap(flaggedLogs),
  };

  return {
    openItems: cap(openItems),
    openItemCount: openItems.length,
    recentLogs: cap(input.fieldLogs),
    logCount: input.fieldLogs.length,
    documents: cap(input.documents),
    documentCount: input.documents.length,
    attention,
    hasAttention:
      overdue.length > 0 ||
      highPriority.length > 0 ||
      flaggedLogs.length > 0 ||
      scheduleSummary.late.length > 0,
    schedule: { ...scheduleSummary, activityCount: activities.length },
    recentPhotos: cap(input.photos ?? []),
  };
}
