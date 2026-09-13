import { projectName, projects, tasks } from "@/lib/demo-data";
import { Card, DemoNote, PriorityPill, TaskStatusText } from "@/components/ui";

export function TaskList({ projectId }: { projectId?: string }) {
  const rows = projectId ? tasks.filter((task) => task.projectId === projectId) : tasks;

  return (
    <div className="space-y-3">
      {rows.map((task) => (
        <Card key={task.id}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">{task.title}</p>
              <p className="mt-1 text-sm text-stone-600">{task.description}</p>
              <p className="mt-2 text-sm text-stone-500">
                {projectId ? null : `${projectName(task.projectId)} · `}
                {task.assignedTo} · due {task.dueDate}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PriorityPill priority={task.priority} />
              <TaskStatusText status={task.status} overdue={task.overdue} />
              {task.aiSuggested ? (
                <span className="rounded-full bg-stone-900 px-2.5 py-1 text-xs font-medium text-white">
                  AI suggested
                </span>
              ) : null}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function NewTaskForm({ projectId }: { projectId?: string }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Create task
      </h2>
      <div className="mt-3">
        <DemoNote>Form is visual only. Tasks are not saved yet.</DemoNote>
      </div>
      <form className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-medium md:col-span-2">
          Title
          <input
            disabled
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
            placeholder="Follow up on panel approval"
          />
        </label>
        {projectId ? null : (
          <label className="block text-sm font-medium">
            Project
            <select
              disabled
              className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"
              defaultValue={projects[0].id}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm font-medium">
          Assign
          <input
            disabled
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
            placeholder="Jordan Hale"
          />
        </label>
        <label className="block text-sm font-medium">
          Due date
          <input
            type="date"
            disabled
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
          />
        </label>
        <label className="block text-sm font-medium">
          Priority
          <select
            disabled
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"
          >
            <option>high</option>
            <option>medium</option>
            <option>low</option>
          </select>
        </label>
        <div className="md:col-span-2">
          <button
            type="button"
            disabled
            className="min-h-11 rounded-xl bg-stone-900 px-4 text-sm font-medium text-white opacity-60"
          >
            Save task
          </button>
        </div>
      </form>
    </Card>
  );
}
