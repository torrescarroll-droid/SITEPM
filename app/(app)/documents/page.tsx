import { DocumentDesk } from "@/components/document-desk";
import { PageHeader } from "@/components/ui";
import { listCompanyProjects } from "@/lib/projects";
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [projects, filters] = await Promise.all([
    listCompanyProjects(),
    searchParams,
  ]);
  return (
    <div>
      <PageHeader
        kicker="Plans & Docs"
        title="Document desk"
        description="Find the right issue. Preserve the source. Coordinate the work."
      />
      <DocumentDesk projects={projects} filters={filters} />
    </div>
  );
}
