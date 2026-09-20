import Link from "next/link";
import { Card, PageHeader, StatusPill } from "@/components/ui";
import { listCompanyProjects } from "@/lib/projects";

export default async function AskPage() {
  const projects = await listCompanyProjects();

  return (
    <div>
      <PageHeader
        kicker="Ask SITEPM"
        title="Choose a job"
        description="Ask is always scoped to one project. Pick a job you can open. SITEPM authorizes that project again on the next screen."
      />
      {projects.length === 0 ? (
        <Card>
          <p className="font-medium">No jobs yet</p>
          <p className="mt-1 text-sm text-stone-600">
            Create a project first. Ask cannot run across the whole company at
            once.
          </p>
          <Link
            href="/projects/new"
            className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-stone-950"
          >
            Create project
          </Link>
        </Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}/ask`}>
              <Card className="hover:border-stone-300">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-medium">{project.name}</p>
                    <p className="mt-1 text-sm text-stone-600">
                      {project.client_name ?? "No client listed"}
                    </p>
                  </div>
                  <StatusPill status={project.status} />
                </div>
                <p className="mt-3 text-sm font-medium text-stone-950">
                  Open Ask for this job
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
