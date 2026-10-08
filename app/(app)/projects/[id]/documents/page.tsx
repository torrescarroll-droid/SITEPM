import { DocumentList, NewDocumentForm } from "@/components/document-list";
import { ProjectTabs } from "@/components/project-tabs";
import { PageHeader } from "@/components/ui";
import { PDF_ASK_EXPECTATION } from "@/lib/beta-copy";
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
      <PageHeader
        kicker="Plans & Docs"
        title={project.name}
        description={PDF_ASK_EXPECTATION}
      />
      <ProjectTabs projectId={id} active="documents" />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)]">
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
