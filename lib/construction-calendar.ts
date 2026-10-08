import type { ScheduleActivity } from "./schedule-types";
export type CalendarView = "month" | "week" | "day";
export function addDays(date: string, amount: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function calendarDays(anchor: string, view: CalendarView) {
  if (view === "day") return [anchor];
  const date = new Date(
    (view === "month" ? anchor.slice(0, 7) + "-01" : anchor) + "T12:00:00Z",
  );
  const first = addDays(
    date.toISOString().slice(0, 10),
    -(date.getUTCDay() + 6) % 7,
  );
  return Array.from({ length: view === "month" ? 42 : 7 }, (_, i) =>
    addDays(first, i),
  );
}
export function navigateDate(
  anchor: string,
  view: CalendarView,
  direction: number,
) {
  if (view !== "month")
    return addDays(anchor, direction * (view === "week" ? 7 : 1));
  const d = new Date(anchor.slice(0, 7) + "-01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + direction);
  return d.toISOString().slice(0, 10);
}
export function activityOnDay(a: ScheduleActivity, day: string) {
  return Boolean(
    a.start_date &&
      a.start_date <= day &&
      (a.finish_date ?? a.start_date) >= day,
  );
}
export function tradeColor(trade: string | null) {
  const colors = [
    "#4d6b83",
    "#947036",
    "#657b52",
    "#7b627d",
    "#98604e",
    "#4e7c78",
    "#696e78",
  ];
  let hash = 0;
  for (const c of (trade ?? "unclassified").trim().toLowerCase())
    hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}
function interval(a: ScheduleActivity) {
  return [
    Date.parse(a.start_at ?? `${a.start_date}T00:00:00Z`),
    Date.parse(
      a.finish_at ?? `${addDays(a.finish_date ?? a.start_date!, 1)}T00:00:00Z`,
    ),
  ];
}
/** Potential overlap, not proof of over-allocation or actual attendance. */
export function resourceOverlaps(activities: ScheduleActivity[]) {
  const results: {
    left: ScheduleActivity;
    right: ScheduleActivity;
    resources: string[];
  }[] = [];
  for (let i = 0; i < activities.length; i++)
    for (let j = i + 1; j < activities.length; j++) {
      const a = activities[i],
        b = activities[j];
      if (
        a.company_id !== b.company_id ||
        !a.start_date ||
        !b.start_date ||
        ["cancelled", "done"].includes(a.status) ||
        ["cancelled", "done"].includes(b.status)
      )
        continue;
      const shared = (a.assignments ?? [])
        .map((x) => x.resource_id)
        .filter((id) =>
          (b.assignments ?? []).some((x) => x.resource_id === id),
        );
      if (!shared.length) continue;
      const [as, ae] = interval(a),
        [bs, be] = interval(b);
      if (as < be && bs < ae)
        results.push({ left: a, right: b, resources: shared });
    }
  return results;
}

/** A timed multi-day activity is continuous, not an invented daily recurrence. */
export function activityTimeLabel(a: ScheduleActivity, day: string) {
  if (a.all_day !== false) return "All day";
  const start = a.start_time?.slice(0, 5) ?? "",
    end = a.finish_time?.slice(0, 5) ?? "";
  if (a.start_date === a.finish_date) return `${start}–${end}`;
  if (day === a.start_date) return `${start} → continues`;
  if (day === a.finish_date) return `Continues → ${end}`;
  return "Continues (multi-day)";
}

/** Human-readable audit evidence; the full immutable snapshots stay in PostgreSQL. */
export function scheduleHistoryLines(
  h: import("./schedule-types").ScheduleHistory,
  resourceName: (id: string) => string,
  activityName: (id: string) => string,
) {
  const before = h.before_record ?? {},
    after = h.after_record ?? {},
    row = h.after_record ?? h.before_record ?? {};
  if (h.change_type.startsWith("assignment_"))
    return [
      `${h.change_type.endsWith("insert") ? "Assigned" : "Unassigned"}: ${resourceName(String(row.resource_id))}${row.expected_workers != null ? ` · ${row.expected_workers} workers expected` : ""}`,
    ];
  if (h.change_type.startsWith("dependency_"))
    return [
      `${h.change_type.endsWith("insert") ? "Added predecessor" : "Removed predecessor"}: ${activityName(String(row.predecessor_id))}`,
    ];
  const fields: Record<string, string> = {
    name: "Activity",
    start_date: "Start date",
    finish_date: "Finish date",
    start_time: "Start time",
    finish_time: "End time",
    timezone: "Timezone",
    all_day: "All day",
    status: "Status",
    activity_type: "Type",
    trade_name: "Trade",
    notes: "Description",
    source_task_id: "Linked task",
  };
  const value = (key: string, v: unknown) =>
    v == null || v === ""
      ? "—"
      : key === "status"
        ? ({
            not_started: "Planned",
            done: "Completed",
            held: "On hold",
            in_progress: "In progress",
            confirmed: "Confirmed",
            delayed: "Delayed",
            cancelled: "Cancelled",
          }[String(v)] ?? String(v))
        : key === "source_task_id"
          ? "Linked"
          : String(v);
  const lines = Object.entries(fields)
    .filter(([k]) => (before[k] ?? null) !== (after[k] ?? null))
    .map(
      ([k, label]) =>
        `${label}: ${value(k, before[k])} → ${value(k, after[k])}`,
    );
  return lines.length ? lines : ["Activity saved; schedule details unchanged."];
}
