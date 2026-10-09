"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireCompanyContext } from "@/lib/auth-context";
import { DOCUMENT_BUCKET, isDocumentType } from "@/lib/document-types";
import {
  documentFileIdentity,
  validateDocumentBytes,
} from "@/lib/document-file";
import {
  trustedDocumentOperation,
  documentVerifierConfigured,
} from "@/lib/document-verifier";
import { getAuthorizedDocument } from "@/lib/documents";
import { persistReadyPdfExtraction } from "@/lib/document-extraction-persist";
export type DocumentMutationResult = {
  error?: string;
  data?: Record<string, unknown>;
};
const uuid = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
function refresh(project: string) {
  try {
    revalidatePath("/documents");
    revalidatePath(`/projects/${project}`);
    revalidatePath(`/projects/${project}/documents`);
  } catch {
    /* Persistence was confirmed; cache invalidation cannot change that result. */
  }
}
function failure(
  e: { code?: string; message?: string } | null,
): DocumentMutationResult {
  if (e?.message === "Upload limit reached; retry later")
    return {
      error:
        "The 50 uploads per hour limit was reached. Keep this draft and retry later.",
    };
  if (e?.message === "Company document capacity reached")
    return {
      error:
        "Company document capacity is full. Pending files reserve 20 MiB until verified. Confirm existing uploads or contact your company administrator.",
    };
  return {
    error:
      e?.code === "40001"
        ? "This document changed. Reload the latest record before editing."
        : "Nothing was confirmed. Check the file and job, then retry the same upload. Existing current versions are unchanged.",
  };
}
export async function startDocumentUpload(
  request: string,
  input: Record<string, unknown>,
): Promise<DocumentMutationResult> {
  if (
    !uuid(request) ||
    !uuid(input.id) ||
    !uuid(input.project_id) ||
    !isDocumentType(String(input.category)) ||
    typeof input.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.sha256)
  )
    return { error: "Choose a job, category and supported file." };
  let identity;
  try {
    identity = documentFileIdentity(
      String(input.filename),
      Number(input.byte_size),
    );
  } catch (e) {
    return { error: (e as Error).message };
  }
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) return { error: "Company profile unavailable." };
  if (!documentVerifierConfigured())
    return {
      error:
        "File verification is temporarily unavailable. Please try again later.",
    };
  const record = {
    ...input,
    filename: identity.filename,
    content_type: identity.contentType,
    storage_path: `${profile.company_id}/${input.project_id}/${input.id}/${identity.filename}`,
  };
  const result = await supabase.rpc("begin_document_upload", {
    p_request: request,
    p_record: record,
  });
  if (result.error) return failure(result.error);
  if (result.data.verified) return { data: { ...result.data, verified: true } };
  const signed = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUploadUrl(result.data.storage_path, { upsert: false });
  if (signed.error || !signed.data)
    return {
      error:
        "Upload registered, but its upload connection was not confirmed. Retry the same file.",
    };
  const session = await supabase.auth.getSession();
  if (!session.data.session)
    return { error: "Session expired. Sign in and retry safely." };
  return {
    data: {
      ...result.data,
      access_token: session.data.session.access_token,
      token: signed.data.token,
      content_type: identity.contentType,
      endpoint: `${process.env.SUPABASE_URL}/storage/v1/upload/resumable`,
      apikey: process.env.SUPABASE_ANON_KEY,
    },
  };
}
export async function confirmDocumentUpload(
  request: string,
): Promise<DocumentMutationResult> {
  if (!uuid(request)) return { error: "Invalid upload identity." };
  const { supabase, user, profile } = await requireCompanyContext();
  if (!profile?.company_id) return { error: "Company profile unavailable." };
  const attempt = await supabase
    .from("document_upload_attempts")
    .select("document_id,verified_at")
    .eq("request_id", request)
    .eq("actor_id", user.id)
    .maybeSingle();
  if (!attempt.data) return { error: "Upload unavailable." };
  const d = await getAuthorizedDocument(attempt.data.document_id, {
    statuses: ["pending", "ready"],
  });
  if (!d) return { error: "Upload unavailable." };
  // A trusted receipt attests immutable bytes already verified by the server.
  // Recover a lost success response even if Storage is temporarily unavailable.
  if (attempt.data.verified_at && d.status === "ready") {
    const v = await supabase
      .from("document_versions")
      .select("family_id")
      .eq("document_id", d.id)
      .maybeSingle();
    if (v.data)
      return {
        data: {
          document_id: d.id,
          family_id: v.data.family_id,
          verified: true,
        },
      };
  }
  try {
    const downloaded = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .download(d.storage_path);
    if (downloaded.error || !downloaded.data)
      return {
        error:
          "File storage is not confirmed. Reselect the same file and retry.",
      };
    if (
      downloaded.data.type &&
      downloaded.data.type.split(";")[0] !== d.content_type
    )
      throw Error("Stored media type mismatch.");
    if (downloaded.data.size !== d.byte_size)
      throw Error("Stored file size mismatch.");
    const bytes = Buffer.from(await downloaded.data.arrayBuffer());
    validateDocumentBytes(d.filename, bytes);
    const sha = createHash("sha256").update(bytes).digest("hex");
    const result = await trustedDocumentOperation(user.id, "verify", {
      request,
      sha,
      size: bytes.length,
    });
    refresh(d.project_id);
    return { data: result };
  } catch {
    return {
      error:
        "File verification was not confirmed. Reselect the same file to retry. Unsupported, changed or unsafe files cannot be published.",
    };
  }
}
export async function manageDocument(
  family: string,
  revision: number,
  action: string,
  data: Record<string, unknown>,
): Promise<DocumentMutationResult> {
  if (
    !uuid(family) ||
    !Number.isSafeInteger(revision) ||
    revision < 1 ||
    !["metadata", "promote", "archive", "restore", "link", "unlink"].includes(
      action,
    )
  )
    return { error: "Invalid document action." };
  const { supabase } = await requireCompanyContext();
  const r = await supabase.rpc("manage_project_document", {
    p_family: family,
    p_revision: revision,
    p_action: action,
    p_data: data,
  });
  if (r.error) return failure(r.error);
  try {
    revalidatePath("/documents", "layout");
    revalidatePath("/projects", "layout");
  } catch {}
  return { data: r.data };
}
export async function processDocumentText(
  documentId: string,
): Promise<DocumentMutationResult> {
  const { supabase, user, profile } = await requireCompanyContext();
  const document = await getAuthorizedDocument(documentId);
  if (!profile?.company_id || !document)
    return { error: "Document unavailable." };
  if (document.content_type !== "application/pdf")
    return {
      error:
        "Text search supports digital PDFs. Other files remain downloadable.",
    };
  if (!process.env.SITEPM_EXTRACTOR_DATABASE_URL?.trim())
    return {
      error:
        "File is saved. Text indexing is unavailable until the restricted extractor is configured.",
    };
  try {
    await trustedDocumentOperation(user.id, "processingBegin", {
      document: documentId,
    });
  } catch {
    return {
      error:
        "Text indexing is busy or its limit was reached. Your file remains saved; retry later.",
    };
  }
  try {
    const result = await persistReadyPdfExtraction(
      { document, callerCompanyId: profile.company_id },
      {
        ...(await import("@/lib/document-extraction-persist"))
          .defaultPersistReadyPdfExtractionDeps,
        downloadCanonicalObject: async (path) => {
          const r = await supabase.storage.from(DOCUMENT_BUCKET).download(path);
          if (r.error || !r.data) throw Error("Download unavailable");
          return Buffer.from(await r.data.arrayBuffer());
        },
      },
    );
    await trustedDocumentOperation(user.id, "processing", {
      document: documentId,
      state: "skipped" in result ? "retry_required" : "searchable",
    });
    refresh(document.project_id);
    return "skipped" in result
      ? {
          error:
            "File is saved. Text indexing is unavailable until the restricted extractor is configured.",
        }
      : { data: { searchable: true } };
  } catch (e) {
    const code = (e as { code?: string }).code;
    const unsupported = [
      "textless_pdf",
      "encrypted_pdf",
      "page_limit",
      "text_limit",
    ].includes(code ?? "");
    try {
      await trustedDocumentOperation(user.id, "processing", {
        document: documentId,
        state: unsupported ? "unsupported" : "retry_required",
      });
    } catch {}
    return {
      error: unsupported
        ? "File is saved. This PDF has no supported searchable text."
        : "File is saved. Text indexing did not complete; retry later.",
    };
  }
}
