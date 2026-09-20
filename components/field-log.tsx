"use client";

import { useActionState } from "react";
import { Card, DemoNote } from "@/components/ui";
import { formatProjectDate } from "@/lib/format-date";
import {
  createFieldLog,
  type FieldLogFormState,
} from "@/lib/field-log-actions";
import type { FieldLogRecord } from "@/lib/field-log-types";

const initialState: FieldLogFormState = { error: null };

function todayLocalIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function NewFieldLogForm({
  projectId,
  projects,
}: {
  projectId?: string;
  projects: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createFieldLog, initialState);
  const selectable = projectId
    ? projects.filter((project) => project.id === projectId)
    : projects;

  if (selectable.length === 0) {
    return (
      <Card>
        <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          New log
        </h2>
        <p className="mt-3 text-sm text-stone-600">
          Create a project first. Field logs are saved to a company job.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        New log
      </h2>
      <div className="mt-3">
        <DemoNote>
          Saved to your company. The job is taken from this form, not typed as a
          company id. Photos are not part of this slice.
        </DemoNote>
      </div>
      <form action={action} className="mt-4 space-y-3">
        {projectId ? (
          <input type="hidden" name="project_id" value={projectId} />
        ) : (
          <label className="block text-sm font-medium">
            Project
            <select
              name="project_id"
              required
              className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"
              defaultValue={selectable[0]?.id}
            >
              {selectable.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm font-medium">
          Date
          <input
            name="log_date"
            type="date"
            required
            defaultValue={todayLocalIso()}
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
          />
        </label>
        <label className="block text-sm font-medium">
          Notes
          <textarea
            name="notes"
            required
            rows={3}
            placeholder="What happened on site?"
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input name="issue_flag" type="checkbox" className="size-4" />
          Flag issue
        </label>
        {state.error ? (
          <p className="text-sm text-orange-800">{state.error}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-xl bg-stone-900 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save log"}
        </button>
      </form>
    </Card>
  );
}

export function FieldLogList({
  logs,
  projectNames,
  showProject,
}: {
  logs: FieldLogRecord[];
  projectNames: Record<string, string>;
  showProject?: boolean;
}) {
  if (logs.length === 0) {
    return (
      <Card>
        <p className="font-medium">No field logs yet</p>
        <p className="mt-1 text-sm text-stone-600">
          Record what happened on site. Logs are stored for your company only.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <Card key={log.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {showProject
                  ? (projectNames[log.project_id] ?? "Project")
                  : formatProjectDate(log.log_date)}
              </p>
              <p className="text-sm text-stone-500">
                {log.created_by_name ?? "Crew"}
                {showProject ? ` · ${formatProjectDate(log.log_date)}` : ""}
              </p>
            </div>
            {log.issue_flag ? (
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-900">
                Issue
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-700">
            {log.notes ?? ""}
          </p>
        </Card>
      ))}
    </div>
  );
}
