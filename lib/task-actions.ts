"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyContext } from "@/lib/auth-context";
import { findAuthorizedProject } from "@/lib/projects";
import { getAuthorizedTask } from "@/lib/tasks";

export type TaskFormState = {
  error: string | null;
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

  const priorityRaw = String(formData.get("priority") ?? "medium");
  const priority =
    priorityRaw === "high" || priorityRaw === "low" ? priorityRaw : "medium";

  const { error } = await supabase.from("tasks").insert({
    company_id: profile.company_id,
    project_id: project.id,
    title,
    description: emptyToNull(String(formData.get("description") ?? "")),
    due_date: emptyToNull(String(formData.get("due_date") ?? "")),
    priority,
    status: "open",
    ai_suggested: false,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateTaskPaths(project.id);
  return { error: null };
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

  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      description: emptyToNull(String(formData.get("description") ?? "")),
      due_date: emptyToNull(String(formData.get("due_date") ?? "")),
      priority,
      status,
      completed_at:
        status === "done"
          ? (existing.completed_at ?? new Date().toISOString())
          : null,
    })
    .eq("id", existing.id)
    .eq("company_id", existing.company_id);

  if (error) {
    return { error: error.message };
  }

  revalidateTaskPaths(existing.project_id);
  return { error: null };
}

export async function setTaskStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("task_id") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "");
  const status =
    statusRaw === "in_progress" || statusRaw === "done" || statusRaw === "open"
      ? statusRaw
      : null;
  if (!id || !status) return;

  const existing = await getAuthorizedTask(id);
  if (!existing) return;

  const { supabase } = await requireCompanyContext();
  await supabase
    .from("tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", existing.id)
    .eq("company_id", existing.company_id);

  revalidateTaskPaths(existing.project_id);
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
