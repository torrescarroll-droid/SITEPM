import Link from "next/link";
import { projects } from "@/lib/demo-data";
import { Card, StatusPill } from "@/components/ui";

export default function ProjectsPage() {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-stone-500 uppercase">
            Projects
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-950 md:text-3xl">
            Jobs
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600 md:text-base">
            Open a project to see overview, documents, field logs, tasks, and Ask
            SITEPM.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-stone-900 px-4 text-sm font-medium text-white"
        >
          Create project
        </Link>
      </div>
      <div className="grid gap-3">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card className="hover:border-stone-300">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-medium">{project.name}</p>
                  <p className="mt-1 text-sm text-stone-600">{project.clientName}</p>
                  <p className="text-sm text-stone-500">{project.address}</p>
                </div>
                <StatusPill status={project.status} />
              </div>
              <p className="mt-3 text-sm text-stone-500">
                {project.startDate} → {project.targetCompletionDate}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
