import { PageHeader } from "@/components/ui";
import { ResourceDirectory } from "@/components/resource-directory";
import { listScheduleResources } from "@/lib/schedule";
import { requireCompanyContext } from "@/lib/auth-context";
export default async function ResourcesPage() {
  const { profile, user } = await requireCompanyContext();
  const resources = await listScheduleResources();
  return (
    <>
      <PageHeader
        kicker="Workforce & trade partners"
        title="Resource directory"
        description="Maintain company resources once. Coordinate expected work across jobs."
      />
      <ResourceDirectory
        resources={resources}
        scope={`${profile?.company_id}:${user.id}`}
      />
    </>
  );
}
