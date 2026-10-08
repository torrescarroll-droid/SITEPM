import Link from "next/link";
import { Card } from "@/components/ui";
import { TaskStatusControl } from "@/components/task-status-control";
import { formatProjectDate } from "@/lib/format-date";
import type { OperationalLookahead } from "@/lib/operational-lookahead";
import { scheduleStatusLabel } from "@/lib/schedule-types";
import type { TaskRecord } from "@/lib/task-types";

function TaskLine({ task, today }: { task: TaskRecord; today: string }) {
  return (
    <li className="border-b border-stone-100 py-3 last:border-0">
      <p className="font-medium">{task.title}</p>
      <p className="mt-1 text-sm text-stone-600">
        {task.responsible_name?.trim() || "Owner not recorded"} · {task.trade_name?.trim() || "Trade not recorded"}
        {task.location_text ? ` · ${task.location_text}` : ""}
        {task.due_date ? ` · Due ${formatProjectDate(task.due_date)}` : " · No due date"}
      </p>
      {task.status !== "done" && task.due_date && task.due_date < today ? <span className="status-badge status-attention">Overdue</span> : null}
      {task.source_field_log_id ? <Link className="ml-2 text-sm underline" href={`/projects/${task.project_id}/field/${task.source_field_log_id}`}>Source report</Link> : null}
      <TaskStatusControl task={task} />
    </li>
  );
}

