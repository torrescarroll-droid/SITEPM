"use server";

import { generateGroundedAnswer } from "@/lib/ai/provider";
import { AskProviderError } from "@/lib/ai/types";
import { retrieveAskProjectEvidence } from "@/lib/ask-retrieval";
import { requireAuthorizedAskProject } from "@/lib/ask-scope";
import { inventoryFromPack } from "@/lib/ask-evidence";
import { projectIdFromAskForm } from "@/lib/ask-grounding";
import type { AskFormState } from "@/lib/ask-types";

const emptyAnswer = {
  answer: null as string | null,
  citations: null as AskFormState["citations"],
  insufficientEvidence: false,
  epistemicKind: null as AskFormState["epistemicKind"],
};

export async function submitProjectAsk(
  _prev: AskFormState,
  formData: FormData,
): Promise<AskFormState> {
  const requestedProjectId = projectIdFromAskForm(
    String(formData.get("project_id") ?? ""),
    String(formData.get("question") ?? ""),
  );
  const question = String(formData.get("question") ?? "").trim();

  const scoped = await requireAuthorizedAskProject(requestedProjectId);
  if (!scoped) {
    return {
      error: "That project is not available to your company.",
      notice: null,
      inventory: null,
      ...emptyAnswer,
    };
  }

  if (!question) {
    return {
      error: "Ask a question about this project.",
      notice: null,
      inventory: null,
      ...emptyAnswer,
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
      ...emptyAnswer,
    };
  }

  try {
    const grounded = await generateGroundedAnswer({
      question,
      projectId: scoped.project.id,
      evidence: pack,
    });

    return {
      error: null,
      notice: null,
      inventory: inventoryFromPack(pack),
      answer: grounded.answer,
      citations: grounded.citations,
      insufficientEvidence: grounded.insufficientEvidence,
      epistemicKind: grounded.epistemicKind,
    };
  } catch (error) {
    if (error instanceof AskProviderError) {
      return {
        error: error.userMessage,
        notice: null,
        inventory: inventoryFromPack(pack),
        ...emptyAnswer,
      };
    }
    console.error("Ask unexpected error");
    return {
      error: "Ask SITEPM could not answer right now.",
      notice: null,
      inventory: inventoryFromPack(pack),
      ...emptyAnswer,
    };
  }
}
