import { findAuthorizedProject, type ProjectRecord } from "@/lib/projects";
import { requireCompanyContext } from "@/lib/auth-context";

export type AskProjectContext = {
  project: ProjectRecord;
};

/**
 * Ask authorization: session → company profile → this project only.
 * Retrieval and any future model call must use this project id from here,
 * never from model output or from an unauthorized form field as authority.
 */
export async function requireAuthorizedAskProject(
  projectId: string,
): Promise<AskProjectContext | null> {
  const id = projectId.trim();
  if (!id) {
    return null;
  }

  const { profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return null;
  }

  const project = await findAuthorizedProject(id);
  if (!project) {
    return null;
  }

  if (project.company_id !== profile.company_id) {
    return null;
  }

  return { project };
}

type ProjectScopedRow = {
  project_id: string;
};

/**
 * Ask retrieval is stricter than company RLS. Every loaded row must belong
 * to the authorized Ask project. Stage 2 must call this on tasks, field logs,
 * documents, and later chunks before they enter model context or citations.
 */
export function assertAskRetrievalProjectScope(
  projectId: string,
  records: ProjectScopedRow[],
) {
  for (const record of records) {
    if (record.project_id !== projectId) {
      throw new Error("Ask retrieval escaped the authorized project.");
    }
  }
}

export { citationKey, allowlistHas, validateProposedCitations } from "@/lib/ask-evidence";
