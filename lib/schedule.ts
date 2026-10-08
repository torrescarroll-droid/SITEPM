import type { ScheduleActivity, ScheduleStatus } from "@/lib/schedule-types";
import { isScheduleStatus } from "@/lib/schedule-types";
import { requireCompanyContext } from "@/lib/auth-context";
import { getAuthorizedProject } from "@/lib/projects";
import { missingRelationOrColumn } from "@/lib/schema-compat";

type ActivityRow = {
  revision?: number;
  activity_type?: string;
  all_day?: boolean;
  start_time?: string | null;
  finish_time?: string | null;
  timezone?: string;
  start_at?: string | null;
  finish_at?: string | null;
  source_task_id?: string | null;
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
  "id, company_id, project_id, name, notes, start_date, finish_date, status, trade_name, is_milestone, sort_order, created_by, created_at, updated_at, revision, activity_type, all_day, start_time, finish_time, timezone, start_at, finish_at, source_task_id";

function mapActivity(
  row: ActivityRow,
  predecessor: { id: string; name: string } | null,
): ScheduleActivity {
  const status: ScheduleStatus = isScheduleStatus(row.status)
    ? row.status
    : "not_started";
  return {
    ...row,
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

// Read every page so an edit cannot silently drop assignments/dependencies at the API row limit.
async function allRows<T>(query: {
  range(
    from: number,
    to: number,
  ): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}) {
  const data: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await query.range(offset, offset + 499);
    if (page.error) return { data: null, error: page.error };
    data.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < 500) return { data, error: null };
  }
}

async function queryActivities(filters: {
  companyId: string;
  projectId?: string;
}) {
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
    allRows<ActivityRow>(activitiesQuery.order("id")),
    allRows<DependencyRow>(
      dependencyQuery.order("activity_id").order("predecessor_id"),
    ),
  ]);
  if (activitiesResult.error) {
    if (missingRelationOrColumn(activitiesResult.error.message))
      throw new Error(
        "Scheduling migration is required before using this release.",
      );
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

  const assignments = await allRows<{
    activity_id: string;
    resource_id: string;
    expected_workers: number | null;
  }>(
    supabase
      .from("schedule_assignments")
      .select("activity_id,resource_id,expected_workers")
      .eq("company_id", filters.companyId)
      .order("activity_id")
      .order("resource_id"),
  );
  if (assignments.error) throw new Error("Scheduling migration is required.");
  return rows.map((row) => ({
    ...mapActivity(row, predecessorByActivity.get(row.id) ?? null),
    predecessor_ids: dependencies
      .filter((d) => d.activity_id === row.id)
      .map((d) => d.predecessor_id),
    assignments: (assignments.data ?? [])
      .filter((a) => a.activity_id === row.id)
      .map((a) => ({
        resource_id: a.resource_id,
        expected_workers: a.expected_workers,
      })),
  }));
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

export async function listScheduleResources() {
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) return [];
  const result = await allRows<import("./schedule-types").ScheduleResource>(
    supabase
      .from("schedule_resources")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("name")
      .order("id"),
  );
  if (result.error)
    throw new Error(
      "Resource directory could not load. Check the scheduling migration.",
    );
  return result.data as import("./schedule-types").ScheduleResource[];
}
export async function listScheduleHistory(projectId?: string) {
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) return [];
  let query = supabase
    .from("schedule_history")
    .select(
      "id,activity_id,actor_id,occurred_at,change_type,before_record,after_record,schedule_activities!inner(project_id)",
    )
    .eq("company_id", profile.company_id)
    .order("occurred_at", { ascending: false })
    .limit(100);
  if (projectId) query = query.eq("schedule_activities.project_id", projectId);
  const result = await query;
  if (result.error) throw new Error("Schedule history could not load.");
  const people = await allRows<{
    auth_user_id: string;
    full_name: string | null;
  }>(
    supabase
      .from("profiles")
      .select("auth_user_id,full_name")
      .eq("company_id", profile.company_id)
      .order("id"),
  );
  if (people.error) throw new Error("Schedule history team could not load.");
  return (result.data as import("./schedule-types").ScheduleHistory[]).map(
    (h) => ({
      ...h,
      actor_name:
        people.data?.find((p) => p.auth_user_id === h.actor_id)?.full_name ??
        null,
    }),
  );
}
