import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { formatProjectDate } from "@/lib/format-date";
import { listCompanyProjects } from "@/lib/projects";
import { listCompanyScheduleActivities } from "@/lib/schedule";
import { activityIsLate, localTodayIso } from "@/lib/schedule-logic";
import { scheduleStatusLabel } from "@/lib/schedule-types";

export default async function CompanySchedulePage() {
  const [projects, activities] = await Promise.all([
    listCompanyProjects(),
    listCompanyScheduleActivities(),
  ]);
  const projectNames = Object.fromEntries(
    projects.map((project) => [project.id, project.name]),
  );
  const today = localTodayIso();

  return (
    <div>
      <PageHeader
        kicker="Schedule"
        title="Job schedules"
        description="Open a job to add activities. Dates here come from those records."
      />
      {activities.length === 0 ? (
        <Card>
          <p className="font-medium">No schedule activities yet</p>
          <p className="mt-1 text-sm text-stone-600">
            A schedule file in Plans & Docs is not the schedule. Add activities on the job.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {activities.map((activity) => (
            <li key={activity.id}>
              <Card>
                <p className="text-sm text-stone-500">
                  {projectNames[activity.project_id] ?? "Job"}
                </p>
                <p className="mt-1 font-medium">{activity.name}</p>
                <p className="mt-1 text-sm text-stone-600">
                  {scheduleStatusLabel(activity.status)}
                  {activity.trade_name ? ` · ${activity.trade_name}` : ""}
                  {activityIsLate(activity, today) ? " · Late" : ""}
                  {activity.is_milestone ? " · Milestone" : ""}
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  {activity.start_date ? formatProjectDate(activity.start_date) : "No start"}
                  {" – "}
                  {activity.finish_date ? formatProjectDate(activity.finish_date) : "No finish"}
                </p>
                <Link
                  href={`/projects/${activity.project_id}/schedule`}
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-medium"
                >
                  Open job schedule
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
