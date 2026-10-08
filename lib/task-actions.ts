"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyContext } from "@/lib/auth-context";
import { findAuthorizedProject } from "@/lib/projects";
import { getAuthorizedTask } from "@/lib/tasks";
import { validCalendarDate } from "@/lib/operational-lookahead";

export type TaskFormState = {
  error: string | null;
  success?: string;
};

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function revalidateTaskPaths(projectId: string) {
  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${projectId}/lookahead`);
  revalidatePath(`/projects/${projectId}/field`, "layout");
}

export async function createTask(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const title = String(formData.get("title") ?? "").trim();
  const projectId = String(formData.get("project_id") ?? "").trim();

  if (!title) {
    return { error: "Task title is required." };
  }
  if (!projectId) {
    return { error: "Choose a project." };
  }
  const dueDate = emptyToNull(String(formData.get("due_date") ?? ""));
  if (dueDate && !validCalendarDate(dueDate)) return { error: "Enter a valid due date." };
  if (title.length > 500) return { error: "Keep the title to 500 characters or fewer." };

  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return {
      error:
        "Your company profile is not ready yet. Confirm signup created a profile, then try again.",
    };
  }

  const project = await findAuthorizedProject(projectId);
  if (!project) {
    return { error: "That project is not available to your company." };
  }
  const reportId = emptyToNull(String(formData.get("source_field_log_id") ?? ""));
  if (reportId) {
    const report = await supabase.from("field_logs").select("id")
      .eq("id", reportId).eq("company_id", profile.company_id)
      .eq("project_id", project.id).maybeSingle();
    if (report.error || !report.data) return { error: "That report is not available on this job." };
  }

  const priorityRaw = String(formData.get("priority") ?? "medium");
  const priority =
    priorityRaw === "high" || priorityRaw === "low" ? priorityRaw : "medium";

  const { error } = await supabase.from("tasks").insert({
    company_id: profile.company_id,
    project_id: project.id,
    title,
    description: emptyToNull(String(formData.get("description") ?? "")),
    due_date: dueDate,
    priority,
    status: "open",
    ai_suggested: false,
    trade_name: emptyToNull(String(formData.get("trade_name") ?? "")),
    location_text: emptyToNull(String(formData.get("location_text") ?? "")),
    responsible_name: emptyToNull(String(formData.get("responsible_name") ?? "")),
    source_field_log_id: reportId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateTaskPaths(project.id);
  return { error: null, success: "To-do saved." };
}

export async function updateTask(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const id = String(formData.get("task_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!id) {
    return { error: "Task is missing." };
  }
  if (!title) {
    return { error: "Task title is required." };
  }
  const dueDate = emptyToNull(String(formData.get("due_date") ?? ""));
  if (dueDate && !validCalendarDate(dueDate)) return { error: "Enter a valid due date." };
  if (title.length > 500) return { error: "Keep the title to 500 characters or fewer." };

  const existing = await getAuthorizedTask(id);
  if (!existing) {
    return { error: "Task was not found." };
  }

  const { supabase } = await requireCompanyContext();
  const statusRaw = String(formData.get("status") ?? existing.status);
  const status =
    statusRaw === "in_progress" || statusRaw === "done" || statusRaw === "open"
      ? statusRaw
      : existing.status;
  const priorityRaw = String(formData.get("priority") ?? existing.priority ?? "medium");
  const priority =
    priorityRaw === "high" || priorityRaw === "low" || priorityRaw === "medium"
      ? priorityRaw
      : existing.priority;

  const { data, error } = await supabase
    .from("tasks")
    .update({
      title,
      description: emptyToNull(String(formData.get("description") ?? "")),
      due_date: dueDate,
      priority,
      status,
      trade_name: emptyToNull(String(formData.get("trade_name") ?? "")),
      location_text: emptyToNull(String(formData.get("location_text") ?? "")),
      responsible_name: emptyToNull(String(formData.get("responsible_name") ?? "")),
      completed_at:
        status === "done"
          ? (existing.completed_at ?? new Date().toISOString())
          : null,
    })
    .eq("id", existing.id)
    .eq("company_id", existing.company_id)
    .select("id");

  if (error) {
    return { error: error.message };
  }

  if (!data?.length) return { error: "This to-do is no longer available. Refresh and try again." };

  revalidateTaskPaths(existing.project_id);
  return { error: null, success: "Changes saved." };
}

export async function changeTaskStatus(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const id = String(formData.get("task_id") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  if (!id || !["open", "in_progress", "done"].includes(status)) {
    return { error: "Choose a valid to-do and status." };
  }
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) return { error: "Your company profile is not ready yet." };
  const existing = await getAuthorizedTask(id);
  if (!existing || existing.company_id !== profile.company_id) {
    return { error: "That to-do is not available to your company." };
  }
  const result = await supabase.from("tasks").update({
    status,
    completed_at: status === "done" ? (existing.completed_at ?? new Date().toISOString()) : null,
  }).eq("id", existing.id).eq("company_id", profile.company_id)
    .eq("project_id", existing.project_id).eq("status", existing.status).select("id");
  if (result.error) return { error: "The status could not be saved. Try again." };
  if (!result.data?.length) return { error: "This to-do changed or is no longer available. Refresh and try again." };
  revalidateTaskPaths(existing.project_id);
  return { error: null, success: "Status saved." };
}

export async function deleteTask(formData: FormData): Promise<void> {
  const id = String(formData.get("task_id") ?? "").trim();
  if (!id) return;

  const existing = await getAuthorizedTask(id);
  if (!existing) return;

  const { supabase } = await requireCompanyContext();
  await supabase
    .from("tasks")
    .delete()
    .eq("id", existing.id)
    .eq("company_id", existing.company_id);

  revalidateTaskPaths(existing.project_id);
}
