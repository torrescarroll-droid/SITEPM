export const SCHEDULE_STATUSES = [
  "not_started",
  "confirmed",
  "delayed",
  "cancelled",
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
  revision?: number;
  activity_type?: string;
  all_day?: boolean;
  start_time?: string | null;
  finish_time?: string | null;
  timezone?: string;
  start_at?: string | null;
  finish_at?: string | null;
  source_task_id?: string | null;
  assignments?: ResourceAssignment[];
  predecessor_ids?: string[];
  predecessor_id: string | null;
  predecessor_name: string | null;
};

export function isScheduleStatus(value: string): value is ScheduleStatus {
  return (SCHEDULE_STATUSES as readonly string[]).includes(value);
}

export function scheduleStatusLabel(status: ScheduleStatus) {
  if (status === "not_started") return "Planned";
  if (status === "in_progress") return "In progress";
  if (status === "done") return "Completed";
  if (status === "confirmed") return "Confirmed";
  if (status === "delayed") return "Delayed";
  if (status === "cancelled") return "Cancelled";
  return "On hold";
}

export const RESOURCE_TYPES = [
  "employee",
  "subcontractor_company",
  "subcontractor",
  "crew",
  "supplier",
  "external",
] as const;
export const ACTIVITY_TYPES = [
  "work",
  "inspection",
  "delivery",
  "equipment",
  "milestone",
] as const;
export type ScheduleResource = {
  id: string;
  company_id: string;
  name: string;
  company_name: string | null;
  trade_name: string | null;
  resource_type: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  revision: number;
};
export type ResourceAssignment = {
  resource_id: string;
  expected_workers: number | null;
};
export type ScheduleHistory = {
  id: number;
  activity_id: string;
  actor_id: string | null;
  actor_name?: string | null;
  occurred_at: string;
  change_type: string;
  before_record: Record<string, unknown> | null;
  after_record: Record<string, unknown> | null;
};
