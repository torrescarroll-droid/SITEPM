import type { TaskRecord } from "@/lib/task-types";
import { requireCompanyContext } from "@/lib/auth-context";
import { getAuthorizedProject } from "@/lib/projects";

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
}): TaskRecord {
  return {
    ...row,
    priority: asTaskPriority(row.priority),
    status: asTaskStatus(row.status),
    ai_suggested: Boolean(row.ai_suggested),
  };
}

const taskColumns =
  "id, company_id, project_id, title, description, assigned_to, due_date, priority, status, ai_suggested, created_at, completed_at";

export async function listCompanyTasks() {
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return [];
  }

  const { data, error } = await supabase
    .from("tasks")
    .select(taskColumns)
    .eq("company_id", profile.company_id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapTask);
}

export async function listProjectTasks(projectId: string) {
  await getAuthorizedProject(projectId);
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return [];
  }

  const { data, error } = await supabase
    .from("tasks")
    .select(taskColumns)
    .eq("company_id", profile.company_id)
    .eq("project_id", projectId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapTask);
}

export async function getAuthorizedTask(id: string) {
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return null;
  }

  const { data, error } = await supabase
    .from("tasks")
    .select(taskColumns)
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapTask(data);
}
