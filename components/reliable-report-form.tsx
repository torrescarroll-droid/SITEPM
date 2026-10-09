"use client";

import { useActionState, useEffect, useRef, useState, startTransition, type ReactNode } from "react";
import Link from "next/link";
import { createFieldLog, updateFieldLog, type FieldLogFormState } from "@/lib/field-log-actions";

type Draft = { requestId: string; revision?: number; fields: [string, string][]; submitted: boolean };
const initial: FieldLogFormState = { error: null, reportId: null };

/** Session-local recovery, scoped to the authenticated user and report. Never stores photos. */
export function ReliableReportForm({ scope, projectId, reportId, revision, children, onSaved }: {
  scope: string; projectId?: string; reportId?: string; revision?: number;
  children: ReactNode; onSaved?: (state: FieldLogFormState) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const locked = useRef(false);
  const draft = useRef<Draft | null>(null);
  const [ready, setReady] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const key = `sitepm-report-v1:${scope}:${reportId ?? projectId ?? "company-new"}`;
  const persist = () => {
    try { sessionStorage.setItem(key, JSON.stringify(draft.current)); }
    catch { setStorageWarning(true); }
  };
  const [state, action, pending] = useActionState(async (previous: FieldLogFormState, data: FormData) => {
    let result: FieldLogFormState;
    try { result = await (reportId ? updateFieldLog : createFieldLog)(previous, data); }
    catch { result = { error: "Connection interrupted. Retry this submission to confirm the save safely.", reportId: null, uncertain: true }; }
    locked.current = false;
    setUncertain(Boolean(result.uncertain));
    if (result.error && !result.uncertain && draft.current) { draft.current.submitted = false; persist(); }
    if (!result.error && result.reportId) {
      setSaved(true); setDirty(false); setRecovered(false);
      if (draft.current) { draft.current.revision = result.revision; draft.current.submitted = false; }
      try { sessionStorage.removeItem(key); } catch { setStorageWarning(true); }
      onSaved?.(result);
    }
    return result;
  }, initial);

  useEffect(() => {
    const current = form.current;
    if (!current) return;
    let stored: Draft | null = null;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const value = JSON.parse(raw);
        if (typeof value.requestId === "string" && Array.isArray(value.fields) && value.fields.every((entry: unknown) => Array.isArray(entry) && entry.length === 2 && entry.every(item => typeof item === "string"))) stored = value;
      }
    } catch { /* A blocked store cannot prevent saving. */ }
    draft.current = stored ?? { requestId: crypto.randomUUID(), revision, fields: [], submitted: false };
    if (stored) {
      const positions = new Map<string, number>();
      for (const element of Array.from(current.elements)) {
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) || !element.name || element.type === "hidden") continue;
        const values = stored.fields.filter(([name]) => name === element.name).map(([,value]) => value);
        const index = positions.get(element.name) ?? 0;
        if (element instanceof HTMLInputElement && element.type === "checkbox") element.checked = values.includes("on");
        else if (values[index] !== undefined) element.value = values[index];
        positions.set(element.name, index + 1);
      }
      setRecovered(true); setDirty(true); setUncertain(stored.submitted);
    }
    setReady(true);
    // A mounted editor keeps its opening revision until a confirmed save; new server props must not silently rebase a draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function capture() {
    if (!form.current || !draft.current) return;
    draft.current.fields = [...new FormData(form.current)].filter((entry): entry is [string, string] => typeof entry[1] === "string");
    persist();
  }

  return (
    <form ref={form} className="mt-3 space-y-3" onChange={() => {
      if (!draft.current || locked.current || uncertain) return;
      draft.current.requestId = crypto.randomUUID(); draft.current.submitted = false;
      setDirty(true); setSaved(false); capture();
    }} onSubmit={event => {
      event.preventDefault();
      if (!ready || locked.current || !draft.current || (saved && !dirty)) return;
      if (!uncertain) capture();
      const data = new FormData(form.current!);
      // Use the exact captured payload after an uncertain result, including checkbox absence.
      if (uncertain) {
        for (const name of new Set([...data.keys()])) if (!name.startsWith("$ACTION_")) data.delete(name);
        for (const [name,value] of draft.current.fields) data.append(name,value);
      }
      data.set("request_id", draft.current.requestId);
      if (reportId) data.set("expected_revision", String(draft.current.revision ?? ""));
      draft.current.submitted = true; persist(); locked.current = true;
      startTransition(() => action(data));
    }}>
      {projectId ? <input type="hidden" name="project_id" value={projectId} /> : null}
      {reportId ? <input type="hidden" name="field_log_id" value={reportId} /> : null}
      <fieldset disabled={pending || uncertain || (saved && !reportId)} className="space-y-3 disabled:opacity-70">{children}</fieldset>
      {recovered ? <p role="status" className="text-sm text-stone-600">Recovered this tab&apos;s draft. {uncertain ? "Retry to confirm the interrupted save before editing." : "Review it before saving."}</p> : null}
      {storageWarning ? <p role="status" className="text-sm text-attention">Browser draft storage is unavailable. Keep this page open until the save is confirmed.</p> : null}
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      {state.error && !uncertain ? <button type="button" className="min-h-11 text-sm underline" onClick={() => {
        if (!window.confirm("Discard this tab’s report draft and reload the latest saved information? Copy any notes you need first.")) return;
        try { sessionStorage.removeItem(key); } catch { /* Reload remains available. */ }
        window.location.reload();
      }}>Discard draft and reload latest</button> : null}
      {uncertain ? <p role="status" className="text-sm text-attention">Save not confirmed. Retry the same submission before changing it.</p> : null}
      {saved && !dirty && state.reportId ? <p role="status" className="text-sm text-stone-700">Report and crew saved. <Link className="underline" href={`/projects/${state.projectId}/field/${state.reportId}`}>Open saved report</Link></p> : null}
      <button type="submit" disabled={!ready || pending || (saved && !dirty)} className="control min-h-11 w-full rounded-lg button-primary text-sm font-medium text-white disabled:opacity-60">{pending ? "Saving report and crew…" : uncertain ? "Retry and confirm save" : reportId ? "Update report" : "Save daily report"}</button>
      <p className="text-xs text-stone-500">Keep this tab open while saving. Logging out clears this tab’s drafts. Photos are added separately after the report is confirmed.</p>
    </form>
  );
}
