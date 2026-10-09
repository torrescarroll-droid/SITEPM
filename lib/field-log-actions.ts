"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyContext } from "@/lib/auth-context";
import { parseCrewRows, reportHasSubstance } from "@/lib/daily-report";
import { validCalendarDate } from "@/lib/operational-lookahead";

export type FieldLogFormState = {
  error: string | null;
  reportId: string | null;
  projectId?: string | null;
  revision?: number;
  uncertain?: boolean;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const names = ["notes", "work_performed", "deliveries", "equipment", "delays", "site_events", "safety_notes", "tomorrow", "location_text"] as const;

async function save(formData: FormData, editing: boolean): Promise<FieldLogFormState> {
  const failed = (error: string, uncertain = false): FieldLogFormState => ({ error, reportId: null, uncertain });
  const projectId = String(formData.get("project_id") ?? "");
  const reportId = editing ? String(formData.get("field_log_id") ?? "") : null;
  const requestId = String(formData.get("request_id") ?? "");
  const logDate = String(formData.get("log_date") ?? "");
  const revision = editing ? Number(formData.get("expected_revision")) : null;
  if (!uuid.test(projectId)) return failed("Choose a job.");
  if (!uuid.test(requestId)) return failed("Reload this page before saving; the submission key is missing.");
  if (editing && (!reportId || !uuid.test(reportId) || !Number.isSafeInteger(revision) || Number(revision) < 1)) return failed("Reload the latest report before editing.");
  if (!validCalendarDate(logDate)) return failed("Enter a valid report date.");
  const fields = Object.fromEntries(names.map(name => [name, String(formData.get(name) ?? "").trim() || null]));
  if (Object.values(fields).some(value => value && value.length > 20000)) return failed("Report fields must be 20,000 characters or fewer.");
  if (!reportHasSubstance({ notes: fields.notes, workPerformed: fields.work_performed, delays: fields.delays, deliveries: fields.deliveries })) return failed("Record the work, a delay, a delivery, or a note before saving.");
  let crews;
  try { crews = parseCrewRows(formData); } catch (error) { return failed(error instanceof Error ? error.message : "Check crew rows."); }
  if (crews.length > 50 || crews.some(crew => crew.tradeName.length > 200 || (crew.companyName?.length ?? 0) > 200)) return failed("Use at most 50 crew rows, with names up to 200 characters.");
  const followUp = editing ? null : String(formData.get("follow_up_title") ?? "").trim() || null;
  if (followUp && followUp.length > 500) return failed("Follow-up must be 500 characters or fewer.");
  // Authentication redirects remain outside the transport-error handler.
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) return failed("Your company profile is not ready yet.");
  let result;
  try {
    result = await supabase.rpc("save_field_report", {
      p_request_id: requestId, p_project_id: projectId, p_report_id: reportId,
      p_expected_revision: revision,
      p_report: { ...fields, log_date: logDate, issue_flag: formData.get("issue_flag") === "on" },
      p_crews: crews, p_follow_up: followUp,
    });
  } catch { return failed("Save confirmation was interrupted. Retry this submission to check whether it saved; it will not create a duplicate.", true); }
  if (result.error) {
    const code = result.error.code;
    if (code === "40001") return failed("This report changed since you opened it. Your draft is retained. Open the latest report in another tab and reconcile before reloading.");
    if (code === "42501") return failed("You no longer have permission to save this job or report. Nothing was saved.");
    if (code === "PGRST202") return failed("Reliable report saving is not enabled in this environment yet. Your draft is retained; contact your administrator.");
    if (code?.startsWith("22") || code?.startsWith("23") || code === "P0001") return failed("The database rejected this report or a related record. Nothing was saved. Check your date and crew rows, then retry.");
    return failed("Save could not be confirmed. Retry this submission before making changes; it will not create a duplicate.", true);
  }
  const row = result.data?.[0];
  if (!row?.report_id || row.project_id !== projectId || !Number.isInteger(row.revision)) return failed("Save confirmation was incomplete. Retry this submission safely.", true);
  // Persistence is confirmed before cache refresh. A refresh failure must not invite a second create.
  try {
    for (const path of ["/", "/field", `/projects/${projectId}`, `/projects/${projectId}/field`, `/projects/${projectId}/tasks`, `/projects/${projectId}/lookahead`]) revalidatePath(path);
    revalidatePath(`/projects/${projectId}/field`, "layout");
  } catch { /* A confirmed save remains a success; refresh on next navigation. */ }
  return { error: null, reportId: row.report_id, projectId, revision: row.revision };
}

export async function createFieldLog(_prev: FieldLogFormState, formData: FormData) { return save(formData, false); }
export async function updateFieldLog(_prev: FieldLogFormState, formData: FormData) { return save(formData, true); }
