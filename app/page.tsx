import Link from "next/link";
import {
  briefingItems,
  fieldLogs,
  projectName,
  projects,
  tasks,
} from "@/lib/demo-data";
import { Card, PageHeader, StatusPill } from "@/components/ui";
import { checkSupabaseConnection } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabaseStatus = await checkSupabaseConnection();
  const activeProjects = projects.filter((project) => project.status === "active");
  const overdueTasks = tasks.filter((task) => task.overdue);
  const recentField = fieldLogs.slice(0, 3);

  return (
    <div>
      <PageHeader
        kicker="Home"
        title="Good morning, Jordan."
        description="Three things require your attention on 184 Willow Ave."
      />
      <p className="mb-6 text-sm text-stone-500">
        {supabaseStatus.ok
          ? "Supabase project reachable. Table data stays in the dashboard until Week 4 login."
          : `Supabase not reachable: ${supabaseStatus.detail}`}
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
            AI briefing
          </h2>
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
          <p className="mt-4 text-sm text-stone-500">
            Would you like to create the follow-up tasks? Approval is required.
            Demo only — no action is sent.
          </p>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Overdue tasks
            </h2>
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
      <div className="grid gap-3 md:grid-cols-2">
        {activeProjects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card className="h-full hover:border-stone-300">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{project.name}</p>
                  <p className="mt-1 text-sm text-stone-500">{project.address}</p>
                </div>
                <StatusPill status={project.status} />
              </div>
              <p className="mt-3 text-sm text-stone-600">
                Target {project.targetCompletionDate}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
