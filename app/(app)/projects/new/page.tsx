"use client";

import { useActionState } from "react";
import Link from "next/link";
import { DemoNote, PageHeader } from "@/components/ui";
import { createProject, type ProjectFormState } from "@/lib/project-actions";

const initialState: ProjectFormState = { error: null };

export default function NewProjectPage() {
  const [state, action, pending] = useActionState(createProject, initialState);

  return (
    <div className="max-w-xl">
      <PageHeader
        kicker="Projects"
        title="Create project"
        description="Saved to your company in SITEPM. Other companies cannot see this job."
      />
      <DemoNote>
        Company is taken from your signed-in profile, not from this form.
      </DemoNote>
      <form action={action} className="mt-4 space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
        <label className="block text-sm font-medium">
          Project name
          <input
            name="name"
            required
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
            placeholder="184 Willow Ave Remodel"
          />
        </label>
        <label className="block text-sm font-medium">
          Client
          <input
            name="client_name"
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
            placeholder="Client name"
          />
        </label>
        <label className="block text-sm font-medium">
          Address
          <input
            name="address"
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
            placeholder="Jobsite address"
          />
        </label>
        <label className="block text-sm font-medium">
          Description
          <textarea
            name="description"
            rows={3}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium">
          Start date
          <input
            name="start_date"
            type="date"
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
          />
        </label>
        <label className="block text-sm font-medium">
          Target completion
          <input
            name="target_completion_date"
            type="date"
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
          />
        </label>
        {state.error ? (
          <p className="text-sm text-orange-800">{state.error}</p>
        ) : null}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-xl bg-stone-900 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save project"}
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
