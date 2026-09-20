"use client";

import { useActionState } from "react";
import { Card, DemoNote } from "@/components/ui";
import { submitProjectAsk } from "@/lib/ask-actions";
import type { AskFormState } from "@/lib/ask-types";

const initialState: AskFormState = { error: null, notice: null, inventory: null };

export function AskProjectForm({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [state, action, pending] = useActionState(submitProjectAsk, initialState);

  return (
    <Card>
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Ask this job
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        Questions stay on {projectName}. SITEPM Intelligence will use this
        project&apos;s records only — not a generic chatbot and not other jobs.
      </p>
      <div className="mt-3">
        <DemoNote>
          No model is called. SITEPM loads this job&apos;s records only. Nothing
          in a question, task, log, or filename can change which project is
          searched.
        </DemoNote>
      </div>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="project_id" value={projectId} />
        <label className="block text-sm font-medium" htmlFor="ask-question">
          Question
          <textarea
            id="ask-question"
            name="question"
            required
            rows={4}
            placeholder="Ask about this project…"
            className="mt-1 min-h-24 w-full resize-y rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        {state.error ? (
          <p className="text-sm text-orange-800">{state.error}</p>
        ) : null}
        {state.notice ? (
          <p className="text-sm text-stone-800">{state.notice}</p>
        ) : null}
        {state.inventory ? (
          <p className="text-sm text-stone-600">
            Evidence on this job (not an AI answer): {state.inventory.project}{" "}
            project record, {state.inventory.tasks} tasks,{" "}
            {state.inventory.fieldLogs} field logs, {state.inventory.documents}{" "}
            ready PDFs.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-xl bg-stone-900 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Checking…" : "Ask SITEPM"}
        </button>
      </form>
    </Card>
  );
}
