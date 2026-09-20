import { DocumentList, NewDocumentForm } from "@/components/document-list";
import { PageHeader } from "@/components/ui";
import { listCompanyDocuments } from "@/lib/documents";
import { listCompanyProjects } from "@/lib/projects";

export default async function DocumentsPage() {
  const [projects, documents] = await Promise.all([
    listCompanyProjects(),
    listCompanyDocuments(),
  ]);
  const projectNames = Object.fromEntries(
    projects.map((project) => [project.id, project.name]),
  );

  return (
    <div>
      <PageHeader
        kicker="Documents"
        title="Project files"
        description="PDFs are stored privately for your company and tied to a job."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <NewDocumentForm
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
          }))}
        />
        <DocumentList
          documents={documents}
          projectNames={projectNames}
          showProject
        />
      </div>
    </div>
  );
}
