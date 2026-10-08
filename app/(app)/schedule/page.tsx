import { PageHeader } from "@/components/ui";
import { ScheduleBoard } from "@/components/schedule-board";
import { listCompanyProjects } from "@/lib/projects";
import {
  listCompanyScheduleActivities,
  listScheduleResources,
  listScheduleHistory,
} from "@/lib/schedule";
import { requireCompanyContext } from "@/lib/auth-context";
export default async function CompanySchedulePage() {
  const { supabase, profile, user } = await requireCompanyContext();
  const [projects, activities, resources, history, tasks] = await Promise.all([
    listCompanyProjects(),
    listCompanyScheduleActivities(),
    listScheduleResources(),
    listScheduleHistory(),
    supabase
      .from("tasks")
      .select("id,project_id,title")
      .eq("company_id", profile!.company_id),
  ]);
  if (tasks.error) throw new Error("Source to-dos could not load.");
  return (
    <>
      <PageHeader
        kicker="Company schedule"
        title="Construction schedule"
        description="Who is expected, where, and when. Coordinate every job from one working calendar."
      />
      <ScheduleBoard
        activities={activities}
        resources={resources}
        projects={projects}
        history={history}
        tasks={tasks.data ?? []}
        scope={`${profile?.company_id}:${user.id}`}
      />
    </>
  );
}
