import {
  ASK_RETRIEVAL_CAPS,
  assembleAskEvidencePack,
  type AskEvidencePack,
} from "@/lib/ask-evidence";
import { requireAuthorizedAskProject } from "@/lib/ask-scope";
import { assertAskRetrievalProjectScope } from "@/lib/ask-scope";
import { listProjectDocuments } from "@/lib/documents";
import { listProjectFieldLogs } from "@/lib/field-logs";
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
 * Deterministic Project Knowledge retrieval for SITEPM Intelligence.
 * Call only after (or inside) project authorization. Never pass a project id
 * from model output, retrieved text, or an unauthenticated client as authority.
 */
export async function retrieveAskProjectEvidence(
  projectId: string,
): Promise<AskEvidencePack | null> {
  const scoped = await requireAuthorizedAskProject(projectId);
  if (!scoped) {
    return null;
  }

  const authorizedId = scoped.project.id;
  const companyId = scoped.project.company_id;

  const [tasks, fieldLogs, documents] = await Promise.all([
    listProjectTasks(authorizedId),
    listProjectFieldLogs(authorizedId),
    listProjectDocuments(authorizedId),
  ]);

  const boundedTasks = tasks.slice(0, ASK_RETRIEVAL_CAPS.tasks);
  const boundedLogs = fieldLogs.slice(0, ASK_RETRIEVAL_CAPS.fieldLogs);
  const boundedDocs = documents.slice(0, ASK_RETRIEVAL_CAPS.documents);

  assertAskRetrievalProjectScope(authorizedId, boundedTasks);
  assertAskRetrievalProjectScope(authorizedId, boundedLogs);
  assertAskRetrievalProjectScope(authorizedId, boundedDocs);
  assertSameCompany(companyId, boundedTasks);
  assertSameCompany(companyId, boundedLogs);
  assertSameCompany(companyId, boundedDocs);

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
  });
}
