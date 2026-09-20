import { DocumentList, NewDocumentForm } from "@/components/document-list";
import { ProjectTabs } from "@/components/project-tabs";
import { PageHeader } from "@/components/ui";
import { listProjectDocuments } from "@/lib/documents";
import { getAuthorizedProject } from "@/lib/projects";

export default async function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getAuthorizedProject(id);
  const documents = await listProjectDocuments(id);

  return (
    <div>
      <PageHeader kicker="Documents" title={project.name} />
      <ProjectTabs projectId={id} active="documents" />
      <div className="grid gap-4 lg:grid-cols-2">
        <NewDocumentForm
          projectId={id}
          projects={[{ id: project.id, name: project.name }]}
        />
        <DocumentList
          documents={documents}
          projectNames={{ [project.id]: project.name }}
        />
      </div>
    </div>
  );
}
