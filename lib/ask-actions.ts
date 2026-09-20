"use server";

import { retrieveAskProjectEvidence } from "@/lib/ask-retrieval";
import { requireAuthorizedAskProject } from "@/lib/ask-scope";
import { inventoryFromPack } from "@/lib/ask-evidence";
import type { AskFormState } from "@/lib/ask-types";

const STAGE_NOTICE =
  "Ask SITEPM intelligence is being connected to this project.";

export async function submitProjectAsk(
  _prev: AskFormState,
  formData: FormData,
): Promise<AskFormState> {
  const requestedProjectId = String(formData.get("project_id") ?? "");
  const question = String(formData.get("question") ?? "").trim();

  const scoped = await requireAuthorizedAskProject(requestedProjectId);
  if (!scoped) {
    return {
      error: "That project is not available to your company.",
      notice: null,
      inventory: null,
    };
  }

  if (!question) {
    return {
      error: "Ask a question about this project.",
      notice: null,
      inventory: null,
    };
  }

  // Question text is untrusted DATA. It is not parsed for project ids,
  // URLs, SQL, or instructions. Retrieval uses only scoped.project.id.
  const pack = await retrieveAskProjectEvidence(scoped.project.id);
  if (!pack) {
    return {
      error: "That project is not available to your company.",
      notice: null,
      inventory: null,
    };
  }

  return {
    error: null,
    notice: STAGE_NOTICE,
    inventory: inventoryFromPack(pack),
  };
}
