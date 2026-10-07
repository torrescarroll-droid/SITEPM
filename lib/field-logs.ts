import type { FieldLogRecord } from "@/lib/field-log-types";
import { requireCompanyContext } from "@/lib/auth-context";
import { getAuthorizedProject } from "@/lib/projects";
import { missingRelationOrColumn } from "@/lib/schema-compat";

export type { FieldLogRecord } from "@/lib/field-log-types";

type FieldLogRow = {
  id: string;
  company_id: string;
  project_id: string;
  created_by: string | null;
  log_date: string;
  notes: string | null;
  work_performed: string | null;
  deliveries: string | null;
  equipment: string | null;
  delays: string | null;
  site_events: string | null;
  safety_notes: string | null;
  tomorrow: string | null;
  location_text: string | null;
  issue_flag: boolean | null;
  created_at: string;
  author: { full_name: string | null } | { full_name: string | null }[] | null;
};

type CrewRow = {
  id: string;
  field_log_id: string;
  company_name: string | null;
  trade_name: string;
  worker_count: number | null;
};

const fieldLogColumns =
  "id, company_id, project_id, created_by, log_date, notes, work_performed, deliveries, equipment, delays, site_events, safety_notes, tomorrow, location_text, issue_flag, created_at";
const legacyFieldLogColumns =
  "id, company_id, project_id, created_by, log_date, notes, issue_flag, created_at";
const fieldLogColumnsWithAuthor = `${fieldLogColumns}, author:profiles!field_logs_created_by_fkey(full_name)`;
const legacyFieldLogColumnsWithAuthor = `${legacyFieldLogColumns}, author:profiles!field_logs_created_by_fkey(full_name)`;

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
    work_performed: row.work_performed,
    deliveries: row.deliveries,
    equipment: row.equipment,
    delays: row.delays,
    site_events: row.site_events,
    safety_notes: row.safety_notes,
    tomorrow: row.tomorrow,
    location_text: row.location_text,
    issue_flag: Boolean(row.issue_flag),
    created_at: row.created_at,
    crews: [],
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
  let result = withAuthor.error ? await applyFilters(fieldLogColumns) : withAuthor;
  if (result.error && missingRelationOrColumn(result.error.message)) {
    const legacyAuthor = await applyFilters(legacyFieldLogColumnsWithAuthor);
    result = legacyAuthor.error ? await applyFilters(legacyFieldLogColumns) : legacyAuthor;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  const logs = ((result.data ?? []) as unknown as FieldLogRow[]).map(mapFieldLog);
  if (logs.length === 0) return logs;

  const crews = await supabase
    .from("field_log_crews")
    .select("id, field_log_id, company_name, trade_name, worker_count")
    .eq("company_id", filters.companyId)
    .in(
      "field_log_id",
      logs.map((log) => log.id),
    )
    .order("sort_order", { ascending: true });
  if (crews.error) {
    if (missingRelationOrColumn(crews.error.message)) return logs;
    throw new Error(crews.error.message);
  }

  const byReport = new Map<string, FieldLogRecord["crews"]>();
  for (const row of (crews.data ?? []) as CrewRow[]) {
    const list = byReport.get(row.field_log_id) ?? [];
    list.push({
      id: row.id,
      field_log_id: row.field_log_id,
      company_name: row.company_name,
      trade_name: row.trade_name,
      worker_count: row.worker_count,
    });
    byReport.set(row.field_log_id, list);
  }
  return logs.map((log) => ({ ...log, crews: byReport.get(log.id) ?? [] }));
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
