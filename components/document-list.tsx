"use client";

import { useActionState } from "react";
import { Card, DemoNote, documentLabel } from "@/components/ui";
import { formatProjectDate } from "@/lib/format-date";
import {
  openProjectDocument,
  uploadProjectDocument,
  type DocumentFormState,
} from "@/lib/document-actions";
import { DOCUMENT_TYPES, type DocumentRecord } from "@/lib/document-types";

const initialState: DocumentFormState = { error: null };

export function NewDocumentForm({
  projectId,
  projects,
}: {
  projectId?: string;
  projects: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(
    uploadProjectDocument,
    initialState,
  );
  const selectable = projectId
    ? projects.filter((project) => project.id === projectId)
    : projects;

  if (selectable.length === 0) {
    return (
      <Card>
        <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          Upload PDF
        </h2>
        <p className="mt-3 text-sm text-stone-600">
          Create a project first. Files are saved to a company job.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Upload PDF
      </h2>
      <div className="mt-3">
        <DemoNote>
          Stored privately for your company. The job is taken from this form,
          not typed as a company id. PDF only, 20 MB or smaller.
        </DemoNote>
      </div>
      <form action={action} className="mt-4 space-y-3">
        {projectId ? (
          <input type="hidden" name="project_id" value={projectId} />
        ) : (
          <label className="block text-sm font-medium">
            Project
            <select
              name="project_id"
              required
              className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"
              defaultValue={selectable[0]?.id}
            >
              {selectable.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm font-medium">
          Category
          <select
            name="document_type"
            required
            defaultValue="other"
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {documentLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          PDF
          <input
            name="file"
            type="file"
            required
            accept="application/pdf,.pdf"
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        {state.error ? (
          <p className="text-sm text-orange-800">{state.error}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-xl bg-stone-900 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Upload PDF"}
        </button>
      </form>
    </Card>
  );
}

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
    <div className="space-y-3">
      {documents.map((doc) => (
        <Card key={doc.id}>
          <p className="font-medium">{doc.filename}</p>
          <p className="mt-1 text-sm text-stone-600">
            {documentLabel(doc.document_type)}
            {showProject
              ? ` · ${projectNames[doc.project_id] ?? "Project"}`
              : null}
          </p>
          <p className="text-sm text-stone-500">
            {doc.uploaded_by_name ?? "Crew"} ·{" "}
            {formatProjectDate(doc.created_at.slice(0, 10))}
          </p>
          <form action={openProjectDocument} className="mt-3">
            <input type="hidden" name="document_id" value={doc.id} />
            <button
              type="submit"
              className="text-sm font-medium text-stone-950"
            >
              Open document
            </button>
          </form>
        </Card>
      ))}
    </div>
  );
}
