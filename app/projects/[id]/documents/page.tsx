import { notFound } from "next/navigation";
import { DocumentList } from "@/components/document-list";
import { ProjectTabs } from "@/components/project-tabs";
import { PageHeader } from "@/components/ui";
import { getProject } from "@/lib/demo-data";

export default async function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();

  return (
    <div>
      <PageHeader kicker="Documents" title={project.name} />
      <ProjectTabs projectId={id} active="documents" />
      <DocumentList projectId={id} />
    </div>
  );
}
