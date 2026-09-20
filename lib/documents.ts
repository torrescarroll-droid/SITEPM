import type { DocumentRecord, DocumentStatus } from "@/lib/document-types";
import { isDocumentType } from "@/lib/document-types";
import { requireCompanyContext } from "@/lib/auth-context";
import { getAuthorizedProject } from "@/lib/projects";

export type { DocumentRecord } from "@/lib/document-types";

type DocumentRow = {
  id: string;
  company_id: string;
  project_id: string;
  filename: string;
  storage_path: string;
  document_type: string;
  uploaded_by: string | null;
  created_at: string;
  content_type: string;
  byte_size: number;
  sha256: string | null;
  status: string;
  author: { full_name: string | null } | { full_name: string | null }[] | null;
};

const documentColumns =
  "id, company_id, project_id, filename, storage_path, document_type, uploaded_by, created_at, content_type, byte_size, sha256, status";
const documentColumnsWithAuthor = `${documentColumns}, author:profiles!documents_uploaded_by_fkey(full_name)`;

function asStatus(value: string): DocumentStatus {
  if (value === "pending" || value === "ready" || value === "failed") {
    return value;
  }
  return "failed";
}

function mapDocument(row: DocumentRow): DocumentRecord {
  const author = Array.isArray(row.author) ? row.author[0] : row.author;
  return {
    id: row.id,
    company_id: row.company_id,
    project_id: row.project_id,
    filename: row.filename,
    storage_path: row.storage_path,
    document_type: isDocumentType(row.document_type) ? row.document_type : "other",
    uploaded_by: row.uploaded_by,
    uploaded_by_name: author?.full_name ?? null,
    created_at: row.created_at,
    content_type: row.content_type,
    byte_size: Number(row.byte_size),
    sha256: row.sha256,
    status: asStatus(row.status),
  };
}

async function queryReadyDocuments(filters: {
  companyId: string;
  projectId?: string;
}) {
  const { supabase } = await requireCompanyContext();
  const applyFilters = (select: string) => {
    let query = supabase
      .from("documents")
      .select(select)
      .eq("company_id", filters.companyId)
      .eq("status", "ready")
      .order("created_at", { ascending: false });

    if (filters.projectId) {
      query = query.eq("project_id", filters.projectId);
    }
    return query;
  };

  const withAuthor = await applyFilters(documentColumnsWithAuthor);
  const result = withAuthor.error
    ? await applyFilters(documentColumns)
    : withAuthor;

  if (result.error) {
    throw new Error(result.error.message);
  }

  return ((result.data ?? []) as unknown as DocumentRow[]).map(mapDocument);
}

export async function listCompanyDocuments() {
  const { profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return [];
  }
  return queryReadyDocuments({ companyId: profile.company_id });
}

export async function listProjectDocuments(projectId: string) {
  await getAuthorizedProject(projectId);
  const { profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return [];
  }
  return queryReadyDocuments({
    companyId: profile.company_id,
    projectId,
  });
}

export async function getAuthorizedDocument(
  id: string,
  options?: { statuses?: DocumentStatus[] },
) {
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return null;
  }

  const statuses = options?.statuses ?? ["ready"];
  const { data, error } = await supabase
    .from("documents")
    .select(documentColumns)
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .in("status", statuses)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapDocument(data as unknown as DocumentRow);
}
