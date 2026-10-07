import {
  ASK_RETRIEVAL_CAPS,
  assembleAskEvidencePack,
  budgetDocumentChunkHits,
  documentChunkEvidenceItem,
  type AskEvidencePack,
} from "@/lib/ask-evidence";
import { searchAuthorizedDocumentChunksForAskQuestion } from "@/lib/ask-lexical-query";
import { requireAuthorizedAskProject } from "@/lib/ask-scope";
import { assertAskRetrievalProjectScope } from "@/lib/ask-scope";
import type { DocumentChunkHit } from "@/lib/document-intelligence-types";
import { listProjectDocuments } from "@/lib/documents";
import { listProjectFieldLogs } from "@/lib/field-logs";
import { listProjectPhotos } from "@/lib/photos";
import { listProjectScheduleActivities } from "@/lib/schedule";
import { listProjectTasks } from "@/lib/tasks";

function assertSameCompany(
  companyId: string,
  rows: { company_id: string }[],
) {
  for (const row of rows) {
    if (row.company_id !== companyId) {
      throw new Error("Ask retrieval escaped the authorized company.");
    }
  }
}

/**
 * Independent Stage 4D check on raw 4C hits. Call after retrieval succeeds
 * and before budgeting or evidence-item construction. Fail closed; do not
 * rewrite hit scope to the authorized ids.
 */
export function assertAuthorizedDocumentChunkHits(
  projectId: string,
  companyId: string,
  hits: DocumentChunkHit[],
) {
  for (const hit of hits) {
    if (hit.project_id !== projectId) {
      throw new Error("Ask retrieval escaped the authorized project.");
    }
    if (hit.company_id !== companyId) {
      throw new Error("Ask retrieval escaped the authorized company.");
    }
  }
}

/**
 * Deterministic Project Knowledge retrieval for SITEPM Intelligence.
 * Call only after (or inside) project authorization. Never pass a project id
 * from model output, retrieved text, or an unauthenticated client as authority.
 */
export async function retrieveAskProjectEvidence(
  projectId: string,
  options?: { question?: string },
): Promise<AskEvidencePack | null> {
  const scoped = await requireAuthorizedAskProject(projectId);
  if (!scoped) {
    return null;
  }

  const authorizedId = scoped.project.id;
  const companyId = scoped.project.company_id;

  const [tasks, fieldLogs, documents, activities, photos, chunkResult] = await Promise.all([
    listProjectTasks(authorizedId),
    listProjectFieldLogs(authorizedId),
    listProjectDocuments(authorizedId),
    listProjectScheduleActivities(authorizedId),
    listProjectPhotos(authorizedId),
    searchAuthorizedDocumentChunksForAskQuestion({
      projectId: authorizedId,
      question: options?.question ?? "",
      asOf: null,
    }),
  ]);
  const chunkHits = chunkResult.hits;

  if (!chunkHits) {
    return null;
  }

  assertAuthorizedDocumentChunkHits(authorizedId, companyId, chunkHits);

  const boundedTasks = tasks.slice(0, ASK_RETRIEVAL_CAPS.tasks);
  const boundedLogs = fieldLogs.slice(0, ASK_RETRIEVAL_CAPS.fieldLogs);
  const boundedDocs = documents.slice(0, ASK_RETRIEVAL_CAPS.documents);
  const boundedActivities = activities.slice(0, ASK_RETRIEVAL_CAPS.scheduleActivities);
  const readyPhotos = photos.filter((photo) => photo.status === "ready");
  const filenameById = new Map(
    documents.map((document) => [document.id, document.filename]),
  );
  const boundedChunks = budgetDocumentChunkHits(chunkHits).map((hit) =>
    documentChunkEvidenceItem(
      authorizedId,
      hit,
      filenameById.get(hit.document_id) ?? "document",
    ),
  );

  assertAskRetrievalProjectScope(authorizedId, boundedTasks);
  assertAskRetrievalProjectScope(authorizedId, boundedLogs);
  assertAskRetrievalProjectScope(authorizedId, boundedDocs);
  assertAskRetrievalProjectScope(authorizedId, boundedActivities);
  assertAskRetrievalProjectScope(authorizedId, readyPhotos);
  assertAskRetrievalProjectScope(
    authorizedId,
    boundedChunks.map((item) => ({ project_id: item.projectId })),
  );
  assertSameCompany(companyId, boundedTasks);
  assertSameCompany(companyId, boundedLogs);
  assertSameCompany(companyId, boundedDocs);
  assertSameCompany(companyId, boundedActivities);
  assertSameCompany(companyId, readyPhotos);

  for (const document of boundedDocs) {
    if (document.status !== "ready") {
      throw new Error("Ask retrieval included a document that is not ready.");
    }
  }

  return assembleAskEvidencePack({
    project: scoped.project,
    tasks: boundedTasks,
    fieldLogs: boundedLogs,
    documents: boundedDocs,
    documentChunks: boundedChunks,
    activities: boundedActivities,
    photos: readyPhotos,
  });
}
