/**
 * SITEPM Intelligence contracts for Ask and future non-chat consumers.
 *
 * The Ask UI is one consumer of SITEPM Intelligence, not the product itself.
 * Durable value is project/property data, evidence, provenance, permissions,
 * workflows, and later specialized knowledge — not a chat wrapper or one model.
 *
 * User questions, task descriptions, field-log notes, and document text are
 * DATA (untrusted). They must never set authentication, authorization, project
 * scope, tools, or system policy. A future model must not choose project IDs.
 */

export const ASK_SOURCE_TYPES = [
  "project",
  "task",
  "field_log",
  "document",
] as const;

export type AskSourceType = (typeof ASK_SOURCE_TYPES)[number];

export const ASK_EPISTEMIC_KINDS = [
  "documented_fact",
  "summary_inference",
  "insufficient_evidence",
] as const;

export type AskEpistemicKind = (typeof ASK_EPISTEMIC_KINDS)[number];

export type AskCitation = {
  type: AskSourceType;
  id: string;
  label: string;
  page?: number;
};

export type AskFormState = {
  error: string | null;
  notice: string | null;
  inventory: {
    project: number;
    tasks: number;
    fieldLogs: number;
    documents: number;
  } | null;
};
