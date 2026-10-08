"use client";
import Link from "next/link";
import { Card } from "./ui";
import { activityOnDay } from "@/lib/construction-calendar";
import {
  scheduleStatusLabel,
  type ScheduleActivity,
  type ScheduleResource,
} from "@/lib/schedule-types";
export function ExpectedSchedule({
  activities,
  resources,
}: {
  activities: ScheduleActivity[];
  resources: ScheduleResource[];
}) {
  const now = new Date();
  const expected = activities.filter((a) => {
    if (["cancelled", "done", "held"].includes(a.status)) return false;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: a.timezone ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const part = (type: string) => parts.find((p) => p.type === type)?.value;
    return activityOnDay(a, `${part("year")}-${part("month")}-${part("day")}`);
  });
  return (
    <Card>
      <h2 className="section-title">Expected today</h2>
      <p className="text-sm text-stone-600">
        By each activity&apos;s job timezone. Scheduled resources are not
        verified onsite.
      </p>
      {!expected.length && (
        <p className="mt-2">No active work scheduled today.</p>
      )}
      <ul className="mt-3 space-y-2">
        {expected.map((a) => (
          <li key={a.id}>
            <Link
              className="min-h-11 inline-flex items-center font-medium underline"
              href={`/projects/${a.project_id}/schedule`}
            >
              {a.name}
            </Link>
            <p className="text-sm">
              {scheduleStatusLabel(a.status)} · {a.trade_name ?? "Unclassified"}{" "}
              · {a.all_day !== false ? "All day" : a.start_time?.slice(0, 5)} ·{" "}
              {a.timezone ?? "UTC"}
            </p>
            <p className="text-sm">
              {a.assignments
                ?.map(
                  (x) =>
                    `${resources.find((r) => r.id === x.resource_id)?.name ?? "Resource"}${x.expected_workers != null ? ` (${x.expected_workers} expected)` : ""}`,
                )
                .join(" · ") || "Resources not assigned"}
            </p>
          </li>
        ))}
      </ul>
      <Link
        className="min-h-11 inline-flex items-center underline"
        href="/schedule"
      >
        Open company calendar
      </Link>
    </Card>
  );
}
