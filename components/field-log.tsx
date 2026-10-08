"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card, DemoNote } from "@/components/ui";
import { formatCrewLine } from "@/lib/daily-report";
import { formatProjectDate } from "@/lib/format-date";
import {
  createFieldLog,
  updateFieldLog,
  type FieldLogFormState,
} from "@/lib/field-log-actions";
import type { FieldLogRecord } from "@/lib/field-log-types";
import { uploadReportPhoto, type PhotoFormState } from "@/lib/photo-actions";
import type { PhotoRecord } from "@/lib/photo-types";

const initialState: FieldLogFormState = { error: null, reportId: null };
const photoState: PhotoFormState = { error: null };

function todayLocalIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-stone-200 px-3";

function CrewFields({
  defaults,
}: {
  defaults?: { company: string; trade: string; count: string }[];
}) {
  const rows = defaults && defaults.length > 0 ? defaults : Array.from({ length: 4 }, () => ({
    company: "",
    trade: "",
    count: "",
  }));
  const padded = rows.length >= 4
    ? rows
    : [
        ...rows,
        ...Array.from({ length: 4 - rows.length }, () => ({
          company: "",
          trade: "",
          count: "",
        })),
      ];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Who was here</legend>
      <p className="text-sm text-stone-500">
        Company can be blank. Trade is required when you fill a row.
      </p>
      {padded.map((row, index) => (
        <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_5rem]">
          <input
            name="crew_company"
            defaultValue={row.company}
            placeholder="Company"
            aria-label={`Crew ${index + 1} company`}
            className={inputClass}
          />
          <input
            name="crew_trade"
            defaultValue={row.trade}
            placeholder="Trade"
            aria-label={`Crew ${index + 1} trade`}
            className={inputClass}
          />
          <input
            name="crew_count"
            defaultValue={row.count}
            inputMode="numeric"
            placeholder="Count"
            aria-label={`Crew ${index + 1} workers`}
            className={inputClass}
          />
        </div>
      ))}
    </fieldset>
  );
}

function ReportFields({
  log,
}: {
  log?: FieldLogRecord;
}) {
  return (
    <>
      <label className="block text-sm font-medium">
        Date
        <input
          name="log_date"
          type="date"
          required
          defaultValue={log?.log_date ?? todayLocalIso()}
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-medium">
        Area
        <input
          name="location_text"
          defaultValue={log?.location_text ?? ""}
          placeholder="Primary bath"
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-medium">
        Work performed
        <textarea
          name="work_performed"
          rows={3}
          defaultValue={log?.work_performed ?? ""}
          placeholder="What got done today?"
          className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      <CrewFields
        defaults={(log?.crews ?? []).map((crew) => ({
          company: crew.company_name ?? "",
          trade: crew.trade_name,
          count: crew.worker_count == null ? "" : String(crew.worker_count),
        }))}
      />
      <label className="block text-sm font-medium">
        Deliveries / materials
        <textarea
          name="deliveries"
          rows={2}
          defaultValue={log?.deliveries ?? ""}
          className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      <label className="block text-sm font-medium">
        Delays / issues
        <textarea
          name="delays"
          rows={2}
          defaultValue={log?.delays ?? ""}
          placeholder="What held the work?"
          className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      <label className="block text-sm font-medium">
        Tomorrow
        <textarea
          name="tomorrow"
          rows={2}
          defaultValue={log?.tomorrow ?? ""}
          className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      <details className="rounded-lg border border-stone-200 px-3 py-2">
        <summary className="min-h-11 cursor-pointer text-sm font-medium">
          More for this day
        </summary>
        <div className="mt-3 space-y-3">
          <label className="block text-sm font-medium">
            Equipment
            <textarea
              name="equipment"
              rows={2}
              defaultValue={log?.equipment ?? ""}
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Inspections / site events
            <textarea
              name="site_events"
              rows={2}
              defaultValue={log?.site_events ?? ""}
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Safety
            <textarea
              name="safety_notes"
              rows={2}
              defaultValue={log?.safety_notes ?? ""}
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            General notes
            <textarea
              name="notes"
              rows={2}
              defaultValue={log?.notes ?? ""}
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
        </div>
      </details>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input
          name="issue_flag"
          type="checkbox"
          defaultChecked={log?.issue_flag ?? false}
          className="size-4"
        />
        Flag this report for attention
      </label>
    </>
  );
}

export function ReportPhotoForm({
  projectId,
  reportId,
}: {
  projectId: string;
  reportId: string;
}) {
  const [state, action, pending] = useActionState(uploadReportPhoto, photoState);
  return (
    <form action={action} className="mt-3 space-y-2 border-t border-stone-100 pt-3">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="field_log_id" value={reportId} />
      <p className="text-sm font-medium">Jobsite photo</p>
      <input
        name="file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        required
        className="block w-full text-sm"
      />
      <input
        name="caption"
        placeholder="Caption"
        className={inputClass}
      />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="control min-h-11 w-full rounded-lg bg-shell text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Add photo"}
      </button>
    </form>
  );
}

