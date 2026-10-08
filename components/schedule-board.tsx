"use client";
import Link from "next/link";
import { useState } from "react";
import { Card } from "./ui";
import {
  ScheduleRecordForm,
  scheduleInput as input,
} from "./schedule-record-form";
import { localTodayIso, activityIsLate } from "@/lib/schedule-logic";
import {
  activityTimeLabel,
  scheduleHistoryLines,
  calendarDays,
  navigateDate,
  activityOnDay,
  tradeColor,
  resourceOverlaps,
  addDays,
  type CalendarView,
} from "@/lib/construction-calendar";
import {
  SCHEDULE_STATUSES,
  ACTIVITY_TYPES,
  scheduleStatusLabel,
  type ScheduleActivity,
  type ScheduleResource,
  type ScheduleHistory,
} from "@/lib/schedule-types";
const typeTone: Record<string, string> = {
  work: "bg-stone-100 text-stone-800",
  inspection: "bg-amber-100 text-amber-950",
  delivery: "bg-sky-100 text-sky-950",
  equipment: "bg-slate-200 text-slate-950",
  milestone: "bg-violet-100 text-violet-950",
};
type Project = { id: string; name: string };
type Task = { id: string; project_id: string; title: string };
function labelDate(day: string) {
  return new Date(day + "T12:00:00Z").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
export function ScheduleBoard({
  projectId,
  activities,
  resources,
  projects,
  tasks,
  history,
  scope,
}: {
  projectId?: string;
  activities: ScheduleActivity[];
  resources: ScheduleResource[];
  projects: Project[];
  tasks: Task[];
  history: ScheduleHistory[];
  scope: string;
}) {
  const [anchor, setAnchor] = useState(localTodayIso()),
    [view, setView] = useState<CalendarView>("week"),
    [trade, setTrade] = useState(""),
    [type, setType] = useState(""),
    [resource, setResource] = useState(""),
    [job, setJob] = useState(projectId ?? ""),
    [showCancelled, setShowCancelled] = useState(false);
  const [editing, setEditing] = useState<ScheduleActivity | null | undefined>(
      undefined,
    ),
    [newDate, setNewDate] = useState(anchor),
    [message, setMessage] = useState("");
  const days = calendarDays(anchor, view),
    today = localTodayIso();
  const filtered = activities.filter(
    (a) =>
      (!job || a.project_id === job) &&
      (!trade || a.trade_name === trade) &&
      (!type || (a.activity_type ?? "work") === type) &&
      (!resource || a.assignments?.some((x) => x.resource_id === resource)) &&
      (showCancelled || a.status !== "cancelled"),
  );
  const overlaps = resourceOverlaps(activities).filter((o) =>
    [o.left, o.right].some(
      (a) => filtered.includes(a) && days.some((d) => activityOnDay(a, d)),
    ),
  );
  const name = (id: string) =>
    resources.find((r) => r.id === id)?.name ?? "Unavailable resource";
  const projectName = (id: string) =>
    projects.find((p) => p.id === id)?.name ?? "Job";
  const trades = [
    ...new Set(
      activities
        .map((a) => a.trade_name)
        .filter((x): x is string => Boolean(x)),
    ),
  ].sort();
  const selectedJob = editing?.project_id ?? job ?? projectId;
  function create(day: string) {
    setNewDate(day);
    setEditing(null);
    setMessage("");
  }
  function drop(id: string, day: string) {
    const a = activities.find((a) => a.id === id);
    if (!a?.start_date) return;
    const duration = Math.round(
      (Date.parse((a.finish_date ?? a.start_date) + "T12:00:00Z") -
        Date.parse(a.start_date + "T12:00:00Z")) /
        86400000,
    );
    setEditing({ ...a, start_date: day, finish_date: addDays(day, duration) });
    setMessage("Reschedule preview. Review dates and save to confirm.");
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            className="control min-h-11 rounded border px-3"
            onClick={() => setAnchor(navigateDate(anchor, view, -1))}
            aria-label="Previous period"
          >
            ←
          </button>
          <button
            className="control min-h-11 rounded border px-3"
            onClick={() => setAnchor(today)}
          >
            Today
          </button>
          <button
            className="control min-h-11 rounded border px-3"
            onClick={() => setAnchor(navigateDate(anchor, view, 1))}
            aria-label="Next period"
          >
            →
          </button>
        </div>
        <div className="flex gap-1" role="group" aria-label="Calendar view">
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              className={`control min-h-11 rounded border px-3 capitalize ${view === v ? "bg-shell text-white" : ""}`}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">
          {view === "month"
            ? new Date(anchor + "T12:00:00Z").toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })
            : `${labelDate(days[0])}${view === "week" ? " – " + labelDate(days[6]) : ""}`}
        </h2>
        <label>
          Date
          <input
            className={input}
            type="date"
            value={anchor}
            onChange={(e) => {
              if (e.target.value) setAnchor(e.target.value);
            }}
          />
        </label>
        <button
          className="control min-h-11 rounded-lg bg-shell px-4 text-white"
          onClick={() => create(anchor)}
          disabled={!projects.length}
        >
          Add activity
        </button>
        <Link
          href="/resources"
          className="min-h-11 inline-flex items-center underline"
        >
          Resource directory
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {!projectId && (
          <label>
            Job
            <select
              className={input}
              value={job}
              onChange={(e) => setJob(e.target.value)}
            >
              <option value="">All jobs</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Trade filter
          <select
            className={input}
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
          >
            <option value="">All trades</option>
            {trades.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Activity type filter
          <select
            className={input}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All types</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Assigned resource filter
          <select
            className={input}
            value={resource}
            onChange={(e) => setResource(e.target.value)}
          >
            <option value="">All resources</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={showCancelled}
          onChange={(e) => setShowCancelled(e.target.checked)}
        />
        Show cancelled activities
      </label>
      <p className="text-sm text-stone-600">
        Expected assignments, not attendance. Times use each activity&apos;s
        stated job timezone. Trade color stays constant as status changes.
        Desktop drag previews a date move; touch and keyboard users can edit
        dates.
      </p>
      {trades.length > 0 && (
        <ul className="flex flex-wrap gap-3 text-sm" aria-label="Trade colors">
          {trades.map((t) => (
            <li
              key={t}
              className="border-l-4 pl-2"
              style={{ borderColor: tradeColor(t) }}
            >
              {t}
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p role="status" className="rounded border border-stone-300 p-3">
          {message}
        </p>
      )}
      {editing !== undefined && (
        <Card>
          <h2 className="section-title">
            {editing ? "Activity details & edit" : "New activity"}
          </h2>
          <button
            className="min-h-11 underline"
            onClick={() => setEditing(undefined)}
          >
            Close editor (draft retained)
          </button>
          <ScheduleRecordForm
            key={`${editing?.id ?? "new"}:${editing?.start_date ?? newDate}:${selectedJob}`}
            kind="activity"
            scope={scope}
            initial={
              editing
                ? { ...editing }
                : { project_id: selectedJob, all_day: true }
            }
            onSaved={() => {
              setEditing(undefined);
              setMessage("Activity saved. Calendar updated.");
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Job
                <select
                  className={input}
                  name="project_id"
                  defaultValue={selectedJob || projects[0]?.id}
                  onChange={(e) => {
                    if (!editing) setJob(e.target.value);
                  }}
                  disabled={Boolean(editing)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {editing && (
                  <input
                    type="hidden"
                    name="project_id"
                    value={editing.project_id}
                  />
                )}
              </label>
              <label>
                Activity
                <input
                  className={input}
                  name="name"
                  required
                  maxLength={200}
                  defaultValue={editing?.name ?? ""}
                />
              </label>
              <label>
                Start date
                <input
                  className={input}
                  name="start_date"
                  type="date"
                  required
                  defaultValue={editing?.start_date ?? newDate}
                />
              </label>
              <label>
                Finish date
                <input
                  className={input}
                  name="finish_date"
                  type="date"
                  required
                  defaultValue={
                    editing?.finish_date ?? editing?.start_date ?? newDate
                  }
                />
              </label>
              <label>
                Start time
                <input
                  className={input}
                  name="start_time"
                  type="time"
                  defaultValue={editing?.start_time?.slice(0, 5) ?? ""}
                />
              </label>
              <label>
                End time
                <input
                  className={input}
                  name="finish_time"
                  type="time"
                  defaultValue={editing?.finish_time?.slice(0, 5) ?? ""}
                />
              </label>
              <label>
                Job timezone
                <input
                  className={input}
                  name="timezone"
                  required
                  defaultValue={
                    editing?.timezone ??
                    Intl.DateTimeFormat().resolvedOptions().timeZone
                  }
                />
                <span className="text-xs">
                  IANA name, e.g. America/Los_Angeles. Verify the job&apos;s
                  timezone.
                </span>
              </label>
              <label>
                Trade
                <input
                  className={input}
                  name="trade_name"
                  maxLength={100}
                  defaultValue={editing?.trade_name ?? ""}
                />
              </label>
              <label>
                Activity type
                <select
                  className={input}
                  name="activity_type"
                  defaultValue={
                    editing?.activity_type ??
                    (editing?.is_milestone ? "milestone" : "work")
                  }
                >
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  className={input}
                  name="status"
                  defaultValue={editing?.status ?? "not_started"}
                >
                  {SCHEDULE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {scheduleStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="space-y-1 rounded border p-3">
                <legend>Predecessors</legend>
                <p className="text-xs text-muted">
                  Work that must precede this activity. Dependencies do not
                  automatically move dates.
                </p>
                {activities
                  .filter(
                    (a) =>
                      a.id !== editing?.id &&
                      a.project_id ===
                        (editing?.project_id || selectedJob || projects[0]?.id),
                  )
                  .map((a) => (
                    <label
                      key={a.id}
                      className="flex min-h-11 items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        name="predecessor_ids"
                        value={a.id}
                        defaultChecked={(
                          editing?.predecessor_ids ??
                          (editing?.predecessor_id
                            ? [editing.predecessor_id]
                            : [])
                        ).includes(a.id)}
                      />
                      {a.name}
                    </label>
                  ))}
              </fieldset>
              <label>
                Source to-do
                <select
                  className={input}
                  name="source_task_id"
                  defaultValue={editing?.source_task_id ?? ""}
                >
                  <option value="">None</option>
                  {tasks
                    .filter(
                      (t) =>
                        t.project_id ===
                        (editing?.project_id || selectedJob || projects[0]?.id),
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <label className="flex min-h-11 items-center gap-2">
              <input
                name="all_day"
                type="checkbox"
                defaultChecked={editing?.all_day ?? true}
              />
              All day (times ignored)
            </label>
            <label className="block">
              Description
              <textarea
                className={input}
                name="notes"
                maxLength={10000}
                defaultValue={editing?.notes ?? ""}
              />
            </label>
            <fieldset className="space-y-2 rounded-lg border border-stone-200 p-3">
              <legend>Expected resources</legend>
              {resources.length === 0 && (
                <p>
                  Add resources in the directory first; unassigned activities
                  can still be saved.
                </p>
              )}
              {resources
                .filter(
                  (r) =>
                    r.active ||
                    editing?.assignments?.some((a) => a.resource_id === r.id),
                )
                .map((r) => {
                  const assignment = editing?.assignments?.find(
                    (a) => a.resource_id === r.id,
                  );
                  return (
                    <div
                      key={r.id}
                      className="grid gap-2 border-b border-stone-100 pb-2 sm:grid-cols-2"
                    >
                      <label className="flex min-h-11 items-center gap-2">
                        <input
                          type="checkbox"
                          name="resource_id"
                          value={r.id}
                          defaultChecked={Boolean(assignment)}
                        />
                        {r.name} · {r.resource_type.replaceAll("_", " ")}
                        {!r.active && " (inactive — remove before saving)"}
                      </label>
                      <label className="text-sm">
                        Expected workers for {r.name}
                        <input
                          className={input}
                          type="number"
                          min={0}
                          max={10000}
                          name={`workers_${r.id}`}
                          defaultValue={assignment?.expected_workers ?? ""}
                        />
                      </label>
                    </div>
                  );
                })}
            </fieldset>
          </ScheduleRecordForm>
          {editing && (
            <Link
              className="inline-flex min-h-11 items-center underline"
              href={`/projects/${editing.project_id}/field`}
            >
              Open daily reports — record actual work separately
            </Link>
          )}
          {editing?.source_task_id && (
            <Link
              className="inline-flex min-h-11 items-center underline"
              href={`/projects/${editing.project_id}/tasks#task-${editing.source_task_id}`}
            >
              Open source to-do
            </Link>
          )}
          {editing && (
            <details className="mt-4">
              <summary className="min-h-11 cursor-pointer">
                Activity change history
              </summary>
              <p className="text-xs">
                History shows the latest 100 events for this view: recorded
                changes, not verified attendance or measured performance.
              </p>
              <ul className="space-y-2">
                {history
                  .filter((h) => h.activity_id === editing.id)
                  .map((h) => (
                    <li key={h.id} className="rounded border p-2 text-sm">
                      <p>
                        {new Date(h.occurred_at).toLocaleString()} ·{" "}
                        {h.actor_name ??
                          (h.actor_id ? "Company team member" : "System")}
                      </p>
                      <ul className="mt-1 space-y-1 break-words">
                        {scheduleHistoryLines(
                          h,
                          name,
                          (id) =>
                            activities.find((a) => a.id === id)?.name ??
                            "Activity unavailable",
                        ).map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </Card>
      )}
      {!filtered.some((a) => days.some((d) => activityOnDay(a, d))) && (
        <Card>
          No activities in this period match these filters. Choose another date
          or add scheduled work.
        </Card>
      )}
      {view === "month" && (
        <div
          className="grid grid-cols-7 gap-1 lg:hidden"
          aria-label="Mobile month overview"
        >
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span key={day} className="text-center text-xs font-semibold">
              {day}
            </span>
          ))}
          {days.map((day) => (
            <button
              key={day}
              className={`min-h-14 rounded border p-1 text-xs ${day === today ? "border-stone-900 bg-stone-100" : "border-stone-200"}`}
              onClick={() => {
                setAnchor(day);
                setView("day");
              }}
              aria-label={`View ${day}, ${filtered.filter((a) => activityOnDay(a, day)).length} activities`}
            >
              <span className="block font-semibold">
                {Number(day.slice(8))}
              </span>
              <span>
                {filtered.filter((a) => activityOnDay(a, day)).length} work
              </span>
              <span
                className="mt-1 flex flex-wrap justify-center gap-0.5"
                aria-hidden="true"
              >
                {[
                  ...new Set(
                    filtered
                      .filter((a) => activityOnDay(a, day))
                      .map((a) => a.trade_name),
                  ),
                ].map((t) => (
                  <span
                    key={t ?? "unclassified"}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: tradeColor(t) }}
                  />
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
      <div
        className={
          view === "day"
            ? "space-y-3"
            : view === "month"
              ? "hidden gap-2 lg:grid lg:grid-cols-7"
              : "grid grid-cols-1 gap-2 lg:grid-cols-7"
        }
        aria-label={`${view} calendar`}
      >
        {days.map((day) => (
          <section
            key={day}
            className={`min-w-0 rounded-lg border p-2 ${day === today ? "border-stone-800 bg-stone-50" : "border-stone-200 bg-white"} ${view === "month" && day.slice(0, 7) !== anchor.slice(0, 7) ? "opacity-60" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              drop(e.dataTransfer.getData("text/plain"), day);
            }}
            aria-label={labelDate(day)}
          >
            <button
              className="mb-2 min-h-11 w-full text-left text-sm font-semibold"
              onClick={() => create(day)}
              aria-label={`Add activity on ${day}`}
            >
              {labelDate(day)}
              {day === today ? " · Today" : ""} <span aria-hidden>＋</span>
            </button>
            <ul className="space-y-2">
              {filtered
                .filter((a) => activityOnDay(a, day))
                .map((a) => (
                  <li key={a.id}>
                    <button
                      draggable
                      className="min-h-11 w-full break-words rounded border border-stone-200 border-l-4 bg-stone-50 p-2 text-left text-sm hover:bg-stone-100"
                      style={{ borderLeftColor: tradeColor(a.trade_name) }}
                      onDragStart={(e) =>
                        e.dataTransfer.setData("text/plain", a.id)
                      }
                      onClick={() => {
                        setEditing(a);
                        setMessage("");
                      }}
                    >
                      <span className="block font-semibold">
                        {a.is_milestone ? "◆ " : ""}
                        {a.name}
                      </span>
                      {!projectId && (
                        <span className="block text-xs">
                          {projectName(a.project_id)}
                        </span>
                      )}
                      <span className="block text-xs">
                        {a.trade_name ?? "Unclassified"} ·{" "}
                        <span
                          className={`inline-block rounded px-1 text-xs ${typeTone[a.activity_type ?? "work"]}`}
                        >
                          {a.activity_type ?? "work"}
                        </span>
                      </span>
                      <span className="block font-medium">
                        {scheduleStatusLabel(a.status)}
                        {activityIsLate(a, today) ? " · Overdue" : ""}
                      </span>
                      <span className="block text-xs">
                        {activityTimeLabel(a, day)} · {a.timezone ?? "UTC"}
                      </span>
                      {a.predecessor_name && (
                        <span className="block text-xs">
                          After: {a.predecessor_name}
                          {(a.predecessor_ids?.length ?? 0) > 1
                            ? ` + ${(a.predecessor_ids?.length ?? 1) - 1} more`
                            : ""}
                        </span>
                      )}
                      {a.assignments?.map((r) => (
                        <span key={r.resource_id} className="block text-xs">
                          {name(r.resource_id)}
                          {r.expected_workers != null
                            ? ` · ${r.expected_workers} expected`
                            : ""}
                        </span>
                      ))}
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
      {filtered.some((a) => !a.start_date) && (
        <Card>
          <h2 className="font-semibold">Undated activities</h2>
          {filtered
            .filter((a) => !a.start_date)
            .map((a) => (
              <button
                key={a.id}
                className="block min-h-11 underline"
                onClick={() => setEditing(a)}
              >
                {a.name} — set dates
              </button>
            ))}
        </Card>
      )}
      <Card>
        <h2 className="section-title">Potential resource overlaps</h2>
        <p className="text-sm text-stone-600">
          Shared assignments in this period; confirm capacity with the trade
          partner. These are not automatically conflicts.
        </p>
        {!overlaps.length && (
          <p className="mt-2">
            No potential overlaps found for the visible work.
          </p>
        )}
        <ul className="mt-2 space-y-2">
          {overlaps.map((o) => (
            <li key={o.left.id + o.right.id} className="text-sm">
              {o.resources.map(name).join(", ")}:{" "}
              <button
                className="min-h-11 underline"
                onClick={() => setEditing(o.left)}
              >
                {o.left.name} ({projectName(o.left.project_id)})
              </button>{" "}
              ↔{" "}
              <button
                className="min-h-11 underline"
                onClick={() => setEditing(o.right)}
              >
                {o.right.name} ({projectName(o.right.project_id)})
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
