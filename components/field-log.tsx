import { fieldLogs, projectName, projects } from "@/lib/demo-data";
import { Card, DemoNote } from "@/components/ui";

export function FieldLogList({ projectId }: { projectId?: string }) {
  const rows = projectId
    ? fieldLogs.filter((log) => log.projectId === projectId)
    : fieldLogs;

  return (
    <div className="space-y-3">
      {rows.map((log) => (
        <Card key={log.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {projectId ? log.logDate : projectName(log.projectId)}
              </p>
              <p className="text-sm text-stone-500">
                {log.createdBy}
                {projectId ? "" : ` · ${log.logDate}`}
              </p>
            </div>
            {log.issueFlag ? (
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-900">
                Issue
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-700">{log.notes}</p>
          <p className="mt-3 text-sm text-stone-500">Photo: {log.photoCaption}</p>
        </Card>
      ))}
    </div>
  );
}

export function NewFieldLogForm({ projectId }: { projectId?: string }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        New log
      </h2>
      <div className="mt-3">
        <DemoNote>
          Field → choose project → photo → notes → flag issue → save. Demo only; not
          stored.
        </DemoNote>
      </div>
      <form className="mt-4 space-y-3">
        {projectId ? null : (
          <label className="block text-sm font-medium">
            Project
            <select
              disabled
              defaultValue={projects[0].id}
              className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"
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
          Date
          <input
            type="date"
            disabled
            defaultValue="2026-09-13"
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
          />
        </label>
        <label className="block text-sm font-medium">
          Notes
          <textarea
            disabled
            rows={3}
            placeholder="What happened on site?"
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input type="checkbox" disabled className="size-4" />
          Flag issue
        </label>
        <button
          type="button"
          disabled
          className="min-h-11 w-full rounded-xl border border-dashed border-stone-300 text-sm text-stone-500"
        >
          Take or upload photo
        </button>
        <button
          type="button"
          disabled
          className="min-h-11 w-full rounded-xl bg-stone-900 text-sm font-medium text-white opacity-60"
        >
          Save log
        </button>
      </form>
    </Card>
  );
}
