"use server";
import { revalidatePath } from "next/cache";
import { requireCompanyContext } from "@/lib/auth-context";
import { validCalendarDate } from "@/lib/operational-lookahead";
import {
  isScheduleStatus,
  ACTIVITY_TYPES,
  RESOURCE_TYPES,
} from "@/lib/schedule-types";
export type ScheduleFormState = {
  error: string | null;
  id?: string;
  revision?: number;
  uncertain?: boolean;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function saveScheduleRecord(
  _previous: ScheduleFormState,
  form: FormData,
): Promise<ScheduleFormState> {
  let record: Record<string, unknown>;
  const kind = String(form.get("kind"));
  try {
    record = JSON.parse(String(form.get("record")));
  } catch {
    return { error: "The submission could not be read. Reload and try again." };
  }
  if (
    !record ||
    !uuid.test(String(record.id)) ||
    !uuid.test(String(form.get("request_id")))
  )
    return { error: "Missing submission identity. Reload and try again." };
  if (
    typeof record.name !== "string" ||
    !record.name.trim() ||
    record.name.length > 200
  )
    return { error: "Enter a name of up to 200 characters." };
  if (kind === "activity") {
    if (
      !uuid.test(String(record.project_id)) ||
      !validCalendarDate(String(record.start_date)) ||
      !validCalendarDate(String(record.finish_date)) ||
      String(record.finish_date) < String(record.start_date)
    )
      return { error: "Choose a real start and finish date in order." };
    if (
      !isScheduleStatus(String(record.status)) ||
      !ACTIVITY_TYPES.includes(
        record.activity_type as (typeof ACTIVITY_TYPES)[number],
      )
    )
      return { error: "Choose a valid activity type and status." };
    if (
      !record.all_day &&
      (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(record.start_time)) ||
        !/^\d{2}:\d{2}(:\d{2})?$/.test(String(record.finish_time)))
    )
      return { error: "Enter start and end times." };
  } else if (kind === "resource") {
    if (
      !RESOURCE_TYPES.includes(
        record.resource_type as (typeof RESOURCE_TYPES)[number],
      )
    )
      return { error: "Choose a resource type." };
  } else return { error: "Unknown schedule record." };
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id)
    return { error: "Your company profile is not available." };
  try {
    const result = await supabase.rpc("save_construction_schedule", {
      p_request_id: String(form.get("request_id")),
      p_kind: kind,
      p_record: record,
    });
    if (result.error) {
      const code = result.error.code ?? "";
      if (code === "40001")
        return {
          error:
            "This record changed. Your inputs are retained. Reload the latest record and reconcile your changes.",
        };
      if (code === "42501")
        return {
          error: "That job, task or resource is not available to your company.",
        };
      if (code.startsWith("22") || code.startsWith("23") || code === "P0001")
        return {
          error:
            "Nothing was saved. Check dates, times, timezone, dependencies and active resource assignments.",
        };
      if (code === "PGRST202")
        return {
          error: "The scheduling migration must be installed before saving.",
        };
      return {
        error:
          "Save not confirmed. Retry the same submission to confirm safely.",
        uncertain: true,
      };
    }
    if (!result.data?.id || !result.data?.revision)
      return {
        error: "Save not confirmed. Retry the same submission.",
        uncertain: true,
      };
    try {
      for (const path of [
        "/",
        "/schedule",
        "/resources",
        `/projects/${record.project_id}`,
        `/projects/${record.project_id}/schedule`,
        `/projects/${record.project_id}/lookahead`,
      ])
        revalidatePath(path);
    } catch {
      /* Confirmed writes remain confirmed. */
    }
    return { error: null, id: result.data.id, revision: result.data.revision };
  } catch {
    return {
      error: "Connection interrupted. Retry the same submission.",
      uncertain: true,
    };
  }
}
