"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyContext } from "@/lib/auth-context";
import { findAuthorizedProject } from "@/lib/projects";
import { dependencyWouldCycle, finishFromDuration } from "@/lib/schedule-logic";
import { isScheduleStatus } from "@/lib/schedule-types";
import { listProjectScheduleActivities } from "@/lib/schedule";

export type ScheduleFormState = {
  error: string | null;
};

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  return trimmed;
}

function revalidateSchedule(projectId: string) {
  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/schedule`);
  revalidatePath(`/projects/${projectId}/lookahead`);
}

export async function saveScheduleActivity(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const activityId = emptyToNull(String(formData.get("activity_id") ?? ""));
  const projectId = String(formData.get("project_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "not_started");
  const milestone = String(formData.get("is_milestone") ?? "") === "on";
  const predecessorId = emptyToNull(String(formData.get("predecessor_id") ?? ""));
  const durationRaw = String(formData.get("duration_days") ?? "").trim();

  if (!projectId) return { error: "Choose a job." };
  if (!name) return { error: "Activity name is required." };
  if (!isScheduleStatus(statusRaw)) return { error: "Choose a schedule status." };

  const startDate = parseDate(String(formData.get("start_date") ?? ""));
  let finishDate = parseDate(String(formData.get("finish_date") ?? ""));
  if (startDate === undefined || finishDate === undefined) {
    return { error: "Use a real start and finish date." };
  }
  if (!finishDate && startDate && durationRaw) {
    const duration = Number(durationRaw);
    if (!Number.isInteger(duration) || duration < 1) {
      return { error: "Duration must be a whole number of days." };
    }
    finishDate = finishFromDuration(startDate, duration);
  }
  if (milestone && startDate) {
    finishDate = startDate;
  }
  if (startDate && finishDate && finishDate < startDate) {
    return { error: "Finish cannot be before start." };
  }

  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return { error: "Your company profile is not ready yet." };
  }
  const project = await findAuthorizedProject(projectId);
  if (!project) return { error: "That job is not available to your company." };

  const existing = await listProjectScheduleActivities(project.id);
  if (predecessorId) {
    if (!existing.some((activity) => activity.id === predecessorId)) {
      return { error: "The predecessor must already be on this job." };
    }
    if (
      activityId &&
      dependencyWouldCycle(
        existing
          .filter((activity) => activity.predecessor_id && activity.id !== activityId)
          .map((activity) => ({
            activityId: activity.id,
            predecessorId: activity.predecessor_id as string,
          })),
        activityId,
        predecessorId,
      )
    ) {
      return { error: "That predecessor would loop the schedule." };
    }
    if (!activityId && predecessorId) {
      // New activity cannot be its own predecessor. Cycle through existing graph
      // is checked again by the database trigger after insert.
    }
  }

  const payload = {
    company_id: profile.company_id,
    project_id: project.id,
    name,
    notes: emptyToNull(String(formData.get("notes") ?? "")),
    start_date: startDate,
    finish_date: finishDate,
    status: statusRaw,
    trade_name: emptyToNull(String(formData.get("trade_name") ?? "")),
    is_milestone: milestone,
    created_by: profile.id,
  };

  const saved = activityId
    ? await supabase
        .from("schedule_activities")
        .update(payload)
        .eq("id", activityId)
        .eq("company_id", profile.company_id)
        .select("id")
        .maybeSingle()
    : await supabase.from("schedule_activities").insert(payload).select("id").single();

  if (saved.error || !saved.data) {
    return { error: saved.error?.message ?? "The activity could not be saved." };
  }

  await supabase
    .from("schedule_dependencies")
    .delete()
    .eq("activity_id", saved.data.id)
    .eq("company_id", profile.company_id);

  if (predecessorId) {
    const link = await supabase.from("schedule_dependencies").insert({
      company_id: profile.company_id,
      project_id: project.id,
      activity_id: saved.data.id,
      predecessor_id: predecessorId,
    });
    if (link.error) {
      return { error: link.error.message };
    }
  }

  revalidateSchedule(project.id);
  return { error: null };
}
