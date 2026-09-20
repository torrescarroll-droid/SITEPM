import { AskProjectForm } from "@/components/ask-thread";
import { ProjectTabs } from "@/components/project-tabs";
import { PageHeader } from "@/components/ui";
import { getAuthorizedProject } from "@/lib/projects";

export default async function ProjectAskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getAuthorizedProject(id);

  return (
    <div>
      <PageHeader
        kicker="Ask SITEPM"
        title={project.name}
        description="This Ask session is limited to this job's records. Other company projects are not included."
      />
      <ProjectTabs projectId={project.id} active="ask" />
      <AskProjectForm projectId={project.id} projectName={project.name} />
    </div>
  );
}
