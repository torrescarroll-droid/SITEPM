"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCompanyContext } from "@/lib/auth-context";

export type ProjectFormState = {
  error: string | null;
};

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Project name is required." };
  }

  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) {
    return {
      error:
        "Your company profile is not ready yet. Confirm the signup trigger created a profile, then try again.",
    };
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      company_id: profile.company_id,
      name,
      client_name: emptyToNull(String(formData.get("client_name") ?? "")),
      address: emptyToNull(String(formData.get("address") ?? "")),
      description: emptyToNull(String(formData.get("description") ?? "")),
      start_date: emptyToNull(String(formData.get("start_date") ?? "")),
      target_completion_date: emptyToNull(
        String(formData.get("target_completion_date") ?? ""),
      ),
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not save the project." };
  }

  revalidatePath("/projects");
  revalidatePath("/");
  redirect(`/projects/${data.id}`);
}
