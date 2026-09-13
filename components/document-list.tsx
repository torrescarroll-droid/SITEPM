import { documents, projectName } from "@/lib/demo-data";
import { Card, DemoNote, documentLabel } from "@/components/ui";

export function DocumentList({ projectId }: { projectId?: string }) {
  const rows = projectId
    ? documents.filter((doc) => doc.projectId === projectId)
    : documents;

  return (
    <div className="space-y-3">
      <DemoNote>
        PDF upload is not connected. Filenames below are demo records only.
      </DemoNote>
      {rows.map((doc) => (
        <Card key={doc.id}>
          <p className="font-medium">{doc.filename}</p>
          <p className="mt-1 text-sm text-stone-600">
            {documentLabel(doc.documentType)}
            {projectId ? null : ` · ${projectName(doc.projectId)}`}
          </p>
          <p className="text-sm text-stone-500">
            {doc.uploadedBy} · {doc.createdAt}
          </p>
          <p className="mt-2 text-sm font-medium text-stone-400">Open document (demo)</p>
        </Card>
      ))}
    </div>
  );
}
