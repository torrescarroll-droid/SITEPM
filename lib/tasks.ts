import type { TaskRecord } from "@/lib/task-types";
import { requireCompanyContext } from "@/lib/auth-context";
import { getAuthorizedProject } from "@/lib/projects";
import { missingRelationOrColumn } from "@/lib/schema-compat";

export type { TaskRecord } from "@/lib/task-types";
export { taskIsOverdue } from "@/lib/task-types";

function asTaskStatus(value: string | null): TaskRecord["status"] {
  if (value === "in_progress" || value === "done" || value === "open") {
    return value;
  }
  return "open";
}

function asTaskPriority(value: string | null): TaskRecord["priority"] {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return null;
}

function mapTask(row: {
  id: string;
  company_id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  priority: string | null;
  status: string | null;
  ai_suggested: boolean | null;
  created_at: string;
  completed_at: string | null;
  source_field_log_id?: string | null;
  trade_name?: string | null;
  location_text?: string | null;
  responsible_name?: string | null;
}): TaskRecord {
  return {
    ...row,
    priority: asTaskPriority(row.priority),
    status: asTaskStatus(row.status),
    ai_suggested: Boolean(row.ai_suggested),
  };
}

const taskColumns =
  "id, company_id, project_id, title, description, assigned_to, due_date, priority, status, ai_suggested, created_at, completed_at, source_field_log_id, trade_name, location_text, responsible_name";
const legacyTaskColumns =
  "id, company_id, project_id, title, description, assigned_to, due_date, priority, status, ai_suggested, created_at, completed_at";

async function selectTasks(
  supabase: Awaited<ReturnType<typeof requireCompanyContext>>["supabase"],
  filters: { companyId: string; projectId?: string; taskId?: string },
) {
  const run = (columns: string) => {
    let query = supabase
      .from("tasks")
      .select(columns)
      .eq("company_id", filters.companyId);
    if (filters.projectId) query = query.eq("project_id", filters.projectId);
    if (filters.taskId) query = query.eq("id", filters.taskId);
    if (!filters.taskId) {
      query = query
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
    }
    return query;
  };

  const next = await run(taskColumns);
  if (next.error && missingRelationOrColumn(next.error.message)) {
    return run(legacyTaskColumns);
  }
  return next;
}

export async function listCompanyTasks() {
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return [];
  }

  const { data, error } = await selectTasks(supabase, { companyId: profile.company_id });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as Parameters<typeof mapTask>[0][]).map(mapTask);
}

export async function listProjectTasks(projectId: string) {
  await getAuthorizedProject(projectId);
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return [];
  }

  const { data, error } = await selectTasks(supabase, {
    companyId: profile.company_id,
    projectId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as Parameters<typeof mapTask>[0][]).map(mapTask);
}

export async function getAuthorizedTask(id: string) {
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return null;
  }

  const { data, error } = await selectTasks(supabase, {
    companyId: profile.company_id,
    taskId: id,
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    return null;
  }

  return mapTask(row as unknown as Parameters<typeof mapTask>[0]);
}
