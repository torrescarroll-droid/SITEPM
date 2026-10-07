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
        kicker="To-Dos"
        title="To-dos"
        description="Simple actions on jobs in your company. A to-do is not an RFI, submittal, or inspection."
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
