import { FieldLogList, NewFieldLogForm } from "@/components/field-log";
import { ProjectTabs } from "@/components/project-tabs";
import { PageHeader } from "@/components/ui";
import { listProjectFieldLogs } from "@/lib/field-logs";
import { listProjectPhotos } from "@/lib/photos";
import { getAuthorizedProject } from "@/lib/projects";

export default async function ProjectFieldPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getAuthorizedProject(id);
  const [logs, photos] = await Promise.all([
    listProjectFieldLogs(id),
    listProjectPhotos(id),
  ]);

  return (
    <div>
      <PageHeader kicker="Daily Reports" title={project.name} />
      <ProjectTabs projectId={id} active="field" />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <NewFieldLogForm
          projectId={id}
          projects={[{ id: project.id, name: project.name }]}
        />
        <FieldLogList
          logs={logs}
          photos={photos}
          projectNames={{ [project.id]: project.name }}
        />
      </div>
    </div>
  );
}
