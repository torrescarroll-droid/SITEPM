import { NewTaskForm, TaskList } from "@/components/task-list";
import { PageHeader } from "@/components/ui";
import { listCompanyProjects } from "@/lib/projects";
import { listCompanyTasks } from "@/lib/tasks";

export default async function TasksPage() {
  const [projects, tasks] = await Promise.all([
    listCompanyProjects(),
    listCompanyTasks(),
  ]);
  const projectNames = Object.fromEntries(
    projects.map((project) => [project.id, project.name]),
  );

  return (
    <div>
      <PageHeader
        kicker="Tasks"
        title="Follow-ups"
        description="Open and overdue work for jobs in your company."
      />
      <div className="mb-4">
        <NewTaskForm
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
          }))}
        />
      </div>
      <TaskList tasks={tasks} projectNames={projectNames} showProject />
    </div>
  );
}
