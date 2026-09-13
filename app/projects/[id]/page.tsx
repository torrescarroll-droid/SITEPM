import Link from "next/link";
import { notFound } from "next/navigation";
import { fieldLogs, getProject, tasks } from "@/lib/demo-data";
import { ProjectTabs } from "@/components/project-tabs";
import { Card, PageHeader, StatusPill } from "@/components/ui";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();

  const projectTasks = tasks.filter((task) => task.projectId === id);
  const projectLogs = fieldLogs.filter((log) => log.projectId === id);

  return (
    <div>
      <PageHeader kicker="Project" title={project.name} description={project.address} />
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
              <dd className="mt-0.5 font-medium">{project.clientName}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Status</dt>
              <dd className="mt-0.5 font-medium">
                {project.status === "on_hold" ? "On hold" : "Active"}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Start</dt>
              <dd className="mt-0.5 font-medium">{project.startDate}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Target completion</dt>
              <dd className="mt-0.5 font-medium">{project.targetCompletionDate}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-6 text-stone-700">{project.description}</p>
        </Card>
        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Tasks
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              {projectTasks.length} on this job
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
              {projectLogs.length} recent entries
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
