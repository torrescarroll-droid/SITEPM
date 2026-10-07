import type { ReactNode } from "react";
import Link from "next/link";
import { AskProjectForm } from "@/components/ask-thread";
import { documentLabel, PriorityPill, TaskStatusText } from "@/components/ui";
import { formatCrewLine } from "@/lib/daily-report";
import { formatProjectDate } from "@/lib/format-date";
import type { JobDeskView } from "@/lib/job-desk";
import { openReportPhoto } from "@/lib/photo-actions";
import type { ProjectRecord } from "@/lib/projects";
import { scheduleStatusLabel } from "@/lib/schedule-types";
import { taskIsOverdue } from "@/lib/task-types";

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-t border-stone-200 py-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          {title}
        </h2>
        {action ? (
          <Link
            href={action.href}
            className="min-h-11 shrink-0 py-2 text-sm font-medium text-stone-950"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function noteExcerpt(notes: string | null | undefined) {
  const text = notes?.trim();
  if (!text) return "No notes recorded.";
  if (text.length <= 180) return text;
  return `${text.slice(0, 177)}…`;
}

function reportExcerpt(log: JobDeskView["recentLogs"][number]) {
  return noteExcerpt(log.work_performed || log.delays || log.notes || log.tomorrow);
}

export function JobDesk({
  project,
  desk,
}: {
  project: ProjectRecord;
  desk: JobDeskView;
}) {
  const jobHref = `/projects/${project.id}`;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-500">Status</dt>
            <dd className="mt-0.5 font-medium">
              {project.status === "on_hold"
                ? "On hold"
                : project.status === "complete"
                  ? "Complete"
                  : "Active"}
            </dd>
          </div>
          {project.client_name ? (
            <div>
              <dt className="text-stone-500">Client</dt>
              <dd className="mt-0.5 font-medium">{project.client_name}</dd>
            </div>
          ) : null}
          {project.start_date ? (
            <div>
              <dt className="text-stone-500">Start</dt>
              <dd className="mt-0.5 font-medium">
                {formatProjectDate(project.start_date)}
              </dd>
            </div>
          ) : null}
          {project.target_completion_date ? (
            <div>
              <dt className="text-stone-500">Target completion</dt>
              <dd className="mt-0.5 font-medium">
                {formatProjectDate(project.target_completion_date)}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
      {project.description ? (
        <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-700">
          {project.description}
        </p>
      ) : null}

      <div className="mt-5">
        <AskProjectForm projectId={project.id} projectName={project.name} />
      </div>

      <Section id="needs-attention" title="Needs attention">
        {desk.hasAttention ? (
          <ul className="space-y-3">
            {desk.attention.overdue.map((task) => (
              <li key={task.id} className="text-sm">
                <p className="font-medium">{task.title}</p>
                <p className="text-orange-800">
                  Overdue
                  {task.due_date
                    ? ` · due ${formatProjectDate(task.due_date)}`
                    : ""}
                </p>
              </li>
            ))}
            {desk.attention.highPriority.map((task) => (
              <li key={task.id} className="text-sm">
                <p className="font-medium">{task.title}</p>
                <p className="text-stone-600">
                  High priority
                  {task.due_date
                    ? ` · due ${formatProjectDate(task.due_date)}`
                    : ""}
                </p>
              </li>
            ))}
            {desk.attention.flaggedLogs.map((log) => (
              <li key={log.id} className="text-sm">
                <p className="font-medium">
                  Daily report · {formatProjectDate(log.log_date)}
                </p>
                <p className="text-orange-800">Issue flagged</p>
                <p className="text-stone-600">{reportExcerpt(log)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-600">
            Nothing in the job record is overdue, high priority, or flagged.
          </p>
        )}
      </Section>

      <Section
        id="schedule"
        title={`Schedule${desk.schedule.activityCount > 0 ? ` · ${desk.schedule.activityCount}` : ""}`}
        action={{ href: `${jobHref}/schedule`, label: "Open schedule" }}
      >
        {desk.schedule.activityCount === 0 ? (
          <p className="text-sm text-stone-600">
            No activities on this job yet. The schedule is the work sequence, not a file.
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            {desk.schedule.late.length > 0 ? (
              <div>
                <p className="font-medium text-orange-800">Late</p>
                <ul className="mt-1 space-y-1">
                  {desk.schedule.late.map((activity) => (
                    <li key={activity.id}>
                      {activity.name}
                      {activity.finish_date
                        ? ` · finish ${formatProjectDate(activity.finish_date)}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {desk.schedule.current.length > 0 ? (
              <div>
                <p className="font-medium">Current</p>
                <ul className="mt-1 space-y-1">
                  {desk.schedule.current.map((activity) => (
                    <li key={activity.id}>
                      {activity.name} · {scheduleStatusLabel(activity.status)}
                      {activity.trade_name ? ` · ${activity.trade_name}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {desk.schedule.upcoming.length > 0 ? (
              <div>
                <p className="font-medium">Upcoming</p>
                <ul className="mt-1 space-y-1">
                  {desk.schedule.upcoming.map((activity) => (
                    <li key={activity.id}>
                      {activity.name}
                      {activity.start_date
                        ? ` · ${formatProjectDate(activity.start_date)}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {desk.schedule.late.length === 0 &&
            desk.schedule.current.length === 0 &&
            desk.schedule.upcoming.length === 0 ? (
              <p className="text-stone-600">
                Activities are on the job. None are late, current, or upcoming from today’s dates.
              </p>
            ) : null}
          </div>
        )}
      </Section>

      <Section
        id="open-items"
        title={`Open to-dos${desk.openItemCount > 0 ? ` · ${desk.openItemCount}` : ""}`}
        action={{ href: `${jobHref}/tasks`, label: "To-dos" }}
      >
        {desk.openItems.length === 0 ? (
          <p className="text-sm text-stone-600">No open to-dos on this job.</p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {desk.openItems.map((task) => (
              <li key={task.id} className="py-3 text-sm first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{task.title}</p>
                  <span className="flex items-center gap-2">
                    {task.priority ? <PriorityPill priority={task.priority} /> : null}
                    <TaskStatusText
                      status={task.status}
                      overdue={taskIsOverdue(task)}
                    />
                  </span>
                </div>
                {task.due_date ? (
                  <p className="mt-1 text-stone-500">
                    Due {formatProjectDate(task.due_date)}
                  </p>
                ) : null}
                {task.description ? (
                  <p className="mt-1 text-stone-600">{noteExcerpt(task.description)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        id="daily-reports"
        title={`Daily reports${desk.logCount > 0 ? ` · ${desk.logCount}` : ""}`}
        action={{ href: `${jobHref}/field`, label: "All daily reports" }}
      >
        {desk.recentLogs.length === 0 ? (
          <p className="text-sm text-stone-600">No daily reports on this job yet.</p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {desk.recentLogs.map((log) => (
              <li key={log.id} className="py-3 text-sm first:pt-0">
                <p className="font-medium">
                  {formatProjectDate(log.log_date)}
                  {log.issue_flag ? " · Issue flagged" : ""}
                </p>
                {log.created_by_name ? (
                  <p className="text-stone-500">{log.created_by_name}</p>
                ) : null}
                <p className="mt-1 text-stone-700">{reportExcerpt(log)}</p>
                {(log.crews ?? []).length > 0 ? (
                  <ul className="mt-2 space-y-1 text-stone-600">
                    {(log.crews ?? []).map((crew) => (
                      <li key={crew.id}>
                        {formatCrewLine({
                          companyName: crew.company_name,
                          tradeName: crew.trade_name,
                          workerCount: crew.worker_count,
                        })}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="photos" title="Recent photos" action={{ href: `${jobHref}/field`, label: "Daily reports" }}>
        {desk.recentPhotos.length === 0 ? (
          <p className="text-sm text-stone-600">
            No photos on this job yet. Add one from the day’s report.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {desk.recentPhotos.map((photo) => (
              <li key={photo.id} className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0">
                <div>
                  <p className="font-medium">{photo.caption || "Jobsite photo"}</p>
                  <p className="text-stone-500">{formatProjectDate(photo.created_at.slice(0, 10))}</p>
                </div>
                <form action={openReportPhoto}>
                  <input type="hidden" name="photo_id" value={photo.id} />
                  <button type="submit" className="min-h-11 font-medium text-stone-950">
                    Open
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        id="plans-docs"
        title={`Plans & docs${desk.documentCount > 0 ? ` · ${desk.documentCount}` : ""}`}
        action={{ href: `${jobHref}/documents`, label: "All files" }}
      >
        {desk.documents.length === 0 ? (
          <p className="text-sm text-stone-600">
            No ready plans or files on this job yet.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {desk.documents.map((document) => (
              <li key={document.id} className="py-3 text-sm first:pt-0">
                <p className="font-medium">{document.filename}</p>
                <p className="text-stone-500">
                  {documentLabel(document.document_type)} ·{" "}
                  {formatProjectDate(document.created_at.slice(0, 10))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
