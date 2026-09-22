import { ASK_SOURCE_TYPES, ASK_EPISTEMIC_KINDS } from "@/lib/ask-types";
import type { AskCitation, AskEpistemicKind, AskSourceType } from "@/lib/ask-types";
import {
  allowlistHas,
  citationKey,
  type AskEvidencePack,
} from "@/lib/ask-evidence";
import type { GenerateGroundedAnswerResult } from "@/lib/ai/types";
import { AskProviderError } from "@/lib/ai/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ASK_GROUNDED_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    insufficientEvidence: { type: "boolean" },
    epistemicKind: {
      type: "string",
      enum: [...ASK_EPISTEMIC_KINDS],
    },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: [...ASK_SOURCE_TYPES] },
          id: { type: "string" },
        },
        required: ["type", "id"],
      },
    },
  },
  required: ["answer", "insufficientEvidence", "epistemicKind", "citations"],
} as const;

export function isAskSourceType(value: string): value is AskSourceType {
  return (ASK_SOURCE_TYPES as readonly string[]).includes(value);
}

export function isAskUuid(value: string) {
  return UUID_RE.test(value);
}

/**
 * Ask scope is the authorized form/route project id only.
 * Question text is never parsed for project identifiers.
 */
export function projectIdFromAskForm(formProjectId: string, question: string) {
  void question;
  return formProjectId.trim();
}

export function modelEvidencePayload(pack: AskEvidencePack) {
  return pack.evidence.map((item) => ({
    source_type: item.sourceType,
    source_id: item.sourceId,
    label: item.label,
    data: item.data,
  }));
}

export function validateModelCitations(
  proposed: unknown,
  pack: AskEvidencePack,
): AskCitation[] {
  if (!Array.isArray(proposed)) {
    throw new AskProviderError(
      "invalid_output",
      "Ask SITEPM could not produce a grounded answer.",
    );
  }

  const labels = new Map(
    pack.evidence.map((item) => [
      citationKey(item.sourceType, item.sourceId),
      item.label,
    ]),
  );
  const accepted: AskCitation[] = [];
  const seen = new Set<string>();

  for (const raw of proposed) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const record = raw as { type?: unknown; id?: unknown };
    if (typeof record.type !== "string" || typeof record.id !== "string") {
      continue;
    }
    if (!isAskSourceType(record.type) || !isAskUuid(record.id)) {
      continue;
    }
    if (pack.projectId && record.type === "project" && record.id !== pack.projectId) {
      continue;
    }
    if (!allowlistHas(pack.allowlist, record.type, record.id)) {
      continue;
    }
    const key = citationKey(record.type, record.id);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    accepted.push({
      type: record.type,
      id: record.id,
      label: labels.get(key) ?? record.id,
    });
  }

  return accepted;
}

export function parseGroundedModelOutput(
  raw: unknown,
  pack: AskEvidencePack,
): GenerateGroundedAnswerResult {
  if (!raw || typeof raw !== "object") {
    throw new AskProviderError(
      "invalid_output",
      "Ask SITEPM could not produce a grounded answer.",
    );
  }

  const record = raw as Record<string, unknown>;
  if (typeof record.answer !== "string") {
    throw new AskProviderError(
      "invalid_output",
      "Ask SITEPM could not produce a grounded answer.",
    );
  }

  const answer = record.answer.trim();
  if (!answer) {
    throw new AskProviderError(
      "invalid_output",
      "Ask SITEPM could not produce a grounded answer.",
    );
  }

  const insufficientEvidence = record.insufficientEvidence === true;
  let epistemicKind: AskEpistemicKind = "summary_inference";
  if (
    typeof record.epistemicKind === "string" &&
    (ASK_EPISTEMIC_KINDS as readonly string[]).includes(record.epistemicKind)
  ) {
    epistemicKind = record.epistemicKind as AskEpistemicKind;
  }
  if (insufficientEvidence) {
    epistemicKind = "insufficient_evidence";
  }

  return {
    answer,
    citations: validateModelCitations(record.citations, pack),
    insufficientEvidence,
    epistemicKind,
  };
}
