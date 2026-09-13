import { notFound } from "next/navigation";
import { AskThread } from "@/components/ask-thread";
import { ProjectTabs } from "@/components/project-tabs";
import { PageHeader } from "@/components/ui";
import { getProject } from "@/lib/demo-data";

export default async function ProjectAskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();

  return (
    <div>
      <PageHeader kicker="Ask SITEPM" title={project.name} />
      <ProjectTabs projectId={id} active="ask" />
      <AskThread projectId={id} />
    </div>
  );
}
