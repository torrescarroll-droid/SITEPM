import Link from "next/link";
import { Card, StatusPill, PageHeader } from "@/components/ui";
import { formatProjectDate, listCompanyProjects } from "@/lib/projects";

export default async function ProjectsPage() {
  const projects = await listCompanyProjects();

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          kicker="Projects"
          title="Jobs"
          description="Your project records, schedules, daily reports, to-dos, and source documents."
        />
        <Link href="/projects/new" className="button-primary shrink-0">
          Create job
        </Link>
      </div>
      {projects.length === 0 ? (
        <Card>
          <p className="font-medium">No jobs yet</p>
          <p className="mt-1 text-sm text-stone-600">
            Create a job to start the record. It is stored for your company
            only.
          </p>
        </Card>
      ) : (
        <div className="record-stack jobs-records">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="job-row">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-medium">{project.name}</p>
                    <p className="mt-1 text-sm text-stone-600">
                      {project.client_name ?? "No client listed"}
                    </p>
                    <p className="text-sm text-stone-500">
                      {project.address ?? "No address listed"}
                    </p>
                  </div>
                  <StatusPill status={project.status} />
                </div>
                <p className="mt-3 text-sm text-stone-500">
                  {formatProjectDate(project.start_date)} →{" "}
                  {formatProjectDate(project.target_completion_date)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
