import { NewTaskForm, TaskList } from "@/components/task-list";
import { ProjectTabs } from "@/components/project-tabs";
import { PageHeader } from "@/components/ui";
import { getAuthorizedProject } from "@/lib/projects";

export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getAuthorizedProject(id);

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
