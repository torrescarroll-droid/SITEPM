/**
 * Normalized SITEPM Intelligence evidence. Ask is one consumer.
 * Record bodies are untrusted DATA, never authorization or instructions.
 */

import type { AskCitation, AskSourceType } from "@/lib/ask-types";
import type { DocumentChunkHit } from "@/lib/document-intelligence-types";
import type { DocumentRecord } from "@/lib/document-types";
import type { FieldLogRecord } from "@/lib/field-log-types";
import type { ProjectRecord } from "@/lib/projects";
import type { TaskRecord } from "@/lib/task-types";

export type AskCitationKey = `${AskSourceType}:${string}`;

export type AskEvidenceItem = {
  sourceType: AskSourceType;
  sourceId: string;
  projectId: string;
  label: string;
  data: Record<string, string | number | boolean | null>;
};

export type AskEvidencePack = {
  projectId: string;
  evidence: AskEvidenceItem[];
  allowlist: AskCitationKey[];
};

export type AskEvidenceInventory = {
  project: number;
  tasks: number;
  fieldLogs: number;
  documents: number;
  documentChunks: number;
};

export const ASK_RETRIEVAL_CAPS = {
  tasks: 100,
  fieldLogs: 100,
  documents: 50,
} as const;

/** Initial Ask operating policy. Tunable; not a completeness guarantee. */
export const ASK_CHUNK_MODEL_CAP = 8;
export const ASK_CHUNK_BODY_CHARS = 2500;
export const ASK_CHUNK_TRUNCATION_MARKER = "…[truncated]";

export function citationKey(type: AskSourceType, id: string): AskCitationKey {
  return `${type}:${id}`;
}

export function buildAskAllowlist(evidence: AskEvidenceItem[]): AskCitationKey[] {
  return evidence.map((item) => citationKey(item.sourceType, item.sourceId));
}

export function allowlistHas(
  allowlist: AskCitationKey[],
  type: AskSourceType,
  id: string,
) {
  return allowlist.includes(citationKey(type, id));
}

/** Application-controlled citation gate. The model cannot expand this set. */
export function validateProposedCitations(
  proposed: AskCitation[],
  allowlist: AskCitationKey[],
): AskCitation[] {
  const allowed = new Set(allowlist);
  return proposed.filter((citation) =>
    allowed.has(citationKey(citation.type, citation.id)),
  );
}

export function inventoryFromPack(pack: AskEvidencePack): AskEvidenceInventory {
  return {
    project: pack.evidence.filter((item) => item.sourceType === "project").length,
    tasks: pack.evidence.filter((item) => item.sourceType === "task").length,
    fieldLogs: pack.evidence.filter((item) => item.sourceType === "field_log")
      .length,
    documents: pack.evidence.filter((item) => item.sourceType === "document")
      .length,
    documentChunks: pack.evidence.filter(
      (item) => item.sourceType === "document_chunk",
    ).length,
  };
}

export function projectEvidenceItem(project: ProjectRecord): AskEvidenceItem {
  return {
    sourceType: "project",
    sourceId: project.id,
    projectId: project.id,
    label: project.name,
    data: {
      name: project.name,
      client_name: project.client_name,
      address: project.address,
      status: project.status,
      start_date: project.start_date,
      target_completion_date: project.target_completion_date,
      description: project.description,
    },
  };
}

export function taskEvidenceItem(
  projectId: string,
  task: TaskRecord,
): AskEvidenceItem {
  return {
    sourceType: "task",
    sourceId: task.id,
    projectId,
    label: task.title,
    data: {
      title: task.title,
      description: task.description,
      assigned_to: task.assigned_to,
      due_date: task.due_date,
      priority: task.priority,
      status: task.status,
      ai_suggested: task.ai_suggested,
      created_at: task.created_at,
      completed_at: task.completed_at,
    },
  };
}

export function fieldLogEvidenceItem(
  projectId: string,
  log: FieldLogRecord,
): AskEvidenceItem {
  return {
    sourceType: "field_log",
    sourceId: log.id,
    projectId,
    label: log.log_date,
    data: {
      log_date: log.log_date,
      notes: log.notes,
      issue_flag: log.issue_flag,
      created_at: log.created_at,
      created_by: log.created_by,
      created_by_name: log.created_by_name,
    },
  };
}

export function documentEvidenceItem(
  projectId: string,
  document: DocumentRecord,
): AskEvidenceItem {
  return {
    sourceType: "document",
    sourceId: document.id,
    projectId,
    label: document.filename,
    data: {
      filename: document.filename,
      document_type: document.document_type,
      content_type: document.content_type,
      byte_size: document.byte_size,
      created_at: document.created_at,
      sha256: document.sha256,
      status: document.status,
    },
  };
}

export function truncateAskChunkBody(
  body: string,
  cap = ASK_CHUNK_BODY_CHARS,
): string {
  if (body.length <= cap) {
    return body;
  }
  const marker = ASK_CHUNK_TRUNCATION_MARKER;
  if (cap <= marker.length) {
    return marker.slice(0, cap);
  }
  return `${body.slice(0, cap - marker.length)}${marker}`;
}

export function budgetDocumentChunkHits<T>(
  hits: T[],
  cap = ASK_CHUNK_MODEL_CAP,
): T[] {
  return hits.slice(0, cap);
}

export function documentChunkCitationLabel(
  filename: string,
  locator: string,
  partIndex: number,
): string {
  const base = `${filename} · ${locator}`;
  return partIndex > 0 ? `${base} · part ${partIndex}` : base;
}

export function documentChunkEvidenceItem(
  projectId: string,
  hit: DocumentChunkHit,
  filename: string,
): AskEvidenceItem {
  return {
    sourceType: "document_chunk",
    sourceId: hit.chunk_id,
    projectId,
    label: documentChunkCitationLabel(filename, hit.locator, hit.part_index),
    data: {
      filename,
      locator: hit.locator,
      locator_type: hit.locator_type,
      part_index: hit.part_index,
      content_kind: hit.content_kind,
      source_issued_on: hit.source_issued_on,
      source_effective_on: hit.source_effective_on,
      source_sha256: hit.source_sha256,
      body: truncateAskChunkBody(hit.body),
    },
  };
}

export function assembleAskEvidencePack(input: {
  project: ProjectRecord;
  tasks: TaskRecord[];
  fieldLogs: FieldLogRecord[];
  documents: DocumentRecord[];
  documentChunks?: AskEvidenceItem[];
}): AskEvidencePack {
  const projectId = input.project.id;
  const evidence: AskEvidenceItem[] = [
    projectEvidenceItem(input.project),
    ...input.tasks.map((task) => taskEvidenceItem(projectId, task)),
    ...input.fieldLogs.map((log) => fieldLogEvidenceItem(projectId, log)),
    ...input.documents.map((document) =>
      documentEvidenceItem(projectId, document),
    ),
    ...(input.documentChunks ?? []),
  ];

  for (const item of evidence) {
    if (item.projectId !== projectId) {
      throw new Error("Ask evidence escaped the authorized project.");
    }
    if ("storage_path" in item.data) {
      throw new Error("Ask evidence must not include Storage paths.");
    }
    if ("company_id" in item.data) {
      throw new Error("Ask evidence must not include company_id.");
    }
  }

  return {
    projectId,
    evidence,
    allowlist: buildAskAllowlist(evidence),
  };
}
