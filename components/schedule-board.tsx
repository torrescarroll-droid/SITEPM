"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui";
import { formatProjectDate } from "@/lib/format-date";
import { activityIsLate, localTodayIso } from "@/lib/schedule-logic";
import {
  saveScheduleActivity,
  type ScheduleFormState,
} from "@/lib/schedule-actions";
import {
  SCHEDULE_STATUSES,
  scheduleStatusLabel,
  type ScheduleActivity,
} from "@/lib/schedule-types";

const initialState: ScheduleFormState = { error: null };
const inputClass = "mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3";

function ActivityForm({
  projectId,
  activities,
  activity,
}: {
  projectId: string;
  activities: ScheduleActivity[];
  activity?: ScheduleActivity;
}) {
  const [state, action, pending] = useActionState(saveScheduleActivity, initialState);
  const others = activities.filter((item) => item.id !== activity?.id);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />
      {activity ? <input type="hidden" name="activity_id" value={activity.id} /> : null}
      <label className="block text-sm font-medium">
        Activity
        <input
          name="name"
          required
          defaultValue={activity?.name ?? ""}
          placeholder="Primary bath waterproofing"
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-medium">
        Notes
        <textarea
          name="notes"
          rows={2}
          defaultValue={activity?.notes ?? ""}
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Start
          <input
            name="start_date"
            type="date"
            defaultValue={activity?.start_date ?? ""}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          Finish
          <input
            name="finish_date"
            type="date"
            defaultValue={activity?.finish_date ?? ""}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          Or duration (days)
          <input
            name="duration_days"
            inputMode="numeric"
            placeholder="Used when finish is blank"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          Status
          <select
            name="status"
            defaultValue={activity?.status ?? "not_started"}
            className={`${inputClass} bg-white`}
          >
            {SCHEDULE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {scheduleStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Trade
          <input
            name="trade_name"
            defaultValue={activity?.trade_name ?? ""}
            placeholder="Plumbing"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          Predecessor
          <select
            name="predecessor_id"
            defaultValue={activity?.predecessor_id ?? ""}
            className={`${inputClass} bg-white`}
          >
            <option value="">None</option>
            {others.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input
          name="is_milestone"
          type="checkbox"
          defaultChecked={activity?.is_milestone ?? false}
          className="size-4"
        />
        Milestone
      </label>
      {state.error ? <p className="text-sm text-orange-800">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-xl bg-stone-900 text-sm font-medium text-white disabled:opacity-60 sm:w-auto sm:px-4"
      >
        {pending ? "Saving…" : activity ? "Update activity" : "Add activity"}
      </button>
    </form>
  );
}

export function ScheduleBoard({
  projectId,
  activities,
}: {
  projectId: string;
  activities: ScheduleActivity[];
}) {
  const today = localTodayIso();
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          New activity
        </h2>
        <div className="mt-4">
          <ActivityForm projectId={projectId} activities={activities} />
        </div>
      </Card>
      {activities.length === 0 ? (
        <Card>
          <p className="font-medium">No activities yet</p>
          <p className="mt-1 text-sm text-stone-600">
            Add the work in the order it has to happen. This is the job schedule, not a PDF.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {activities.map((activity) => {
            const late = activityIsLate(activity, today);
            return (
              <li key={activity.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {activity.name}
                        {activity.is_milestone ? " · Milestone" : ""}
                      </p>
                      <p className="mt-1 text-sm text-stone-600">
                        {scheduleStatusLabel(activity.status)}
                        {activity.trade_name ? ` · ${activity.trade_name}` : ""}
                        {late ? " · Late" : ""}
                      </p>
                      <p className="mt-1 text-sm text-stone-500">
                        {activity.start_date
                          ? formatProjectDate(activity.start_date)
                          : "No start"}
                        {" – "}
                        {activity.finish_date
                          ? formatProjectDate(activity.finish_date)
                          : "No finish"}
                      </p>
                      {activity.predecessor_name ? (
                        <p className="mt-1 text-sm text-stone-500">
                          After {activity.predecessor_name}
                        </p>
                      ) : null}
                      {activity.notes ? (
                        <p className="mt-2 text-sm text-stone-700">{activity.notes}</p>
                      ) : null}
                    </div>
                  </div>
                  <details className="mt-3">
                    <summary className="min-h-11 cursor-pointer text-sm font-medium">
                      Edit
                    </summary>
                    <div className="mt-3">
                      <ActivityForm
                        projectId={projectId}
                        activities={activities}
                        activity={activity}
                      />
                    </div>
                  </details>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
