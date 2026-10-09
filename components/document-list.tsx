"use client";
import { Card, documentLabel } from "@/components/ui";
import { formatProjectDate } from "@/lib/format-date";
import { openProjectDocument } from "@/lib/document-actions";
import { type DocumentRecord } from "@/lib/document-types";

export function DocumentList({
  documents,
  projectNames,
  showProject,
}: {
  documents: DocumentRecord[];
  projectNames: Record<string, string>;
  showProject?: boolean;
}) {
  if (documents.length === 0) {
    return (
      <Card>
        <p className="font-medium">No documents yet</p>
        <p className="mt-1 text-sm text-stone-600">
          Upload a PDF. It is stored for your company only.
        </p>
      </Card>
    );
  }

  return (
    <div className="record-stack document-records">
      {documents.map((doc) => (
        <Card key={doc.id} className="document-row">
          <p className="font-medium">{doc.filename}</p>
          <p className="mt-1 text-sm text-stone-600">
            {documentLabel(doc.document_type)}
            {showProject ? ` · ${projectNames[doc.project_id] ?? "Job"}` : null}
          </p>
          <p className="text-sm text-stone-500">
            {doc.uploaded_by_name ?? "Crew"} ·{" "}
            {formatProjectDate(doc.created_at.slice(0, 10))}
          </p>
          <form action={openProjectDocument} className="document-action">
            <input type="hidden" name="document_id" value={doc.id} />
            <button
              type="submit"
              className="control text-sm font-medium text-stone-950"
            >
              Open document
            </button>
          </form>
        </Card>
      ))}
    </div>
  );
}
