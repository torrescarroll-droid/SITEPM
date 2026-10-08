"use client";

import { useActionState } from "react";
import { changeTaskStatus, type TaskFormState } from "@/lib/task-actions";
import type { TaskRecord } from "@/lib/task-types";

export function TaskStatusControl({ task }: { task: TaskRecord }) {
  const [state, action, pending] = useActionState(changeTaskStatus, { error: null } as TaskFormState);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="task_id" value={task.id} />
      <select name="status" aria-label={`Status for ${task.title}`} defaultValue={task.status}
        key={task.status} className="min-h-11 rounded-lg border border-stone-200 bg-white px-2 text-sm" disabled={pending}>
        <option value="open">Open</option>
        <option value="in_progress">In progress</option>
        <option value="done">Done</option>
      </select>
      <button disabled={pending} className="control min-h-11 px-3 text-sm font-medium disabled:opacity-60">
        {pending ? "Saving…" : "Save status"}
      </button>
      <p role={state.error ? "alert" : "status"} className={state.error ? "text-sm text-danger" : "text-sm text-stone-600"}>
        {state.error ?? state.success}
      </p>
    </form>
  );
}
