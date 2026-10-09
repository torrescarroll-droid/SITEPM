import Link from "next/link";
import { DocumentUpload } from "@/components/document-upload";
import { listDocumentFamilies } from "@/lib/document-management";
import { requireCompanyContext } from "@/lib/auth-context";
import { searchAuthorizedProjectDocumentChunks } from "@/lib/document-chunk-retrieval";
export async function DocumentDesk({
  projects,
  projectId,
  filters,
}: {
  projects: { id: string; name: string }[];
  projectId?: string;
  filters: {
    q?: string;
    job?: string;
    archived?: string;
    page?: string;
    content?: string;
  };
}) {
  const { user, profile } = await requireCompanyContext();
  const project =
      projectId ??
      (projects.some((p) => p.id === filters.job) ? filters.job : undefined),
    query = (filters.q ?? "").slice(0, 200),
    archived = filters.archived === "true",
    page = Math.min(2000, Math.max(0, Math.floor(Number(filters.page) || 0)));
  const rows = await listDocumentFamilies({
    project,
    query,
    archived,
    offset: page * 50,
  });
  let hits: Awaited<ReturnType<typeof searchAuthorizedProjectDocumentChunks>> =
      [],
    searchError = "";
  if (filters.content === "true" && project && query && !archived)
    try {
      hits = await searchAuthorizedProjectDocumentChunks({
        projectId: project,
        query,
      });
    } catch {
      searchError =
        "PDF text search is unavailable. Metadata search and original files remain available.";
    }
  const link = (n: number) =>
    "?" +
    new URLSearchParams({
      q: query,
      job: project ?? "",
      archived: String(archived),
      page: String(n),
      content: filters.content ?? "",
    });
  return (
    <div className="grid gap-6 items-start xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)]">
      <DocumentUpload
        scope={`${profile?.company_id}:${user.id}`}
        projectId={projectId}
        projects={projects}
      />
      <div className="space-y-4">
        <form className="rounded-lg border bg-white p-4 space-y-3">
          <label className="block">
            Find documents
            <input
              className="control w-full"
              type="search"
              name="q"
              defaultValue={query}
              maxLength={200}
              placeholder="Title, filename, collection, trade or issue"
            />
          </label>
          {!projectId && (
            <label className="block">
              Job filter
              <select
                className="control w-full"
                name="job"
                defaultValue={project ?? ""}
              >
                <option value="">All jobs</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex gap-2">
            <input
              type="checkbox"
              name="archived"
              value="true"
              defaultChecked={archived}
            />
            Show archived groups
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              name="content"
              value="true"
              defaultChecked={filters.content === "true"}
            />
            Also search current digital-PDF text (choose one job)
          </label>
          <button className="control button-primary text-white">
            Search documents
          </button>
        </form>
        <p className="text-sm">
          {archived
            ? "Archived documents — restore to open files."
            : "Current versions and upload candidates. Open a group for issue history."}{" "}
          Metadata search works without AI.
        </p>
        {rows.length === 0 && (
          <div className="rounded-lg border p-4">
            No matching documents. Choose another filter or upload source
            material for this job.
          </div>
        )}
        {rows.slice(0, 50).map((f) => (
          <article
            className="rounded-lg border bg-white p-4 break-words"
            key={f.id}
          >
            <Link
              className="font-semibold underline"
              href={`/documents/${f.id}`}
            >
              {f.title}
            </Link>
            <p>
              {projects.find((p) => p.id === f.project_id)?.name ?? "Job"} ·{" "}
              {f.category.replaceAll("_", " ")}
              {f.trade && ` · ${f.trade}`}
            </p>
            <p className="text-sm">
              {f.collection || "No collection"} ·{" "}
              {f.archived
                ? "Archived"
                : f.current_document_id
                  ? "Current version available"
                  : "No current version selected"}
            </p>
          </article>
        ))}
        <nav aria-label="Document pages" className="flex gap-4">
          {page > 0 && <Link href={link(page - 1)}>Previous documents</Link>}
          {rows.length > 50 && (
            <Link href={link(page + 1)}>More documents</Link>
          )}
        </nav>
        {filters.content === "true" && (
          <section className="rounded-lg border bg-white p-4">
            <h2 className="section-title">Current PDF text results</h2>
            <p className="text-sm">
              Source text excerpts, not AI interpretations. Up to 25 matches;
              scans and Office files use metadata search.
            </p>
            {!project && <p>Choose one job to search its PDF text.</p>}
            {searchError && <p role="status">{searchError}</p>}
            {project && !searchError && !hits?.length && (
              <p>
                No indexed current PDF text matched. Check the version’s
                indexing state or try different terms.
              </p>
            )}
            {hits?.map((h) => (
              <article key={h.chunk_id} className="border-t py-3">
                <a
                  href={`/documents/file/${h.document_id}`}
                  className="underline"
                >
                  Open exact source · {h.locator}
                </a>
                <blockquote className="text-sm whitespace-pre-wrap break-words">
                  {h.body.slice(0, 600)}
                </blockquote>
                <p className="text-xs">
                  Version file {h.document_id} · source{" "}
                  {h.source_sha256.slice(0, 12)}
                </p>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
