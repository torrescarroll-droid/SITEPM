import Link from "next/link";
import { TimeGreeting } from "@/components/time-greeting";
import { Card, PageHeader, StatusPill } from "@/components/ui";
import { requireCompanyContext } from "@/lib/auth-context";
import { listRecentCompanyFieldLogs } from "@/lib/field-logs";
import { formatProjectDate, listCompanyProjects } from "@/lib/projects";
import { listCompanyTasks } from "@/lib/tasks";
import { taskIsOverdue } from "@/lib/task-types";

export default async function DashboardPage() {
  const { profile } = await requireCompanyContext();
  const liveProjects = await listCompanyProjects();
  const liveTasks = await listCompanyTasks();
  const recentField = await listRecentCompanyFieldLogs(3);
  const projectNames = Object.fromEntries(
    liveProjects.map((project) => [project.id, project.name]),
  );
  const activeProjects = liveProjects.filter(
    (project) => project.status === "active",
  );
  const overdueTasks = liveTasks.filter(taskIsOverdue);
  const firstName =
    profile?.full_name?.trim().split(/\s+/)[0] || "there";

  return (
    <div>
      <PageHeader
        kicker="Home"
        title={<TimeGreeting name={firstName} />}
        description={
          activeProjects.length > 0
            ? `${activeProjects.length} active job${activeProjects.length === 1 ? "" : "s"} in your company.`
            : "Create a job to start the record for your company."
        }
      />
      <div className="home-grid">
        <section aria-label="Overdue to-dos" className="home-attention">
        <Card>
          <h2 className="section-title">
            Overdue to-dos
          </h2>
          {overdueTasks.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">No overdue to-dos.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {overdueTasks.map((task) => (
                <li key={task.id}>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-sm text-stone-500">
                    {projectNames[task.project_id] ?? "Job"} · due{" "}
                    {formatProjectDate(task.due_date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        </section>
        <section aria-label="Active jobs" className="home-jobs">
      <h2 className="mb-3 section-title">
        Active jobs
      </h2>
      {activeProjects.length === 0 ? (
        <Card>
          <p className="text-sm text-stone-600">
            No active jobs yet.{" "}
            <Link href="/projects/new" className="font-medium text-stone-950">
              Create a job
            </Link>
            .
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {activeProjects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full hover:border-stone-400">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="mt-1 text-sm text-stone-500">
                      {project.address ?? "No address listed"}
                    </p>
                  </div>
                  <StatusPill status={project.status} />
                </div>
                <p className="mt-3 text-sm text-stone-600">
                  Target {formatProjectDate(project.target_completion_date)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}


        </section>
        <section aria-label="Recent daily reports" className="home-reports">
        <Card>
          <h2 className="section-title">
            Recent daily reports
          </h2>
          {recentField.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">No daily reports yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {recentField.map((log) => (
                <li key={log.id}>
                  <p className="text-sm font-medium">
                    {projectNames[log.project_id] ?? "Job"}
                    {log.issue_flag ? " · Issue flagged" : ""}
                  </p>
                  <p className="text-sm text-stone-500">
                    {formatProjectDate(log.log_date)}
                    {log.created_by_name ? ` · ${log.created_by_name}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        </section>
      </div>
      <p className="mt-6 text-sm text-stone-500">
        <Link href="/guide" className="font-medium text-stone-950">
          Private beta guide
        </Link>
        {" — "}how to run a job: schedule, daily report, to-do, and plans.
      </p>

    </div>
  );
}
