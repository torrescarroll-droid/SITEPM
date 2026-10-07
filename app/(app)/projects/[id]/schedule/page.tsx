import { ProjectTabs } from "@/components/project-tabs";
import { ScheduleBoard } from "@/components/schedule-board";
import { PageHeader } from "@/components/ui";
import { getAuthorizedProject } from "@/lib/projects";
import { listProjectScheduleActivities } from "@/lib/schedule";

export default async function ProjectSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getAuthorizedProject(id);
  const activities = await listProjectScheduleActivities(id);

  return (
    <div>
      <PageHeader
        kicker="Schedule"
        title={project.name}
        description="Activities, dates, trades, and what has to finish first."
      />
      <ProjectTabs projectId={id} active="schedule" />
      <ScheduleBoard projectId={id} activities={activities} />
    </div>
  );
}
