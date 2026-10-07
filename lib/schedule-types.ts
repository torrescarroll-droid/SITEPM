export const SCHEDULE_STATUSES = [
  "not_started",
  "in_progress",
  "done",
  "held",
] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export type ScheduleActivity = {
  id: string;
  company_id: string;
  project_id: string;
  name: string;
  notes: string | null;
  start_date: string | null;
  finish_date: string | null;
  status: ScheduleStatus;
  trade_name: string | null;
  is_milestone: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  predecessor_id: string | null;
  predecessor_name: string | null;
};

export function isScheduleStatus(value: string): value is ScheduleStatus {
  return (SCHEDULE_STATUSES as readonly string[]).includes(value);
}

export function scheduleStatusLabel(status: ScheduleStatus) {
  if (status === "not_started") return "Not started";
  if (status === "in_progress") return "In progress";
  if (status === "done") return "Done";
  return "Held";
}
