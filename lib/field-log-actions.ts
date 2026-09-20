"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyContext } from "@/lib/auth-context";
import { findAuthorizedProject } from "@/lib/projects";

export type FieldLogFormState = {
  error: string | null;
};

function revalidateFieldLogPaths(projectId: string) {
  revalidatePath("/");
  revalidatePath("/field");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/field`);
}

function parseLogDate(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  const date = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return trimmed;
}

export async function createFieldLog(
  _prev: FieldLogFormState,
  formData: FormData,
): Promise<FieldLogFormState> {
  const projectId = String(formData.get("project_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const logDate = parseLogDate(String(formData.get("log_date") ?? ""));
  const issueFlag = String(formData.get("issue_flag") ?? "") === "on";

  if (!projectId) {
    return { error: "Choose a project." };
  }
  if (!logDate) {
    return { error: "Enter a valid log date." };
  }
  if (!notes) {
    return { error: "Notes are required." };
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

  const { error } = await supabase.from("field_logs").insert({
    company_id: profile.company_id,
    project_id: project.id,
    created_by: profile.id,
    log_date: logDate,
    notes,
    issue_flag: issueFlag,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateFieldLogPaths(project.id);
  return { error: null };
}
