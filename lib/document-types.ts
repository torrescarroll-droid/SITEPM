export const DOCUMENT_TYPES = [
  "contract",
  "plans",
  "specifications",
  "schedule",
  "selections",
  "change_order",
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type DocumentStatus = "pending" | "ready" | "failed";

export type DocumentRecord = {
  id: string;
  company_id: string;
  project_id: string;
  filename: string;
  storage_path: string;
  document_type: DocumentType;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  content_type: string;
  byte_size: number;
  sha256: string | null;
  status: DocumentStatus;
};

export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_BUCKET = "project-documents";
export const DOCUMENT_SIGNED_URL_SECONDS = 60;

export function isDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}
