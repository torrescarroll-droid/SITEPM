"use client";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  saveScheduleRecord,
  type ScheduleFormState,
} from "@/lib/schedule-actions";
type RecordData = Record<string, unknown>;
type Draft = {
  request: string;
  record: RecordData;
  fields: [string, string][];
  submitted: boolean;
};
export function ScheduleRecordForm({
  kind,
  scope,
  initial,
  children,
  onSaved,
}: {
  kind: "activity" | "resource";
  scope: string;
  initial: RecordData;
  children: ReactNode;
  onSaved: () => void;
}) {
  const router = useRouter(),
    form = useRef<HTMLFormElement>(null),
    locked = useRef(false),
    draft = useRef<Draft | null>(null);
  const [ready, setReady] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [recovered, setRecovered] = useState(false),
    [warning, setWarning] = useState(false);
  const key = `sitepm-report-v1:${scope}:schedule:${kind}:${initial.id ?? "new"}:${initial.project_id ?? "company"}`;
  function persist() {
    try {
      sessionStorage.setItem(key, JSON.stringify(draft.current));
    } catch {
      setWarning(true);
    }
  }
  const [state, action, pending] = useActionState(
    async (previous: ScheduleFormState, data: FormData) => {
      const result = await saveScheduleRecord(previous, data);
      locked.current = false;
      setUncertain(Boolean(result.uncertain));
      if (result.error) {
        if (draft.current && !result.uncertain) {
          draft.current.submitted = false;
          persist();
        }
      } else {
        try {
          sessionStorage.removeItem(key);
        } catch {}
        setRecovered(false);
        router.refresh();
        onSaved();
      }
      return result;
    },
    { error: null } as ScheduleFormState,
  );
  useEffect(() => {
    let stored: Draft | null = null;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw);
        if (
          typeof d.request === "string" &&
          d.record &&
          Array.isArray(d.fields) &&
          d.fields.every(
            (e: unknown) =>
              Array.isArray(e) &&
              e.length === 2 &&
              e.every((v) => typeof v === "string"),
          )
        )
          stored = d;
      }
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate tab-local recovery state from external browser storage.
      setWarning(true);
    }
    draft.current = stored ?? {
      request: crypto.randomUUID(),
      record: { ...initial, id: initial.id ?? crypto.randomUUID() },
      fields: [],
      submitted: false,
    };
    if (stored && form.current) {
      for (const e of Array.from(form.current.elements)) {
        if (
          !(
            e instanceof HTMLInputElement ||
            e instanceof HTMLSelectElement ||
            e instanceof HTMLTextAreaElement
          ) ||
          !e.name
        )
          continue;
        const values = stored.fields
          .filter(([n]) => n === e.name)
          .map(([, v]) => v);
        if (e instanceof HTMLInputElement && e.type === "checkbox")
          e.checked = values.includes(e.value);
        else if (values[0] !== undefined) e.value = values[0];
      }
      setRecovered(true);
      setUncertain(stored.submitted);
    }
    setReady(true);
    // Keep the opening revision during server refresh; do not silently rebase edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  function capture() {
    if (!form.current || !draft.current) return;
    draft.current.fields = [...new FormData(form.current)].filter(
      (e): e is [string, string] => typeof e[1] === "string",
    );
    persist();
  }
  function submit() {
    if (!ready || locked.current || !draft.current) return;
    if (!uncertain) {
      capture();
      const f = new FormData(form.current!);
      const get = (n: string) => String(f.get(n) ?? "");
      const record: RecordData = {
        ...draft.current.record,
        name: get("name").trim(),
        notes: get("notes"),
      };
      if (kind === "resource")
        Object.assign(record, {
          company_name: get("company_name"),
          trade_name: get("trade_name"),
          resource_type: get("resource_type"),
          email: get("email"),
          phone: get("phone"),
          active: f.has("active"),
        });
      else
        Object.assign(record, {
          project_id: get("project_id"),
          start_date: get("start_date"),
          finish_date: get("finish_date"),
          start_time: f.has("all_day") ? "" : get("start_time"),
          finish_time: f.has("all_day") ? "" : get("finish_time"),
          all_day: f.has("all_day"),
          timezone: get("timezone"),
          activity_type: get("activity_type"),
          status: get("status"),
          trade_name: get("trade_name"),
          predecessor_ids: f.getAll("predecessor_ids").map(String),
          source_task_id: get("source_task_id"),
          assignments: f.getAll("resource_id").map((id) => ({
            resource_id: String(id),
            expected_workers: get(`workers_${id}`) || null,
          })),
        });
      if (
        record.status === "cancelled" &&
        initial.status !== "cancelled" &&
        !window.confirm(
          "Cancel this activity? Its history and assignments will be retained.",
        )
      )
        return;
      draft.current.record = record;
    }
    draft.current.submitted = true;
    persist();
    locked.current = true;
    const data = new FormData();
    data.set("kind", kind);
    data.set("request_id", draft.current.request);
    data.set("record", JSON.stringify(draft.current.record));
    startTransition(() => action(data));
  }
  return (
    <form
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onChange={() => {
        if (!draft.current || locked.current || uncertain) return;
        draft.current.request = crypto.randomUUID();
        draft.current.submitted = false;
        capture();
      }}
      className="space-y-3"
    >
      <fieldset
        disabled={!ready || pending || uncertain}
        className="space-y-3 disabled:opacity-70"
      >
        {children}
      </fieldset>
      {recovered && (
        <p role="status">
          Recovered this tab&apos;s draft.{" "}
          {uncertain
            ? "Retry to confirm before editing."
            : "Review before saving."}
        </p>
      )}
      {warning && (
        <p role="status">
          Draft storage unavailable. Keep this page open until saved.
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-danger">
          {state.error}
        </p>
      )}
      {uncertain && (
        <p role="status">Save not confirmed. Retry the same submission.</p>
      )}
      {state.error && !uncertain && (
        <button
          type="button"
          className="min-h-11 underline"
          onClick={() => {
            if (
              window.confirm(
                "Discard this draft and reload? Copy any changes you need first.",
              )
            ) {
              try {
                sessionStorage.removeItem(key);
              } catch {}
              window.location.reload();
            }
          }}
        >
          Discard draft and reload latest
        </button>
      )}
      <button
        className="control min-h-11 w-full rounded-lg button-primary px-4 text-white disabled:opacity-60"
        disabled={!ready || pending}
      >
        {pending
          ? "Saving…"
          : uncertain
            ? "Retry and confirm save"
            : initial.id
              ? "Save changes"
              : "Create " + kind}
      </button>
    </form>
  );
}
export const scheduleInput =
  "mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base";