export function NewFieldLogForm({
  projectId,
  projects,
}: {
  projectId?: string;
  projects: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createFieldLog, initialState);
  const selectable = projectId
    ? projects.filter((project) => project.id === projectId)
    : projects;

  if (selectable.length === 0) {
    return (
      <Card>
        <h2 className="section-title">
          New daily report
        </h2>
        <p className="mt-3 text-sm text-stone-600">
          Create a job first. Daily reports are saved to a company job.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="section-title">
        New daily report
      </h2>
      <div className="mt-3">
        <DemoNote>
          Saved to your company. Record the day, then add a photo to this report.
          The photo stays private to the job.
        </DemoNote>
      </div>
      <form action={action} className="mt-4 space-y-3">
        {projectId ? (
          <input type="hidden" name="project_id" value={projectId} />
        ) : (
          <label className="block text-sm font-medium">
            Job
            <select
              name="project_id"
              required
              className={`${inputClass} bg-white`}
              defaultValue={selectable[0]?.id}
            >
              {selectable.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <ReportFields />
        <label className="block text-sm font-medium">
          Follow-up to-do
          <input
            name="follow_up_title"
            placeholder="Optional action, such as complete the shower valve"
            className={inputClass}
          />
        </label>
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        {state.reportId && !state.error ? (
          <p className="text-sm text-stone-700">Report saved. Add a photo below if you have one.</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="control min-h-11 w-full rounded-lg bg-shell text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save daily report"}
        </button>
      </form>
      {state.reportId ? (
        <ReportPhotoForm
          projectId={state.projectId ?? projectId ?? ""}
          reportId={state.reportId}
        />
      ) : null}
    </Card>
  );
}

function ReportEditor({ log }: { log: FieldLogRecord }) {
  const [state, action, pending] = useActionState(updateFieldLog, {
    error: null,
    reportId: log.id,
  });
  return (
    <details className="mt-3">
      <summary className="min-h-11 cursor-pointer text-sm font-medium">Edit report</summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="field_log_id" value={log.id} />
        <ReportFields log={log} />
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="control min-h-11 w-full rounded-lg bg-shell text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Update report"}
        </button>
      </form>
    </details>
  );
}

export function FieldLogList({
  logs,
  projectNames,
  showProject,
  photos = [],
}: {
  logs: FieldLogRecord[];
  projectNames: Record<string, string>;
  showProject?: boolean;
  photos?: PhotoRecord[];
}) {
  if (logs.length === 0) {
    return (
      <Card>
        <p className="font-medium">No daily reports yet</p>
        <p className="mt-1 text-sm text-stone-600">
          Record the day on site. Reports stay with your company.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => {
        const reportPhotos = photos.filter((photo) => photo.field_log_id === log.id);
        return (
          <Card key={log.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {showProject
                    ? (projectNames[log.project_id] ?? "Job")
                    : formatProjectDate(log.log_date)}
                </p>
                <p className="text-sm text-stone-500">
                  {log.created_by_name ?? "Crew"}
                  {showProject ? ` · ${formatProjectDate(log.log_date)}` : ""}
                  {log.location_text ? ` · ${log.location_text}` : ""}
                </p>
              </div>
              {log.issue_flag ? (
                <span className="status-badge status-attention">
                  Needs attention
                </span>
              ) : null}
            </div>
            {log.work_performed ? (
              <p className="mt-3 text-sm leading-6 text-stone-700">{log.work_performed}</p>
            ) : null}
            {(log.crews ?? []).length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-stone-700">
                {(log.crews ?? []).map((crew) => (
                  <li key={crew.id}>
                    {formatCrewLine({
                      companyName: crew.company_name,
                      tradeName: crew.trade_name,
                      workerCount: crew.worker_count,
                    })}
                  </li>
                ))}
              </ul>
            ) : null}
            {log.deliveries ? (
              <p className="mt-2 text-sm text-stone-700">Delivery: {log.deliveries}</p>
            ) : null}
            {log.delays ? (
              <p className="mt-2 text-sm text-attention">Delay: {log.delays}</p>
            ) : null}
            {log.tomorrow ? (
              <p className="mt-2 text-sm text-stone-700">Tomorrow: {log.tomorrow}</p>
            ) : null}
            {log.notes ? (
              <p className="mt-2 text-sm leading-6 text-stone-600">{log.notes}</p>
            ) : null}
            {[["Equipment", log.equipment], ["Site events / inspections", log.site_events], ["Safety", log.safety_notes]].map(([label, value]) => value ? (
              <p key={label} className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{label}: {value}</p>
            ) : null)}
            <Link className="mt-3 inline-block min-h-11 py-2 text-sm underline" href={`/projects/${log.project_id}/field/${log.id}#follow-up`}>Report details & follow-ups</Link>
            {reportPhotos.length > 0 ? (
              <p className="mt-2 text-sm text-stone-500">
                {reportPhotos.length} photo{reportPhotos.length === 1 ? "" : "s"} on this report
                {reportPhotos.some((photo) => photo.caption)
                  ? ` · ${reportPhotos
                      .map((photo) => photo.caption)
                      .filter(Boolean)
                      .join("; ")}`
                  : ""}
              </p>
            ) : null}
            <ReportPhotoForm projectId={log.project_id} reportId={log.id} />
            <ReportEditor log={log} />
          </Card>
        );
      })}
    </div>
  );
}
