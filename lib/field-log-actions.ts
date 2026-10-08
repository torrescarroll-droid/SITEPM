"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyContext } from "@/lib/auth-context";
import { parseCrewRows, reportHasSubstance, type CrewEntryInput } from "@/lib/daily-report";
import { findAuthorizedProject } from "@/lib/projects";

export type FieldLogFormState = {
  error: string | null;
  reportId: string | null;
  projectId?: string | null;
};

function revalidateFieldLogPaths(projectId: string) {
  revalidatePath("/");
  revalidatePath("/field");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/field`);
  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${projectId}/lookahead`);
  revalidatePath(`/projects/${projectId}/field`, "layout");
}

function parseLogDate(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return trimmed;
}

function text(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value.length > 0 ? value : null;
}

function reportFields(formData: FormData) {
  return {
    notes: text(formData, "notes"),
    work_performed: text(formData, "work_performed"),
    deliveries: text(formData, "deliveries"),
    equipment: text(formData, "equipment"),
    delays: text(formData, "delays"),
    site_events: text(formData, "site_events"),
    safety_notes: text(formData, "safety_notes"),
    tomorrow: text(formData, "tomorrow"),
    location_text: text(formData, "location_text"),
  };
}

async function replaceCrews(
  supabase: Awaited<ReturnType<typeof requireCompanyContext>>["supabase"],
  companyId: string,
  reportId: string,
  crews: CrewEntryInput[],
) {
  const deleted = await supabase
    .from("field_log_crews")
    .delete()
    .eq("field_log_id", reportId)
    .eq("company_id", companyId);
  if (deleted.error) return deleted.error.message;
  if (crews.length === 0) return null;
  const inserted = await supabase.from("field_log_crews").insert(
    crews.map((crew, index) => ({
      company_id: companyId,
      field_log_id: reportId,
      company_name: crew.companyName,
      trade_name: crew.tradeName,
      worker_count: crew.workerCount,
      sort_order: index,
    })),
  );
  return inserted.error?.message ?? null;
}

export async function createFieldLog(
  _prev: FieldLogFormState,
  formData: FormData,
): Promise<FieldLogFormState> {
  const projectId = String(formData.get("project_id") ?? "").trim();
  const logDate = parseLogDate(String(formData.get("log_date") ?? ""));
  const issueFlag = String(formData.get("issue_flag") ?? "") === "on";
  const followUp = text(formData, "follow_up_title");
  const fields = reportFields(formData);

  if (!projectId) return { error: "Choose a job.", reportId: null };
  if (!logDate) return { error: "Enter a valid report date.", reportId: null };
  if (
    !reportHasSubstance({
      notes: fields.notes,
      workPerformed: fields.work_performed,
      delays: fields.delays,
      deliveries: fields.deliveries,
    })
  ) {
    return {
      error: "Record the work, a delay, a delivery, or a note before saving.",
      reportId: null,
    };
  }

  let crews: CrewEntryInput[];
  try {
    crews = parseCrewRows(formData);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Check the crew rows.",
      reportId: null,
    };
  }

  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return { error: "Your company profile is not ready yet.", reportId: null };
  }

  const project = await findAuthorizedProject(projectId);
  if (!project) {
    return { error: "That job is not available to your company.", reportId: null };
  }

  const inserted = await supabase
    .from("field_logs")
    .insert({
      company_id: profile.company_id,
      project_id: project.id,
      created_by: profile.id,
      log_date: logDate,
      issue_flag: issueFlag,
      ...fields,
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    return { error: inserted.error?.message ?? "The report could not be saved.", reportId: null };
  }

  const crewError = await replaceCrews(
    supabase,
    profile.company_id,
    inserted.data.id,
    crews,
  );
  if (crewError) {
    revalidateFieldLogPaths(project.id);
    return { error: crewError, reportId: inserted.data.id, projectId: project.id };
  }

  if (followUp) {
    const task = await supabase.from("tasks").insert({
      company_id: profile.company_id,
      project_id: project.id,
      title: followUp,
      description: fields.delays,
      status: "open",
      priority: "medium",
      ai_suggested: false,
      source_field_log_id: inserted.data.id,
      location_text: fields.location_text,
    });
    if (task.error) {
      revalidateFieldLogPaths(project.id);
      return { error: task.error.message, reportId: inserted.data.id, projectId: project.id };
    }
  }

  revalidateFieldLogPaths(project.id);
  return { error: null, reportId: inserted.data.id, projectId: project.id };
}

export async function updateFieldLog(
  _prev: FieldLogFormState,
  formData: FormData,
): Promise<FieldLogFormState> {
  const reportId = String(formData.get("field_log_id") ?? "").trim();
  const logDate = parseLogDate(String(formData.get("log_date") ?? ""));
  const issueFlag = String(formData.get("issue_flag") ?? "") === "on";
  const fields = reportFields(formData);

  if (!reportId) return { error: "Daily report is missing.", reportId: null };
  if (!logDate) return { error: "Enter a valid report date.", reportId: reportId };
  if (
    !reportHasSubstance({
      notes: fields.notes,
      workPerformed: fields.work_performed,
      delays: fields.delays,
      deliveries: fields.deliveries,
    })
  ) {
    return {
      error: "Record the work, a delay, a delivery, or a note before saving.",
      reportId,
    };
  }

  let crews: CrewEntryInput[];
  try {
    crews = parseCrewRows(formData);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Check the crew rows.",
      reportId,
    };
  }

  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return { error: "Your company profile is not ready yet.", reportId };
  }

  const existing = await supabase
    .from("field_logs")
    .select("id, project_id")
    .eq("id", reportId)
    .eq("company_id", profile.company_id)
    .maybeSingle();
  if (existing.error || !existing.data) {
    return { error: "That daily report is not available to your company.", reportId: null };
  }

  const updated = await supabase
    .from("field_logs")
    .update({
      log_date: logDate,
      issue_flag: issueFlag,
      ...fields,
    })
    .eq("id", existing.data.id)
    .eq("company_id", profile.company_id);
  if (updated.error) return { error: updated.error.message, reportId };

  const crewError = await replaceCrews(supabase, profile.company_id, existing.data.id, crews);
  revalidateFieldLogPaths(existing.data.project_id);
  if (crewError) return { error: crewError, reportId };
  return { error: null, reportId };
}
