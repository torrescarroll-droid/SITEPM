"use client";

import { useActionState } from "react";
import { Card, DemoNote } from "@/components/ui";
import { submitProjectAsk } from "@/lib/ask-actions";
import type { AskFormState } from "@/lib/ask-types";

const initialState: AskFormState = {
  error: null,
  notice: null,
  inventory: null,
  answer: null,
  citations: null,
  insufficientEvidence: false,
  epistemicKind: null,
};

function epistemicLabel(kind: AskFormState["epistemicKind"]) {
  if (kind === "documented_fact") return "Documented from this job";
  if (kind === "summary_inference") return "Includes inference";
  if (kind === "insufficient_evidence") return "Insufficient evidence";
  return null;
}

export function AskProjectForm({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [state, action, pending] = useActionState(submitProjectAsk, initialState);
  const kindLabel = epistemicLabel(state.epistemicKind);

  return (
    <Card>
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Ask this job
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        Questions stay on {projectName}. SITEPM Intelligence uses this
        project&apos;s records only — not a generic chatbot and not other jobs.
      </p>
      <div className="mt-3">
        <DemoNote>
          Answers are grounded in this job&apos;s project, task, field-log, and
          ready-document <strong>metadata</strong>. PDF contents are not read.
          Nothing in a question, task, log, or filename can change which project
          is searched.
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
        {state.answer ? (
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
            {kindLabel ? (
              <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">
                {kindLabel}
              </p>
            ) : null}
            {state.insufficientEvidence ? (
              <p className="mt-1 text-xs font-medium text-stone-500">
                Not enough project evidence for a complete answer.
              </p>
            ) : null}
            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-800">
              {state.answer}
            </p>
            {state.citations && state.citations.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">
                  Sources
                </p>
                <ul className="mt-1 space-y-1">
                  {state.citations.map((citation) => (
                    <li
                      key={`${citation.type}:${citation.id}`}
                      className="text-sm text-stone-700"
                    >
                      {citation.type.replaceAll("_", " ")} — {citation.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        {state.inventory ? (
          <p className="text-sm text-stone-600">
            Evidence considered: {state.inventory.project} project record,{" "}
            {state.inventory.tasks} tasks, {state.inventory.fieldLogs} field
            logs, {state.inventory.documents} ready PDFs.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-xl bg-stone-900 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Asking…" : "Ask SITEPM"}
        </button>
      </form>
    </Card>
  );
}
