"use server";
import { redirect } from "next/navigation";
import { requireCompanyContext } from "@/lib/auth-context";
import { getAuthorizedDocument } from "@/lib/documents";
import {
  DOCUMENT_BUCKET,
  DOCUMENT_SIGNED_URL_SECONDS,
} from "@/lib/document-types";

// Legacy read entry point retained; every upload now uses the transactional document boundary.
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
