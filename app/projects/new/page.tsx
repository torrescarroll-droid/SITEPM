import Link from "next/link";
import { DemoNote, PageHeader } from "@/components/ui";

export default function NewProjectPage() {
  return (
    <div className="max-w-xl">
      <PageHeader
        kicker="Projects"
        title="Create project"
        description="Demo form only. Nothing is saved until the database is connected."
      />
      <DemoNote>Week 2 shell — create/edit will persist in Week 5.</DemoNote>
      <form className="mt-4 space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
        <label className="block text-sm font-medium">
          Project name
          <input
            disabled
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
            placeholder="184 Willow Ave Remodel"
          />
        </label>
        <label className="block text-sm font-medium">
          Client
          <input
            disabled
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
            placeholder="Client name"
          />
        </label>
        <label className="block text-sm font-medium">
          Address
          <input
            disabled
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
            placeholder="Jobsite address"
          />
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            disabled
            className="min-h-11 rounded-xl bg-stone-900 px-4 text-sm font-medium text-white opacity-60"
          >
            Save project
          </button>
          <Link
            href="/projects"
            className="inline-flex min-h-11 items-center text-sm font-medium text-stone-600"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
