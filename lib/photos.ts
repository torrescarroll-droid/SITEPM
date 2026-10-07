import type { PhotoRecord, PhotoStatus } from "@/lib/photo-types";
import { requireCompanyContext } from "@/lib/auth-context";
import { getAuthorizedProject } from "@/lib/projects";
import { missingRelationOrColumn } from "@/lib/schema-compat";

type PhotoRow = {
  id: string;
  company_id: string;
  project_id: string;
  field_log_id: string;
  caption: string | null;
  content_type: string;
  byte_size: number;
  uploaded_by: string | null;
  created_at: string;
  status: string;
};

const photoColumns =
  "id, company_id, project_id, field_log_id, caption, content_type, byte_size, uploaded_by, created_at, status";

function mapPhoto(row: PhotoRow): PhotoRecord {
  const status: PhotoStatus =
    row.status === "ready" || row.status === "failed" ? row.status : "pending";
  return {
    id: row.id,
    company_id: row.company_id,
    project_id: row.project_id,
    field_log_id: row.field_log_id,
    caption: row.caption,
    content_type: row.content_type,
    byte_size: row.byte_size,
    uploaded_by: row.uploaded_by,
    created_at: row.created_at,
    status,
  };
}

export async function listProjectPhotos(projectId: string) {
  await getAuthorizedProject(projectId);
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) return [];
  const result = await supabase
    .from("photos")
    .select(photoColumns)
    .eq("company_id", profile.company_id)
    .eq("project_id", projectId)
    .eq("status", "ready")
    .order("created_at", { ascending: false });
  if (result.error) {
    if (missingRelationOrColumn(result.error.message)) return [];
    throw new Error(result.error.message);
  }
  return ((result.data ?? []) as PhotoRow[]).map(mapPhoto);
}

export async function listPhotosForReports(projectId: string, reportIds: string[]) {
  if (reportIds.length === 0) return [];
  const photos = await listProjectPhotos(projectId);
  const allowed = new Set(reportIds);
  return photos.filter((photo) => allowed.has(photo.field_log_id));
}
