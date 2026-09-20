export type FieldLogRecord = {
  id: string;
  company_id: string;
  project_id: string;
  created_by: string | null;
  created_by_name: string | null;
  log_date: string;
  notes: string | null;
  issue_flag: boolean;
  created_at: string;
};
