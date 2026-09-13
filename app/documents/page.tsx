import { DocumentList } from "@/components/document-list";
import { PageHeader } from "@/components/ui";

export default function DocumentsPage() {
  return (
    <div>
      <PageHeader
        kicker="Documents"
        title="Project files"
        description="Each file belongs to a project. Company isolation is not live yet."
      />
      <DocumentList />
    </div>
  );
}
