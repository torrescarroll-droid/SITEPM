import { ProjectDocumentLinks } from "@/components/project-document-links";
import { ProjectTabs } from "@/components/project-tabs";
import { ScheduleBoard } from "@/components/schedule-board";
import { PageHeader } from "@/components/ui";
import { getAuthorizedProject } from "@/lib/projects";
import {
  listCompanyScheduleActivities,
  listScheduleResources,
  listScheduleHistory,
} from "@/lib/schedule";
import { requireCompanyContext } from "@/lib/auth-context";
export default async function ProjectSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getAuthorizedProject(id);
  const { supabase, profile, user } = await requireCompanyContext();
  const [activities, resources, history, tasks] = await Promise.all([
    listCompanyScheduleActivities(),
    listScheduleResources(),
    listScheduleHistory(id),
    supabase
      .from("tasks")
      .select("id,project_id,title")
      .eq("company_id", profile!.company_id)
      .eq("project_id", id),
  ]);
  if (tasks.error) throw new Error("Source to-dos could not load.");
  return (
    <>
      <PageHeader
        kicker="Project schedule"
        title={project.name}
        description="Plan work, inspections, deliveries and expected crews."
      />
      <ProjectTabs projectId={id} active="schedule" />
      <ScheduleBoard
        projectId={id}
        activities={activities}
        resources={resources}
        projects={[project]}
        history={history}
        tasks={tasks.data ?? []}
        scope={`${profile?.company_id}:${user.id}`}
      />
      <ProjectDocumentLinks projectId={id} kind="activity" />
    </>
  );
}
