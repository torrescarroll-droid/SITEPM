export const PHOTO_BUCKET = "job-photos";
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTO_SIGNED_URL_SECONDS = 60;

export type PhotoStatus = "pending" | "ready" | "failed";

export type PhotoRecord = {
  id: string;
  company_id: string;
  project_id: string;
  field_log_id: string;
  caption: string | null;
  content_type: string;
  byte_size: number;
  uploaded_by: string | null;
  created_at: string;
  status: PhotoStatus;
};

export type DetectedPhoto = {
  mime: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

export function detectPhoto(bytes: Uint8Array): DetectedPhoto | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { mime: "image/png", extension: "png" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

/** Storage folder must be this company and this job. The file name is not authority. */
export function photoObjectAllowed(
  objectName: string,
  companyId: string,
  projectId: string,
) {
  const parts = objectName.split("/");
  if (parts.length < 4) return false;
  return parts[0] === companyId && parts[1] === projectId;
}
