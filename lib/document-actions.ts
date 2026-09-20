"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCompanyContext } from "@/lib/auth-context";
import { findAuthorizedProject } from "@/lib/projects";
import { getAuthorizedDocument } from "@/lib/documents";
import {
  DOCUMENT_BUCKET,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_SIGNED_URL_SECONDS,
  isDocumentType,
  type DocumentType,
} from "@/lib/document-types";

export type DocumentFormState = {
  error: string | null;
};

function revalidateDocumentPaths(projectId: string) {
  revalidatePath("/documents");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/documents`);
}

function sanitizePdfFilename(raw: string) {
  const base = raw.split(/[/\\]/).pop()?.trim() || "document.pdf";
  const withoutExt = base.replace(/\.pdf$/i, "");
  const cleaned = withoutExt.replace(/[^A-Za-z0-9._ -]/g, "_").replace(/\s+/g, " ").trim();
  const stem = cleaned.length > 0 ? cleaned.slice(0, 120) : "document";
  return `${stem}.pdf`;
}

function isPdf(bytes: Buffer, mime: string, filename: string) {
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return false;
  }
  if (mime && mime !== "application/pdf" && mime !== "application/x-pdf") {
    return false;
  }
  return bytes.subarray(0, 4).toString("utf8") === "%PDF";
}

export async function uploadProjectDocument(
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const projectId = String(formData.get("project_id") ?? "").trim();
  const typeRaw = String(formData.get("document_type") ?? "").trim();
  const file = formData.get("file");

  if (!projectId) {
    return { error: "Choose a project." };
  }
  if (!isDocumentType(typeRaw)) {
    return { error: "Choose a document category." };
  }
  const documentType: DocumentType = typeRaw;
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF to upload." };
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return { error: "PDFs must be 20 MB or smaller." };
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

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = sanitizePdfFilename(file.name);
  if (!isPdf(bytes, file.type, filename)) {
    return { error: "Only PDF files can be uploaded." };
  }

  const documentId = randomUUID();
  const storagePath = `${project.company_id}/${project.id}/${documentId}/${filename}`;
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const insert = await supabase.from("documents").insert({
    id: documentId,
    company_id: profile.company_id,
    project_id: project.id,
    filename,
    storage_path: storagePath,
    document_type: documentType,
    uploaded_by: profile.id,
    content_type: "application/pdf",
    byte_size: bytes.length,
    sha256,
    status: "pending",
  });

  if (insert.error) {
    return { error: insert.error.message };
  }

  const upload = await supabase.storage.from(DOCUMENT_BUCKET).upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });

  if (upload.error) {
    await supabase
      .from("documents")
      .update({ status: "failed" })
      .eq("id", documentId)
      .eq("company_id", profile.company_id);
    return {
      error: `The file was not stored. ${upload.error.message}`,
    };
  }

  const ready = await supabase
    .from("documents")
    .update({ status: "ready" })
    .eq("id", documentId)
    .eq("company_id", profile.company_id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (ready.error || !ready.data) {
    return {
      error:
        "The file was stored but could not be marked ready. It will not appear in the list. Try uploading again.",
    };
  }

  revalidateDocumentPaths(project.id);
  return { error: null };
}

export async function openProjectDocument(formData: FormData): Promise<void> {
  const id = String(formData.get("document_id") ?? "").trim();
  if (!id) {
    return;
  }

  const document = await getAuthorizedDocument(id, { statuses: ["ready"] });
  if (!document) {
    return;
  }

  const { supabase } = await requireCompanyContext();
  const signed = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(document.storage_path, DOCUMENT_SIGNED_URL_SECONDS);

  if (signed.error || !signed.data?.signedUrl) {
    return;
  }

  redirect(signed.data.signedUrl);
}
