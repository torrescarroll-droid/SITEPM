import { FieldLogList, NewFieldLogForm } from "@/components/field-log";
import { PageHeader } from "@/components/ui";

export default function FieldPage() {
  return (
    <div>
      <PageHeader
        kicker="Field"
        title="Field logs"
        description="Keep this short in the field. Demo entries from the last two days."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <NewFieldLogForm />
        <div>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-stone-500 uppercase">
            Recent
          </h2>
          <FieldLogList />
        </div>
      </div>
    </div>
  );
}
