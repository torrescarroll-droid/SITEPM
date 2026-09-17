import { FieldLogList, NewFieldLogForm } from "@/components/field-log";
import { ProjectTabs } from "@/components/project-tabs";
import { PageHeader } from "@/components/ui";
import { getAuthorizedProject } from "@/lib/projects";

export default async function ProjectFieldPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getAuthorizedProject(id);

  return (
    <div>
      <PageHeader kicker="Field" title={project.name} />
      <ProjectTabs projectId={id} active="field" />
      <div className="grid gap-4 lg:grid-cols-2">
        <NewFieldLogForm projectId={id} />
        <FieldLogList projectId={id} />
      </div>
    </div>
  );
}
