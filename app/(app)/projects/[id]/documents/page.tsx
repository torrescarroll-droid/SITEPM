import { DocumentDesk } from "@/components/document-desk";
import { PageHeader } from "@/components/ui";
import { ProjectTabs } from "@/components/project-tabs";
import { getAuthorizedProject } from "@/lib/projects";
export default async function ProjectDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const [project, filters] = await Promise.all([
    getAuthorizedProject(id),
    searchParams,
  ]);
  return (
    <div>
      <PageHeader
        kicker="Plans & Docs"
        title={project.name}
        description="Current files, source history and work references — private to your company."
      />
      <ProjectTabs projectId={id} active="documents" />
      <DocumentDesk projects={[project]} projectId={id} filters={filters} />
    </div>
  );
}
