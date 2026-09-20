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
        kicker="Field"
        title="Field logs"
        description="Keep this short in the field. Logs are stored for your company only."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <NewFieldLogForm
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
          }))}
        />
        <div>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-stone-500 uppercase">
            Recent
          </h2>
          <FieldLogList logs={logs} projectNames={projectNames} showProject />
        </div>
      </div>
    </div>
  );
}
