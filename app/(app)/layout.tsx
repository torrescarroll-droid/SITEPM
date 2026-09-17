import { AppShell } from "@/components/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userName = user?.email ?? "Signed in";
  let companyName = "SITEPM";
  let roleLabel = "Owner";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, role, company_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profile?.full_name) userName = profile.full_name;
    else if (profile?.email) userName = profile.email;

    if (profile?.role) {
      roleLabel = profile.role.replaceAll("_", " ");
    }

    if (profile?.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", profile.company_id)
        .maybeSingle();
      if (company?.name) companyName = company.name;
    }
  }

  return (
    <AppShell userName={userName} companyName={companyName} roleLabel={roleLabel}>
      {children}
    </AppShell>
  );
}
