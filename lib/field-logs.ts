import type { FieldLogRecord } from "@/lib/field-log-types";
import { requireCompanyContext } from "@/lib/auth-context";
import { getAuthorizedProject } from "@/lib/projects";

export type { FieldLogRecord } from "@/lib/field-log-types";

type FieldLogRow = {
  id: string;
  company_id: string;
  project_id: string;
  created_by: string | null;
  log_date: string;
  notes: string | null;
  issue_flag: boolean | null;
  created_at: string;
  author: { full_name: string | null } | { full_name: string | null }[] | null;
};

const fieldLogColumns =
  "id, company_id, project_id, created_by, log_date, notes, issue_flag, created_at";
const fieldLogColumnsWithAuthor = `${fieldLogColumns}, author:profiles!field_logs_created_by_fkey(full_name)`;

function mapFieldLog(row: FieldLogRow): FieldLogRecord {
  const author = Array.isArray(row.author) ? row.author[0] : row.author;
  return {
    id: row.id,
    company_id: row.company_id,
    project_id: row.project_id,
    created_by: row.created_by,
    created_by_name: author?.full_name ?? null,
    log_date: row.log_date,
    notes: row.notes,
    issue_flag: Boolean(row.issue_flag),
    created_at: row.created_at,
  };
}

async function queryFieldLogs(filters: {
  companyId: string;
  projectId?: string;
  limit?: number;
}) {
  const { supabase } = await requireCompanyContext();
  const applyFilters = (select: string) => {
    let query = supabase
      .from("field_logs")
      .select(select)
      .eq("company_id", filters.companyId)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters.projectId) {
      query = query.eq("project_id", filters.projectId);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    return query;
  };

  const withAuthor = await applyFilters(fieldLogColumnsWithAuthor);
  const result = withAuthor.error
    ? await applyFilters(fieldLogColumns)
    : withAuthor;

  if (result.error) {
    throw new Error(result.error.message);
  }

  return ((result.data ?? []) as unknown as FieldLogRow[]).map(mapFieldLog);
}

export async function listCompanyFieldLogs() {
  const { profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return [];
  }
  return queryFieldLogs({ companyId: profile.company_id });
}

export async function listRecentCompanyFieldLogs(limit = 3) {
  const { profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return [];
  }
  return queryFieldLogs({ companyId: profile.company_id, limit });
}

export async function listProjectFieldLogs(projectId: string) {
  await getAuthorizedProject(projectId);
  const { profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return [];
  }
  return queryFieldLogs({ companyId: profile.company_id, projectId });
}