export function OperationalLookaheadView({ projectId, view }: { projectId: string; view: OperationalLookahead }) {
  const base = `/projects/${projectId}`;
  const uncovered = view.reportFollowUps.filter((item) => item.state === "needs_action");
  return (
    <div className="space-y-5">
      <Card>
        <h2 className="section-title">Job check-in</h2>
        <p className="mt-2 text-sm text-stone-600">{formatProjectDate(view.today)} through {formatProjectDate(view.through)} · Includes overdue work and held activities.</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div><dt className="text-sm text-stone-500">To-dos completed</dt><dd className="font-medium">{view.taskProgress.done} of {view.taskProgress.total}</dd></div>
          <div><dt className="text-sm text-stone-500">Activities completed</dt><dd className="font-medium">{view.scheduleProgress.done} of {view.scheduleProgress.total}</dd></div>
          <div><dt className="text-sm text-stone-500">Reports needing an action</dt><dd className="font-medium">{uncovered.length}</dd></div>
          <div><dt className="text-sm text-stone-500">Latest site report</dt><dd className="font-medium">{view.latestReport ? formatProjectDate(view.latestReport.log_date) : "Not recorded"}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-stone-500">Counts describe recorded work; they are not a physical construction completion percentage.</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium">
          <Link className="underline" href={`${base}/field`}>Record the day</Link>
          <Link className="underline" href={`${base}/tasks`}>Assign or edit a to-do</Link>
          <Link className="underline" href={`${base}/documents`}>Plans & docs</Link>
        </div>
      </Card>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="section-title">Due next / overdue</h2>
          {view.dueTasks.length ? <ul>{view.dueTasks.map((task) => <TaskLine key={task.id} task={task} today={view.today} />)}</ul> : <p className="mt-3 text-sm text-stone-600">No recorded to-dos due in this window.</p>}
        </Card>
        <Card>
          <h2 className="section-title">Schedule readiness</h2>
          <Link className="mt-2 inline-block text-sm underline" href={`${base}/schedule`}>Update the schedule</Link>
          {view.activities.length ? <ul className="divide-y divide-stone-100">{view.activities.map(({ activity, late, predecessorPending, predecessorName }) => (
            <li className="py-3" key={activity.id}>
              <p className="font-medium">{activity.name}{activity.is_milestone ? " · Milestone" : ""}</p>
              <p className="text-sm text-stone-600">{activity.trade_name || "Trade not recorded"} · {scheduleStatusLabel(activity.status)}</p>
              <p className="text-sm text-stone-600">{formatProjectDate(activity.start_date)} → {formatProjectDate(activity.finish_date)}</p>
              {late ? <p className="text-sm text-attention">Planned finish has passed.</p> : null}
              {predecessorPending ? <p className="text-sm text-attention">Predecessor not recorded complete: {predecessorName}. Confirm readiness before starting.</p> : null}
              {activity.assignments?.length ? <p className="text-sm">{activity.assignments.length} expected resource assignment(s) · not actual attendance</p> : null}
              {activity.source_task_id ? <Link className="min-h-11 inline-flex items-center text-sm underline" href={`${base}/tasks#task-${activity.source_task_id}`}>Source to-do</Link> : null}
              {activity.notes ? <p className="mt-1 whitespace-pre-wrap text-sm">{activity.notes}</p> : null}
            </li>
          ))}</ul> : <p className="mt-3 text-sm text-stone-600">No recorded activities in this window. Add dates in Schedule to plan the next trades.</p>}
        </Card>
      </div>
      <Card>
        <h2 className="section-title">Report follow-through</h2>
        <p className="mt-2 text-sm text-stone-600">Flagged reports and recorded delays, with their linked to-dos. Completing a to-do does not clear the original report flag.</p>
        {view.reportFollowUps.length ? <ul className="divide-y divide-stone-100">{view.reportFollowUps.map(({ report, tasks, state, photoCount }) => (
          <li className="py-3" key={report.id}>
            <Link className="font-medium underline" href={`${base}/field/${report.id}`}>{formatProjectDate(report.log_date)}{report.location_text ? ` · ${report.location_text}` : ""}</Link>
            <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{report.delays || report.notes || report.work_performed || "Report flagged for review."}</p>
            <p className="mt-2 text-sm font-medium">{state === "needs_action" ? "No linked action yet" : state === "open" ? `${tasks.filter((task) => task.status !== "done").length} open follow-up(s)` : "Linked to-dos completed — verify the field condition"} · {photoCount} photo(s)</p>
            {tasks.length ? <ul>{tasks.map((task) => <TaskLine key={task.id} task={task} today={view.today} />)}</ul> : null}
            <Link className="mt-2 inline-block min-h-11 py-2 text-sm underline" href={`${base}/field/${report.id}#follow-up`}>Review report / add follow-up</Link>
          </li>
        ))}</ul> : <p className="mt-3 text-sm text-stone-600">No flagged reports or recorded delays.</p>}
      </Card>
      <Card>
        <h2 className="section-title">Trade coordination</h2>
        <p className="mt-2 text-sm text-stone-600">Open to-dos by recorded trade, alongside activities in this window. Trade names do not imply an assigned subcontractor.</p>
        {view.trades.length ? <div className="mt-3 grid gap-4 md:grid-cols-2">{view.trades.map((trade) => (
          <div className="rounded-lg border border-stone-200 p-3" key={trade.name}>
            <h3 className="font-medium">{trade.name}</h3>
            <p className="mt-1 text-sm">{trade.tasks.length} open to-do(s) · {trade.activities.length} activity/activities</p>
            <ul className="mt-2 space-y-1 text-sm">{trade.tasks.map((task) => <li key={task.id}>{task.title} — {task.responsible_name || "Owner not recorded"}</li>)}{trade.activities.map(({ activity }) => <li key={activity.id}>{activity.name} — {scheduleStatusLabel(activity.status)}</li>)}</ul>
          </div>
        ))}</div> : <p className="mt-3 text-sm text-stone-600">No open trade work recorded.</p>}
      </Card>
      <Card>
        <h2 className="section-title">Planning gaps</h2>
        <p className="mt-2 text-sm text-stone-600">{view.unassigned.length} open to-do(s) without a responsible person · {view.undated.length} without a due date.</p>
        <ul className="mt-2 space-y-2 text-sm">{[...new Map([...view.unassigned, ...view.undated].map((task) => [task.id, task])).values()].map((task) => <li key={task.id}><Link className="underline" href={`${base}/tasks#task-${task.id}`}>{task.title}</Link>{!task.responsible_name?.trim() ? " · Owner needed" : ""}{!task.due_date ? " · Date needed" : ""}</li>)}</ul>
      </Card>
    </div>
  );
}
