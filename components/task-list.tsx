"use client";

import { useActionState } from "react";
import { Card, DemoNote, PriorityPill, TaskStatusText } from "@/components/ui";
import { formatProjectDate } from "@/lib/format-date";
import {
  createTask,
  deleteTask,
  setTaskStatus,
  updateTask,
  type TaskFormState,
} from "@/lib/task-actions";
import { taskIsOverdue, type TaskRecord } from "@/lib/task-types";

const initialState: TaskFormState = { error: null };

export function NewTaskForm({
  projectId,
  projects,
}: {
  projectId?: string;
  projects: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createTask, initialState);
  const selectable = projectId
    ? projects.filter((project) => project.id === projectId)
    : projects;

  if (selectable.length === 0) {
    return (
      <Card>
        <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          Create task
        </h2>
        <p className="mt-3 text-sm text-stone-600">
          Create a project first. Tasks are saved to a company job.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Create task
      </h2>
      <div className="mt-3">
        <DemoNote>
          Saved to your company. The job is taken from this form, not typed as a
          company id.
        </DemoNote>
      </div>
      <form action={action} className="mt-4 grid gap-3 md:grid-cols-2">
        {projectId ? (
          <input type="hidden" name="project_id" value={projectId} />
        ) : null}
        <label className="block text-sm font-medium md:col-span-2">
          Title
          <input
            name="title"
            required
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
            placeholder="Follow up on panel approval"
          />
        </label>
        <label className="block text-sm font-medium md:col-span-2">
          Description
          <textarea
            name="description"
            rows={2}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
          />
        </label>
        {projectId ? null : (
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
          Due date
          <input
            name="due_date"
            type="date"
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
          />
        </label>
        <label className="block text-sm font-medium">
          Priority
          <select
            name="priority"
            defaultValue="medium"
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"
          >
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </label>
        {state.error ? (
          <p className="text-sm text-orange-800 md:col-span-2">{state.error}</p>
        ) : null}
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-xl bg-stone-900 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save task"}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function TaskList({
  tasks,
  projectNames,
  showProject,
}: {
  tasks: TaskRecord[];
  projectNames: Record<string, string>;
  showProject?: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <Card>
        <p className="font-medium">No tasks yet</p>
        <p className="mt-1 text-sm text-stone-600">
          Create a follow-up. It is stored for your company only.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          projectLabel={showProject ? projectNames[task.project_id] : undefined}
        />
      ))}
    </div>
  );
}

function TaskCard({
  task,
  projectLabel,
}: {
  task: TaskRecord;
  projectLabel?: string;
}) {
  const [state, action, pending] = useActionState(updateTask, initialState);
  const overdue = taskIsOverdue(task);

  return (
    <Card>
      <form action={action} className="space-y-3">
        <input type="hidden" name="task_id" value={task.id} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <label className="block text-sm font-medium">
              Title
              <input
                name="title"
                required
                defaultValue={task.title}
                className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3 font-medium"
              />
            </label>
            <label className="block text-sm font-medium">
              Description
              <textarea
                name="description"
                rows={2}
                defaultValue={task.description ?? ""}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
              />
            </label>
            <p className="text-sm text-stone-500">
              {projectLabel ? `${projectLabel} · ` : null}
              due {formatProjectDate(task.due_date)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {task.priority ? <PriorityPill priority={task.priority} /> : null}
            <TaskStatusText status={task.status} overdue={overdue} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            Due date
            <input
              name="due_date"
              type="date"
              defaultValue={task.due_date ?? ""}
              className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
            />
          </label>
          <label className="block text-sm font-medium">
            Priority
            <select
              name="priority"
              defaultValue={task.priority ?? "medium"}
              className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"
            >
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Status
            <select
              name="status"
              defaultValue={task.status}
              className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"
            >
              <option value="open">open</option>
              <option value="in_progress">in progress</option>
              <option value="done">done</option>
            </select>
          </label>
        </div>
        {state.error ? (
          <p className="text-sm text-orange-800">{state.error}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-xl bg-stone-900 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
      <div className="mt-3 flex flex-wrap gap-3 border-t border-stone-100 pt-3">
        {task.status === "done" ? (
          <form action={setTaskStatus}>
            <input type="hidden" name="task_id" value={task.id} />
            <input type="hidden" name="status" value="open" />
            <button type="submit" className="text-sm font-medium text-stone-700">
              Reopen
            </button>
          </form>
        ) : (
          <form action={setTaskStatus}>
            <input type="hidden" name="task_id" value={task.id} />
            <input type="hidden" name="status" value="done" />
            <button type="submit" className="text-sm font-medium text-stone-700">
              Mark done
            </button>
          </form>
        )}
        <form action={deleteTask}>
          <input type="hidden" name="task_id" value={task.id} />
          <button type="submit" className="text-sm font-medium text-orange-800">
            Delete
          </button>
        </form>
      </div>
    </Card>
  );
}
