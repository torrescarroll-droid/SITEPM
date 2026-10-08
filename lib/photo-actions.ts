"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCompanyContext } from "@/lib/auth-context";
import { findAuthorizedProject } from "@/lib/projects";
import {
  PHOTO_BUCKET,
  PHOTO_MAX_BYTES,
  PHOTO_SIGNED_URL_SECONDS,
  detectPhoto,
} from "@/lib/photo-types";

export type PhotoFormState = {
  error: string | null;
};

function revalidatePhotoPaths(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/field`);
  revalidatePath("/field");
  revalidatePath(`/projects/${projectId}/lookahead`);
  revalidatePath(`/projects/${projectId}/field`, "layout");
}

export async function uploadReportPhoto(
  _prev: PhotoFormState,
  formData: FormData,
): Promise<PhotoFormState> {
  const projectId = String(formData.get("project_id") ?? "").trim();
  const reportId = String(formData.get("field_log_id") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  const file = formData.get("file");

  if (!projectId || !reportId) return { error: "Choose the daily report for this photo." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo." };
  if (file.size > PHOTO_MAX_BYTES) return { error: "Photos must be 8 MB or smaller." };

  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) return { error: "Your company profile is not ready yet." };

  const project = await findAuthorizedProject(projectId);
  if (!project) return { error: "That job is not available to your company." };

  const report = await supabase
    .from("field_logs")
    .select("id, project_id")
    .eq("id", reportId)
    .eq("company_id", profile.company_id)
    .eq("project_id", project.id)
    .maybeSingle();
  if (report.error || !report.data) {
    return { error: "That daily report is not on this job." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectPhoto(bytes);
  if (!detected) return { error: "Use a JPEG, PNG, or WebP photo." };

  const photoId = randomUUID();
  const filename = `photo.${detected.extension}`;
  const storagePath = `${project.company_id}/${project.id}/${photoId}/${filename}`;

  const insert = await supabase.from("photos").insert({
    id: photoId,
    company_id: profile.company_id,
    project_id: project.id,
    field_log_id: report.data.id,
    storage_path: storagePath,
    caption: caption || null,
    content_type: detected.mime,
    byte_size: bytes.length,
    uploaded_by: profile.id,
    status: "pending",
  });
  if (insert.error) return { error: insert.error.message };

  const upload = await supabase.storage.from(PHOTO_BUCKET).upload(storagePath, bytes, {
    contentType: detected.mime,
    upsert: false,
  });
  if (upload.error) {
    await supabase
      .from("photos")
      .update({ status: "failed" })
      .eq("id", photoId)
      .eq("company_id", profile.company_id);
    return { error: "The photo could not be stored." };
  }

  const ready = await supabase
    .from("photos")
    .update({ status: "ready" })
    .eq("id", photoId)
    .eq("company_id", profile.company_id);
  if (ready.error) return { error: ready.error.message };

  revalidatePhotoPaths(project.id);
  return { error: null };
}

export async function openReportPhoto(formData: FormData) {
  const photoId = String(formData.get("photo_id") ?? "").trim();
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id || !photoId) redirect("/");

  const photo = await supabase
    .from("photos")
    .select("storage_path, status, project_id")
    .eq("id", photoId)
    .eq("company_id", profile.company_id)
    .eq("status", "ready")
    .maybeSingle();
  if (photo.error || !photo.data?.storage_path) redirect("/");

  const signed = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(photo.data.storage_path, PHOTO_SIGNED_URL_SECONDS);
  if (signed.error || !signed.data?.signedUrl) redirect(`/projects/${photo.data.project_id}/field`);
  redirect(signed.data.signedUrl);
}
