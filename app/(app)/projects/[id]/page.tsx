import { JobDesk } from "@/components/job-desk";
import { ProjectTabs } from "@/components/project-tabs";
import { PageHeader } from "@/components/ui";
import { listProjectDocuments } from "@/lib/documents";
import { listProjectFieldLogs } from "@/lib/field-logs";
import { buildJobDesk } from "@/lib/job-desk";
import { listProjectPhotos } from "@/lib/photos";
import { getAuthorizedProject } from "@/lib/projects";
import { listProjectScheduleActivities } from "@/lib/schedule";
import { localTodayIso } from "@/lib/schedule-logic";
import { listProjectTasks } from "@/lib/tasks";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getAuthorizedProject(id);
  const [tasks, fieldLogs, documents, activities, photos] = await Promise.all([
    listProjectTasks(id),
    listProjectFieldLogs(id),
    listProjectDocuments(id),
    listProjectScheduleActivities(id),
    listProjectPhotos(id),
  ]);
  const desk = buildJobDesk({
    tasks,
    fieldLogs,
    documents,
    activities,
    photos,
    today: localTodayIso(),
  });

  return (
    <div>
      <PageHeader
        kicker="Job"
        title={project.name}
        description={project.address ?? undefined}
      />
      <ProjectTabs projectId={id} active="overview" />
      <JobDesk project={project} desk={desk} />
    </div>
  );
}
