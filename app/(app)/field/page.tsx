import { FieldLogList, NewFieldLogForm } from "@/components/field-log";
import { PageHeader } from "@/components/ui";
import { listCompanyFieldLogs } from "@/lib/field-logs";
import { listCompanyProjects } from "@/lib/projects";

export default async function FieldPage() {
  const [projects, logs] = await Promise.all([
    listCompanyProjects(),
    listCompanyFieldLogs(),
  ]);
  const projectNames = Object.fromEntries(
    projects.map((project) => [project.id, project.name]),
  );

  return (
    <div>
      <PageHeader
        kicker="Daily Reports"
        title="Daily reports"
        description="Record the day on a job. Reports stay with your company."
      />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <NewFieldLogForm
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
          }))}
        />
        <div>
          <h2 className="mb-3 section-title">
            Recent
          </h2>
          <FieldLogList logs={logs} projectNames={projectNames} showProject />
        </div>
      </div>
    </div>
  );
}
