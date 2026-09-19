import Link from "next/link";
import { ProjectTabs } from "@/components/project-tabs";
import { Card, PageHeader, StatusPill } from "@/components/ui";
import { formatProjectDate, getAuthorizedProject } from "@/lib/projects";
import { listProjectTasks } from "@/lib/tasks";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getAuthorizedProject(id);
  const projectTasks = await listProjectTasks(id);
  const openTaskCount = projectTasks.filter((task) => task.status !== "done").length;

  return (
    <div>
      <PageHeader
        kicker="Project"
        title={project.name}
        description={project.address ?? undefined}
      />
      <ProjectTabs projectId={id} active="overview" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Overview
            </h2>
            <StatusPill status={project.status} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-500">Client</dt>
              <dd className="mt-0.5 font-medium">
                {project.client_name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Status</dt>
              <dd className="mt-0.5 font-medium">
                {project.status === "on_hold" ? "On hold" : project.status === "complete" ? "Complete" : "Active"}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Start</dt>
              <dd className="mt-0.5 font-medium">
                {formatProjectDate(project.start_date)}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Target completion</dt>
              <dd className="mt-0.5 font-medium">
                {formatProjectDate(project.target_completion_date)}
              </dd>
            </div>
          </dl>
          {project.description ? (
            <p className="mt-4 text-sm leading-6 text-stone-700">
              {project.description}
            </p>
          ) : null}
        </Card>
        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Tasks
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              {openTaskCount === 0
                ? "No open tasks on this job."
                : `${openTaskCount} open task${openTaskCount === 1 ? "" : "s"} on this job.`}
            </p>
            <Link href={`/projects/${id}/tasks`} className="mt-2 inline-block text-sm font-medium">
              Open tasks
            </Link>
          </Card>
          <Card>
            <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Field logs
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Field records are not connected to Supabase yet.
            </p>
            <Link href={`/projects/${id}/field`} className="mt-2 inline-block text-sm font-medium">
              Open field
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
