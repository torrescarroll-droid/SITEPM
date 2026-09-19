import { notFound } from "next/navigation";
import type { ProjectStatus } from "@/lib/demo-data";
import { requireCompanyContext } from "@/lib/auth-context";

export type ProjectRecord = {
  id: string;
  company_id: string;
  name: string;
  client_name: string | null;
  address: string | null;
  status: ProjectStatus;
  start_date: string | null;
  target_completion_date: string | null;
  description: string | null;
};

function asProjectStatus(value: string | null): ProjectStatus {
  if (value === "on_hold" || value === "complete" || value === "active") {
    return value;
  }
  return "active";
}

function mapProject(row: {
  id: string;
  company_id: string;
  name: string;
  client_name: string | null;
  address: string | null;
  status: string | null;
  start_date: string | null;
  target_completion_date: string | null;
  description: string | null;
}): ProjectRecord {
  return {
    ...row,
    status: asProjectStatus(row.status),
  };
}

export { formatProjectDate } from "@/lib/format-date";

export async function listCompanyProjects() {
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return [];
  }
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, company_id, name, client_name, address, status, start_date, target_completion_date, description",
    )
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapProject);
}

export async function findAuthorizedProject(id: string) {
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return null;
  }
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, company_id, name, client_name, address, status, start_date, target_completion_date, description",
    )
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapProject(data);
}

export async function getAuthorizedProject(id: string) {
  const project = await findAuthorizedProject(id);
  if (!project) {
    notFound();
  }
  return project;
}
