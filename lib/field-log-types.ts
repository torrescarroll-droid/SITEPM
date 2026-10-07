export type FieldLogCrew = {
  id: string;
  field_log_id: string;
  company_name: string | null;
  trade_name: string;
  worker_count: number | null;
};

export type FieldLogRecord = {
  id: string;
  company_id: string;
  project_id: string;
  created_by: string | null;
  created_by_name: string | null;
  log_date: string;
  notes: string | null;
  work_performed?: string | null;
  deliveries?: string | null;
  equipment?: string | null;
  delays?: string | null;
  site_events?: string | null;
  safety_notes?: string | null;
  tomorrow?: string | null;
  location_text?: string | null;
  issue_flag: boolean;
  created_at: string;
  crews?: FieldLogCrew[];
};
