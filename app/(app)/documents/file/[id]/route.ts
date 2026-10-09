import { getAuthorizedDocument } from "@/lib/documents";
import { requireCompanyContext } from "@/lib/auth-context";
import {
  DOCUMENT_BUCKET,
  DOCUMENT_SIGNED_URL_SECONDS,
} from "@/lib/document-types";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new Response("Not found", { status: 404 });
  const d = await getAuthorizedDocument(id);
  if (!d) return new Response("Not found", { status: 404 });
  const { supabase } = await requireCompanyContext();
  const signed = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(d.storage_path, DOCUMENT_SIGNED_URL_SECONDS, {
      download: d.filename,
    });
  if (signed.error || !signed.data)
    return new Response(
      "Download not confirmed. Return to the document and retry.",
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  return new Response(null, {
    status: 303,
    headers: {
      Location: signed.data.signedUrl,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
