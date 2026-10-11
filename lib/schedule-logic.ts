import type { ScheduleActivity, ScheduleStatus } from "@/lib/schedule-types";

export function localTodayIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Inclusive finish. A 1-day activity finishes on its start date. */
export function finishFromDuration(startDate: string, durationDays: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || durationDays < 1) {
    return null;
  }
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  start.setDate(start.getDate() + durationDays - 1);
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${start.getFullYear()}-${month}-${day}`;
}

export function activityIsLate(
  activity: Pick<ScheduleActivity, "status" | "finish_date">,
  today: string,
) {
  if (activity.status === "done" || activity.status === "held" || activity.status === "cancelled") return false;
  if (!activity.finish_date) return false;
  return activity.finish_date < today;
}

export function activityIsCurrent(
  activity: Pick<ScheduleActivity, "status" | "start_date" | "finish_date">,
  today: string,
) {
  if (activity.status === "done" || activity.status === "held" || activity.status === "cancelled") return false;
  if (activityIsLate(activity, today)) return false;
  if (activity.status === "in_progress") return true;
  if (!activity.start_date) return false;
  if (activity.start_date > today) return false;
  if (activity.finish_date && activity.finish_date < today) return false;
  return true;
}

export type ScheduleEdge = { activityId: string; predecessorId: string };

/** True when linking predecessor → activity would loop through existing edges. */
export function dependencyWouldCycle(
  edges: ScheduleEdge[],
  activityId: string,
  predecessorId: string,
) {
  if (activityId === predecessorId) return true;
  const predecessors = new Map<string, string[]>();
  for (const edge of edges) {
    const list = predecessors.get(edge.activityId) ?? [];
    list.push(edge.predecessorId);
    predecessors.set(edge.activityId, list);
  }
  const seen = new Set<string>();
  const stack = [predecessorId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    if (current === activityId) return true;
    seen.add(current);
    for (const next of predecessors.get(current) ?? []) {
      stack.push(next);
    }
  }
  return false;
}

export function upcomingScheduleActivities(
  activities: ScheduleActivity[],
  today: string,
) {
  return activities
    .filter(
      (activity) =>
        (activity.status === "not_started" || activity.status === "confirmed") &&
        activity.start_date != null &&
        activity.start_date > today,
    )
    .sort((left, right) => {
      const byDate = (left.start_date ?? "").localeCompare(right.start_date ?? "");
      if (byDate !== 0) return byDate;
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
    });
}

/** Earliest not-started activity that starts after today. A to-do due date is not a candidate. */
export function nextScheduledActivity(
  activities: ScheduleActivity[],
  today: string,
) {
  return upcomingScheduleActivities(activities, today)[0] ?? null;
}

export type SchedulePosition =
  | "current"
  | "next"
  | "upcoming"
  | "late"
  | "done"
  | "held"
  | "unscheduled";

export function schedulePosition(
  activity: Pick<ScheduleActivity, "id" | "status" | "start_date" | "finish_date">,
  today: string,
  nextActivityId: string | null,
): SchedulePosition {
  if (activity.status === "done") return "done";
  if (activity.status === "held") return "held";
  if (activityIsLate(activity, today)) return "late";
  if (nextActivityId && activity.id === nextActivityId) return "next";
  if (activityIsCurrent(activity, today)) return "current";
  if (
    (activity.status === "not_started" || activity.status === "confirmed") &&
    activity.start_date != null &&
    activity.start_date > today
  ) {
    return "upcoming";
  }
  return "unscheduled";
}

export function summarizeSchedule(
  activities: ScheduleActivity[],
  today: string,
) {
  const late = activities.filter((activity) => activityIsLate(activity, today));
  const current = activities.filter((activity) => activityIsCurrent(activity, today));
  const upcoming = upcomingScheduleActivities(activities, today).slice(0, 3);
  return { late, current, upcoming };
}

export function scheduleStatusRank(status: ScheduleStatus) {
  if (status === "in_progress") return 0;
  if (status === "not_started") return 1;
  if (status === "held") return 2;
  return 3;
}
