import { NewTaskForm, TaskList } from "@/components/task-list";
import { PageHeader } from "@/components/ui";

export default function TasksPage() {
  return (
    <div>
      <PageHeader
        kicker="Tasks"
        title="Follow-ups"
        description="Overdue items and AI-suggested work. Human approval is still required."
      />
      <div className="mb-4">
        <NewTaskForm />
      </div>
      <TaskList />
    </div>
  );
}
