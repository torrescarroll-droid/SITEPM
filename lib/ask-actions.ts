"use server";

import { requireAuthorizedAskProject } from "@/lib/ask-scope";
import type { AskStage1State } from "@/lib/ask-types";

const STAGE_1_NOTICE =
  "Ask SITEPM intelligence is being connected to this project.";

export async function submitProjectAsk(
  _prev: AskStage1State,
  formData: FormData,
): Promise<AskStage1State> {
  const projectId = String(formData.get("project_id") ?? "");
  const question = String(formData.get("question") ?? "").trim();

  const scoped = await requireAuthorizedAskProject(projectId);
  if (!scoped) {
    return {
      error: "That project is not available to your company.",
      notice: null,
    };
  }

  if (!question) {
    return { error: "Ask a question about this project.", notice: null };
  }

  // Stage 1: authorize only. Do not retrieve other projects, call a model,
  // or treat the question text as instructions.
  void scoped.project.id;
  void question;

  return { error: null, notice: STAGE_1_NOTICE };
}
