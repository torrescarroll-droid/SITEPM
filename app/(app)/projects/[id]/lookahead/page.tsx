import { OperationalLookaheadView } from "@/components/operational-lookahead";
import { ProjectTabs } from "@/components/project-tabs";
import { PageHeader } from "@/components/ui";
import { listProjectFieldLogs } from "@/lib/field-logs";
import { buildOperationalLookahead } from "@/lib/operational-lookahead";
import { listProjectPhotos } from "@/lib/photos";
import { getAuthorizedProject } from "@/lib/projects";
import { listProjectScheduleActivities } from "@/lib/schedule";
import { listProjectTasks } from "@/lib/tasks";

export default async function LookaheadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getAuthorizedProject(id);
  const [tasks, reports, activities, photos] = await Promise.all([
    listProjectTasks(id), listProjectFieldLogs(id), listProjectScheduleActivities(id), listProjectPhotos(id),
  ]);
  const view = buildOperationalLookahead({ companyId: project.company_id, projectId: id, tasks, reports, activities, photos });
  return (
    <div>
      <PageHeader kicker="Two-week lookahead" title={project.name} description="Plan the next trades. Follow through on what happened on site." />
      <ProjectTabs projectId={id} active="lookahead" />
      <OperationalLookaheadView projectId={id} view={view} />
    </div>
  );
}
