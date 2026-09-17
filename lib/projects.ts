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

export function formatProjectDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

export async function getAuthorizedProject(id: string) {
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    notFound();
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
    notFound();
  }

  return mapProject(data);
}
