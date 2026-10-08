import { DocumentList, NewDocumentForm } from "@/components/document-list";
import { PageHeader } from "@/components/ui";
import { PDF_ASK_EXPECTATION } from "@/lib/beta-copy";
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
        kicker="Plans & Docs"
        title="Files"
        description={`PDFs are stored privately for your company and tied to a job. ${PDF_ASK_EXPECTATION}`}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)]">
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
