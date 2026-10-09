import "server-only";
import postgres from "postgres";
let connection: ReturnType<typeof postgres> | undefined;
export function documentVerifierConfigured() {
  return Boolean(process.env.SITEPM_DOCUMENT_DATABASE_URL?.trim());
}
export async function trustedDocumentOperation(
  actor: string,
  operation: "verify" | "processing" | "processingBegin",
  input: {
    request?: string;
    sha?: string;
    size?: number;
    document?: string;
    state?: string;
  },
) {
  const url = process.env.SITEPM_DOCUMENT_DATABASE_URL?.trim();
  if (!url)
    throw Error(
      "File verification is temporarily unavailable. Your upload can be retried safely.",
    );
  const local = ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
  connection ??= postgres(url, {
    max: 2,
    prepare: false,
    ssl: local ? false : "require",
    connect_timeout: 10,
    idle_timeout: 20,
  });
  return connection.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${actor},true)`;
    if (operation === "verify")
      return (
        await tx`select public.verify_document_upload(${input.request!}::uuid,${input.sha!},${input.size!}::bigint) as result`
      )[0].result;
    if (operation === "processingBegin") {
      await tx`select public.request_document_processing(${input.document!}::uuid)`;
      return null;
    }
    await tx`select public.document_processing_result(${input.document!}::uuid,${input.state!})`;
    return null;
  });
}
