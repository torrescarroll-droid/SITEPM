import { AskThread } from "@/components/ask-thread";
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
      <PageHeader kicker="Ask SITEPM" title={project.name} />
      <ProjectTabs projectId={id} active="ask" />
      <AskThread projectId={id} />
    </div>
  );
}
