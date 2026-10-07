import type { ScheduleActivity, ScheduleStatus } from "@/lib/schedule-types";
import { isScheduleStatus } from "@/lib/schedule-types";
import { requireCompanyContext } from "@/lib/auth-context";
import { getAuthorizedProject } from "@/lib/projects";
import { missingRelationOrColumn } from "@/lib/schema-compat";

type ActivityRow = {
  id: string;
  company_id: string;
  project_id: string;
  name: string;
  notes: string | null;
  start_date: string | null;
  finish_date: string | null;
  status: string;
  trade_name: string | null;
  is_milestone: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type DependencyRow = {
  activity_id: string;
  predecessor_id: string;
};

const activityColumns =
  "id, company_id, project_id, name, notes, start_date, finish_date, status, trade_name, is_milestone, sort_order, created_by, created_at, updated_at";

function mapActivity(
  row: ActivityRow,
  predecessor: { id: string; name: string } | null,
): ScheduleActivity {
  const status: ScheduleStatus = isScheduleStatus(row.status) ? row.status : "not_started";
  return {
    id: row.id,
    company_id: row.company_id,
    project_id: row.project_id,
    name: row.name,
    notes: row.notes,
    start_date: row.start_date,
    finish_date: row.finish_date,
    status,
    trade_name: row.trade_name,
    is_milestone: row.is_milestone,
    sort_order: row.sort_order,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    predecessor_id: predecessor?.id ?? null,
    predecessor_name: predecessor?.name ?? null,
  };
}

async function queryActivities(filters: { companyId: string; projectId?: string }) {
  const { supabase } = await requireCompanyContext();
  let activitiesQuery = supabase
    .from("schedule_activities")
    .select(activityColumns)
    .eq("company_id", filters.companyId)
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });
  let dependencyQuery = supabase
    .from("schedule_dependencies")
    .select("activity_id, predecessor_id")
    .eq("company_id", filters.companyId);

  if (filters.projectId) {
    activitiesQuery = activitiesQuery.eq("project_id", filters.projectId);
    dependencyQuery = dependencyQuery.eq("project_id", filters.projectId);
  }

  const [activitiesResult, dependenciesResult] = await Promise.all([
    activitiesQuery,
    dependencyQuery,
  ]);
  if (activitiesResult.error) {
    if (missingRelationOrColumn(activitiesResult.error.message)) return [];
    throw new Error(activitiesResult.error.message);
  }
  if (dependenciesResult.error) {
    if (missingRelationOrColumn(dependenciesResult.error.message)) return [];
    throw new Error(dependenciesResult.error.message);
  }

  const rows = (activitiesResult.data ?? []) as ActivityRow[];
  const dependencies = (dependenciesResult.data ?? []) as DependencyRow[];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const predecessorByActivity = new Map<string, { id: string; name: string }>();
  for (const dependency of dependencies) {
    const predecessor = byId.get(dependency.predecessor_id);
    if (!predecessor) continue;
    predecessorByActivity.set(dependency.activity_id, {
      id: predecessor.id,
      name: predecessor.name,
    });
  }

  return rows.map((row) => mapActivity(row, predecessorByActivity.get(row.id) ?? null));
}

export async function listCompanyScheduleActivities() {
  const { profile } = await requireCompanyContext();
  if (!profile?.company_id) return [];
  return queryActivities({ companyId: profile.company_id });
}

export async function listProjectScheduleActivities(projectId: string) {
  await getAuthorizedProject(projectId);
  const { profile } = await requireCompanyContext();
  if (!profile?.company_id) return [];
  return queryActivities({ companyId: profile.company_id, projectId });
}
