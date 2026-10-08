import type { FieldLogRecord } from "@/lib/field-log-types";
import type { PhotoRecord } from "@/lib/photo-types";
import type { ScheduleActivity } from "@/lib/schedule-types";
import type { TaskRecord } from "@/lib/task-types";
import { finishFromDuration, localTodayIso } from "@/lib/schedule-logic";

export function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Derived from stored records only. Scope again before joining evidence or trades. */
export function buildOperationalLookahead(input: {
  companyId: string;
  projectId: string;
  tasks: TaskRecord[];
  reports: FieldLogRecord[];
  activities: ScheduleActivity[];
  photos: PhotoRecord[];
  today?: string;
}) {
  const today = input.today ?? localTodayIso();
  if (!validCalendarDate(today)) throw new Error("Invalid lookahead date.");
  const through = finishFromDuration(today, 14)!;
  const inScope = (row: { company_id: string; project_id: string }) =>
    row.company_id === input.companyId && row.project_id === input.projectId;
  const tasks = input.tasks.filter(inScope);
  const reports = input.reports.filter(inScope).sort((a, b) =>
    b.log_date.localeCompare(a.log_date) || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  const allActivities = input.activities.filter(inScope);
  const byActivity = new Map(allActivities.map((activity) => [activity.id, activity]));
  const openTasks = tasks.filter((task) => task.status !== "done");
  const dueTasks = openTasks.filter((task) => task.due_date && task.due_date <= through)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const unassigned = openTasks.filter((task) => !task.responsible_name?.trim());
  const undated = openTasks.filter((task) => !task.due_date);
  const activities = allActivities.filter((activity) => activity.status !== "done" && (
    activity.status === "in_progress" || activity.status === "held" ||
    (activity.start_date != null && activity.start_date <= through) ||
    (activity.finish_date != null && activity.finish_date <= through)
  )).sort((a, b) => (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999") || a.sort_order - b.sort_order || a.id.localeCompare(b.id))
    .map((activity) => {
      const predecessor = activity.predecessor_id ? byActivity.get(activity.predecessor_id) : null;
      return {
        activity,
        late: Boolean(activity.finish_date && activity.finish_date < today),
        predecessorPending: activity.predecessor_id != null && predecessor?.status !== "done",
        predecessorName: predecessor?.name ?? (activity.predecessor_id ? "Unavailable predecessor" : null),
      };
    });
  const reportFollowUps = reports.filter((report) => report.issue_flag || report.delays?.trim()).map((report) => {
    const linkedTasks = tasks.filter((task) => task.source_field_log_id === report.id);
    return {
      report,
      tasks: linkedTasks,
      state: linkedTasks.length === 0 ? "needs_action" as const :
        linkedTasks.some((task) => task.status !== "done") ? "open" as const : "completed" as const,
      photoCount: input.photos.filter((photo) => inScope(photo) && photo.status === "ready" && photo.field_log_id === report.id).length,
    };
  });
  const tradeNames = new Map<string, string>();
  const tradeKey = (name: string | null | undefined) => {
    const label = name?.trim() || "Trade not recorded";
    const key = label.toLocaleLowerCase();
    if (!tradeNames.has(key)) tradeNames.set(key, label);
    return key;
  };
  const taskGroups = new Map<string, TaskRecord[]>();
  for (const task of openTasks) {
    const key = tradeKey(task.trade_name);
    taskGroups.set(key, [...(taskGroups.get(key) ?? []), task]);
  }
  const activityGroups = new Map<string, typeof activities>();
  for (const item of activities) {
    const key = tradeKey(item.activity.trade_name);
    activityGroups.set(key, [...(activityGroups.get(key) ?? []), item]);
  }
  const trades = [...tradeNames].sort((a, b) => a[1].localeCompare(b[1])).map(([key, name]) => ({
    name, tasks: taskGroups.get(key) ?? [], activities: activityGroups.get(key) ?? [],
  }));
  return {
    today, through, dueTasks, unassigned, undated, activities, trades, reportFollowUps,
    latestReport: reports.find((report) => report.log_date <= today) ?? null,
    taskProgress: { total: tasks.length, done: tasks.filter((task) => task.status === "done").length },
    scheduleProgress: { total: allActivities.length, done: allActivities.filter((activity) => activity.status === "done").length },
  };
}

export type OperationalLookahead = ReturnType<typeof buildOperationalLookahead>;
