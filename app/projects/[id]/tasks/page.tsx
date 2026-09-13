import { notFound } from "next/navigation";
import { NewTaskForm, TaskList } from "@/components/task-list";
import { ProjectTabs } from "@/components/project-tabs";
import { PageHeader } from "@/components/ui";
import { getProject } from "@/lib/demo-data";

export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();

  return (
    <div>
      <PageHeader kicker="Tasks" title={project.name} />
      <ProjectTabs projectId={id} active="tasks" />
      <div className="mb-4">
        <NewTaskForm projectId={id} />
      </div>
      <TaskList projectId={id} />
    </div>
  );
}
