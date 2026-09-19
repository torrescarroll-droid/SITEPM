import type { TaskPriority, TaskStatus } from "@/lib/demo-data";

export type TaskRecord = {
  id: string;
  company_id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  priority: TaskPriority | null;
  status: TaskStatus;
  ai_suggested: boolean;
  created_at: string;
  completed_at: string | null;
};

export function taskIsOverdue(task: TaskRecord) {
  if (task.status === "done" || !task.due_date) return false;
  const due = new Date(`${task.due_date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}
