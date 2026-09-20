import { FieldLogList, NewFieldLogForm } from "@/components/field-log";
import { ProjectTabs } from "@/components/project-tabs";
import { PageHeader } from "@/components/ui";
import { listProjectFieldLogs } from "@/lib/field-logs";
import { getAuthorizedProject } from "@/lib/projects";

export default async function ProjectFieldPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getAuthorizedProject(id);
  const logs = await listProjectFieldLogs(id);

  return (
    <div>
      <PageHeader kicker="Field" title={project.name} />
      <ProjectTabs projectId={id} active="field" />
      <div className="grid gap-4 lg:grid-cols-2">
        <NewFieldLogForm
          projectId={id}
          projects={[{ id: project.id, name: project.name }]}
        />
        <FieldLogList
          logs={logs}
          projectNames={{ [project.id]: project.name }}
        />
      </div>
    </div>
  );
}
