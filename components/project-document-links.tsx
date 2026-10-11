import Link from "next/link";
import { requireCompanyContext } from "@/lib/auth-context";
/** References show the pinned source; promotion never silently changes an operational reference. */
export async function ProjectDocumentLinks({
  projectId,
  kind,
  targetId,
}: {
  projectId: string;
  kind: "task" | "activity" | "field_log";
  targetId?: string;
}) {
  const { supabase } = await requireCompanyContext();
  const column =
    kind === "task"
      ? "task_id"
      : kind === "activity"
        ? "activity_id"
        : "field_log_id";
  let query = supabase
    .from("document_links")
    .select("id,document_id,task_id,activity_id,field_log_id")
    .eq("project_id", projectId)
    .not(column, "is", null)
    .limit(100);
  if (targetId) query = query.eq(column, targetId);
  const links = await query;
  if (links.error) throw Error("Pinned document references could not load.");
  if (!links.data.length)
    return (
      <p className="my-4 text-sm text-stone-600">
        No pinned document references. Add exact-version references from{" "}
        <Link className="underline" href={`/projects/${projectId}/documents`}>
          job documents
        </Link>
        .
      </p>
    );
  const versions = await supabase
    .from("document_versions")
    .select(
      "document_id,family_id,version_number,document_families!document_versions_family_id_company_id_project_id_fkey!inner(title,current_document_id,archived)",
    )
    .in(
      "document_id",
      links.data.map((l) => l.document_id),
    );
  if (versions.error)
    throw Error("Document version references could not load.");
  return (
    <section className="my-6 rounded-lg border bg-white p-4">
      <h2 className="section-title">Pinned document references</h2>
      <p className="text-sm">
        Exact source versions; scheduling and work completion remain separate.
      </p>
      {links.data.map((l) => {
        const v = versions.data.find((v) => v.document_id === l.document_id);
        if (!v) return null;
        const f = v.document_families as unknown as {
          title: string;
          current_document_id: string | null;
          archived: boolean;
        };
        return (
          <p key={l.id} className="border-t py-3 break-words">
            <Link className="underline" href={`/documents/${v.family_id}`}>
              {f.title} · version {v.version_number}
            </Link>
            <span className="block text-sm">
              {kind.replace("_", " ")} {String(l[column]).slice(0, 8)} ·{" "}
              {f.archived
                ? "Archived — restore to open"
                : f.current_document_id === v.document_id
                  ? "Current source"
                  : f.current_document_id
                    ? "Different version is current — pinned source retained"
                    : "No current version selected"}
            </span>
            {!f.archived && (
              <a
                className="underline text-sm"
                href={`/documents/file/${v.document_id}`}
              >
                Open pinned file
              </a>
            )}
          </p>
        );
      })}
    </section>
  );
}
