import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import {
  DocumentControls,
  RemoveDocumentLink,
} from "@/components/document-controls";
import { DocumentUpload } from "@/components/document-upload";
import { documentFamilyDetail } from "@/lib/document-management";
import { requireCompanyContext } from "@/lib/auth-context";
import { getAuthorizedProject } from "@/lib/projects";
export default async function DocumentDetail({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(familyId)) notFound();
  const detail = await documentFamilyDetail(familyId);
  if (!detail) notFound();
  const { family, versions, links, events } = detail;
  const { supabase, user } = await requireCompanyContext();
  const project = await getAuthorizedProject(family.project_id);
  const [tasks, activities, reports] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title")
      .eq("project_id", family.project_id)
      .limit(200),
    supabase
      .from("schedule_activities")
      .select("id,name")
      .eq("project_id", family.project_id)
      .limit(200),
    supabase
      .from("field_logs")
      .select("id,log_date")
      .eq("project_id", family.project_id)
      .order("log_date", { ascending: false })
      .limit(200),
  ]);
  if (tasks.error || activities.error || reports.error)
    throw Error("Work references could not load.");
  const targets = [
    ...(tasks.data ?? []).map((t) => ({
      id: t.id,
      label: `To-do · ${t.title}`,
      kind: "task_id" as const,
    })),
    ...(activities.data ?? []).map((a) => ({
      id: a.id,
      label: `Schedule · ${a.name}`,
      kind: "activity_id" as const,
    })),
    ...(reports.data ?? []).map((r) => ({
      id: r.id,
      label: `Daily report · ${r.log_date}`,
      kind: "field_log_id" as const,
    })),
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Plans & Docs"
        title={family.title}
        description={`${project.name} · ${family.archived ? "Archived — restore to access files" : family.current_document_id ? "Current version selected" : "No current version yet — review and promote a verified file"}`}
      />
      <Link className="control" href={`/projects/${project.id}/documents`}>
        Back to job documents
      </Link>
      <div className="grid gap-6 items-start xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)]">
        <div className="space-y-6">
          {!family.archived && (
            <DocumentUpload
              scope={`${family.company_id}:${user.id}`}
              projectId={project.id}
              familyId={family.id}
              projects={[project]}
            />
          )}
          <section className="rounded-lg border bg-white p-4">
            <h2 className="section-title">Pinned work references</h2>
            <p className="text-sm">
              References retain the exact source version. The latest 200 records
              per work type are selectable.
            </p>
            {!links.length && <p>No work references yet.</p>}
            {links.map((l) => {
              const target = targets.find(
                  (t) =>
                    t.id === (l.task_id ?? l.activity_id ?? l.field_log_id),
                ),
                v = versions.find((v) => v.document_id === l.document_id);
              const url = l.task_id
                ? `/projects/${project.id}/tasks`
                : l.activity_id
                  ? `/projects/${project.id}/schedule`
                  : `/projects/${project.id}/field/${l.field_log_id}`;
              return (
                <div key={l.id} className="border-t py-3">
                  <Link href={url}>
                    {target?.label ?? "Recorded work reference"}
                  </Link>
                  <p>
                    Version {v?.version_number ?? "recorded"}
                    {family.current_document_id &&
                      family.current_document_id !== l.document_id &&
                      " · newer/different current version — reference unchanged"}
                  </p>
                  <RemoveDocumentLink family={family} link={l.id} />
                </div>
              );
            })}
          </section>
          <details className="rounded-lg border bg-white p-4">
            <summary>Change history (latest 100)</summary>
            {events.map((e) => (
              <details key={e.id} className="text-sm">
                <summary>
                  {e.kind.replaceAll("_", " ")} · actor{" "}
                  {e.actor_id?.slice(0, 8) ?? "legacy"} ·{" "}
                  {new Date(e.occurred_at).toISOString()}
                </summary>
                <pre className="whitespace-pre-wrap break-words text-xs">
                  {JSON.stringify(e.details, null, 2)}
                </pre>
              </details>
            ))}
          </details>
        </div>
        <DocumentControls
          key={family.id}
          family={family}
          versions={versions}
          targets={targets}
        />
      </div>
    </div>
  );
}
