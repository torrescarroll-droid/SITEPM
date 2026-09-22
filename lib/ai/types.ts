import type { AskCitation, AskEpistemicKind } from "@/lib/ask-types";
import type { AskEvidencePack } from "@/lib/ask-evidence";

export type GenerateGroundedAnswerInput = {
  question: string;
  projectId: string;
  evidence: AskEvidencePack;
};

export type GenerateGroundedAnswerResult = {
  answer: string;
  citations: AskCitation[];
  insufficientEvidence: boolean;
  epistemicKind: AskEpistemicKind;
};

export type AskProviderErrorCode =
  | "not_configured"
  | "unavailable"
  | "invalid_output";

export class AskProviderError extends Error {
  readonly code: AskProviderErrorCode;
  readonly userMessage: string;

  constructor(code: AskProviderErrorCode, userMessage: string) {
    super(userMessage);
    this.name = "AskProviderError";
    this.code = code;
    this.userMessage = userMessage;
  }
}
