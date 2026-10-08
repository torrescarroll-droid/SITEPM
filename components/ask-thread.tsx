"use client";

import { useActionState } from "react";
import { Card, DemoNote } from "@/components/ui";
import {
  askComposerKeyIntent,
  shouldSubmitAskQuestion,
} from "@/lib/ask-composer";
import { INSUFFICIENT_EVIDENCE_EXPLAINED, PDF_ASK_EXPECTATION } from "@/lib/beta-copy";
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
      <h2 className="section-title">
        Ask LINEHORSE
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        Questions stay on {projectName}. LINEHORSE uses this job&apos;s records
        only — not a generic chatbot and not other jobs.
      </p>
      <div className="mt-3">
        <DemoNote>
          {PDF_ASK_EXPECTATION} {INSUFFICIENT_EVIDENCE_EXPLAINED}
        </DemoNote>
      </div>
      <form
        action={action}
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          const question = String(
            new FormData(event.currentTarget).get("question") ?? "",
          );
          if (!shouldSubmitAskQuestion(question, pending)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="project_id" value={projectId} />
        <label className="block text-sm font-medium" htmlFor="ask-question">
          Question
          <textarea
            id="ask-question"
            name="question"
            required
            rows={4}
            placeholder="Ask about this job…"
            className="mt-1 min-h-24 w-full resize-y rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
            onKeyDown={(event) => {
              if (askComposerKeyIntent(event.key, event.shiftKey) !== "submit") {
                return;
              }
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }}
          />
        </label>
        {state.error ? (
          <p className="text-sm text-danger">{state.error}</p>
        ) : null}
        {state.answer ? (
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
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
            {state.inventory.tasks} to-dos, {state.inventory.fieldLogs} daily
            reports, {state.inventory.scheduleActivities} schedule activities,{" "}
            {state.inventory.documents} ready documents,{" "}
            {state.inventory.documentChunks} document excerpts.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="control min-h-11 w-full rounded-lg bg-shell text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Asking…" : "Ask LINEHORSE"}
        </button>
      </form>
    </Card>
  );
}
