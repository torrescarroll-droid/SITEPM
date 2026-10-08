import Link from "next/link";
import { notFound } from "next/navigation";
import { FieldLogList } from "@/components/field-log";
import { NewTaskForm, TaskList } from "@/components/task-list";
import { ProjectTabs } from "@/components/project-tabs";
import { Card, PageHeader } from "@/components/ui";
import { findAuthorizedFieldLog } from "@/lib/field-logs";
import { formatProjectDate } from "@/lib/format-date";
import { openReportPhoto } from "@/lib/photo-actions";
import { listPhotosForReports } from "@/lib/photos";
import { getAuthorizedProject } from "@/lib/projects";
import { listProjectTasks } from "@/lib/tasks";

export default async function ReportPage({ params }: { params: Promise<{ id: string; reportId: string }> }) {
  const { id, reportId } = await params;
  const project = await getAuthorizedProject(id);
  const report = await findAuthorizedFieldLog(id, reportId);
  if (!report) notFound();
  const [photos, tasks] = await Promise.all([listPhotosForReports(id, [report.id]), listProjectTasks(id)]);
  const linked = tasks.filter((task) => task.source_field_log_id === report.id);
  return (
    <div className="space-y-5">
      <PageHeader kicker="Source daily report" title={`${project.name} · ${formatProjectDate(report.log_date)}`} />
      <ProjectTabs projectId={id} active="field" />
      <Link className="inline-block text-sm underline" href={`/projects/${id}/lookahead`}>Back to lookahead</Link>
      <FieldLogList logs={[report]} photos={photos} projectNames={{ [id]: project.name }} />
      <Card>
        <h2 className="section-title">Photo evidence</h2>
        {photos.length ? <ul className="mt-3 space-y-2">{photos.map((photo) => <li key={photo.id}><form action={openReportPhoto}><input type="hidden" name="photo_id" value={photo.id} /><button className="control min-h-11 text-sm underline">{photo.caption || "Open jobsite photo"}</button></form></li>)}</ul> : <p className="mt-3 text-sm text-stone-600">No photos on this report yet. Add a photo above.</p>}
      </Card>
      <section id="follow-up" className="scroll-mt-6 space-y-3">
        <h2 className="section-title">Follow-up accountability</h2>
        <p className="text-sm text-stone-600">Assign an owner, trade, and date. The to-do stays linked to this report and appears in the job lookahead.</p>
        <TaskList tasks={linked} projectNames={{ [id]: project.name }} />
        <NewTaskForm projectId={id} projects={[{ id, name: project.name }]} sourceReport={{ id: report.id, location: report.location_text ?? null, description: report.delays || report.notes || report.work_performed || null }} />
      </section>
    </div>
  );
}
