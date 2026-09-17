import Link from "next/link";
import {
  briefingItems,
  fieldLogs,
  projectName,
  tasks,
} from "@/lib/demo-data";
import { Card, PageHeader, StatusPill } from "@/components/ui";
import { requireCompanyContext } from "@/lib/auth-context";
import { formatProjectDate, listCompanyProjects } from "@/lib/projects";

export default async function DashboardPage() {
  const { profile } = await requireCompanyContext();
  const liveProjects = await listCompanyProjects();
  const activeProjects = liveProjects.filter(
    (project) => project.status === "active",
  );
  const overdueTasks = tasks.filter((task) => task.overdue);
  const recentField = fieldLogs.slice(0, 3);
  const firstName =
    profile?.full_name?.trim().split(/\s+/)[0] || "there";

  return (
    <div>
      <PageHeader
        kicker="Home"
        title={`Good morning, ${firstName}.`}
        description={
          activeProjects.length > 0
            ? `${activeProjects.length} active job${activeProjects.length === 1 ? "" : "s"} in your company.`
            : "Create a project to start the job record for your company."
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
            AI briefing
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            Sample briefing only. It is not generated from live jobs yet.
          </p>
          <ol className="mt-4 space-y-4">
            {briefingItems.map((item, index) => (
              <li key={item.id} className="border-t border-stone-100 pt-4 first:border-0 first:pt-0">
                <p className="text-sm font-medium text-stone-950">
                  {index + 1}. {item.issue}
                </p>
                <p className="mt-1 text-sm text-stone-600">{item.why}</p>
                <p className="mt-1 text-sm text-stone-500">{item.source}</p>
                <p className="mt-2 text-sm text-stone-800">
                  Recommended: {item.action}
                </p>
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Overdue tasks
            </h2>
            <p className="mt-2 text-sm text-stone-500">Demo items — not live.</p>
            <ul className="mt-3 space-y-3">
              {overdueTasks.map((task) => (
                <li key={task.id}>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-sm text-stone-500">
                    {projectName(task.projectId)} · due {task.dueDate}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Recent field activity
            </h2>
            <p className="mt-2 text-sm text-stone-500">Demo items — not live.</p>
            <ul className="mt-3 space-y-3">
              {recentField.map((log) => (
                <li key={log.id}>
                  <p className="text-sm font-medium">
                    {projectName(log.projectId)}
                    {log.issueFlag ? " · Issue flagged" : ""}
                  </p>
                  <p className="text-sm text-stone-500">
                    {log.logDate} · {log.createdBy}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Active projects
      </h2>
      {activeProjects.length === 0 ? (
        <Card>
          <p className="text-sm text-stone-600">
            No active jobs yet.{" "}
            <Link href="/projects/new" className="font-medium text-stone-950">
              Create a project
            </Link>
            .
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {activeProjects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full hover:border-stone-300">
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
    </div>
  );
}
