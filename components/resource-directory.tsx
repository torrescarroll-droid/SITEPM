"use client";
import { useState } from "react";
import { Card } from "./ui";
import {
  ScheduleRecordForm,
  scheduleInput as input,
} from "./schedule-record-form";
import { RESOURCE_TYPES, type ScheduleResource } from "@/lib/schedule-types";
export function ResourceDirectory({
  resources,
  scope,
}: {
  resources: ScheduleResource[];
  scope: string;
}) {
  const [editing, setEditing] = useState<ScheduleResource | null | undefined>(
      undefined,
    ),
    [message, setMessage] = useState(""),
    [filter, setFilter] = useState("");
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        Reusable company contacts and crews. Directory entries do not grant
        SITEPM access. Assignments indicate expected work, never actual
        attendance.
      </p>
      <button
        className="control min-h-11 rounded-lg bg-shell px-4 text-white"
        onClick={() => setEditing(null)}
      >
        Add resource
      </button>
      {message && <p role="status">{message}</p>}
      <label className="block">
        Find resource
        <input
          className={input}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </label>
      {editing !== undefined && (
        <Card>
          <h2 className="section-title">
            {editing ? "Edit resource" : "New resource"}
          </h2>
          <button
            className="min-h-11 underline"
            onClick={() => setEditing(undefined)}
          >
            Close editor (draft retained)
          </button>
          <ScheduleRecordForm
            key={editing?.id ?? "new"}
            kind="resource"
            scope={scope}
            initial={editing ?? { active: true }}
            onSaved={() => {
              setEditing(undefined);
              setMessage("Resource saved.");
            }}
          >
            {(
              ["name", "company_name", "trade_name", "email", "phone"] as const
            ).map((n) => (
              <label key={n} className="block capitalize">
                {n.replace("_", " ")}
                <input
                  className={input}
                  name={n}
                  required={n === "name"}
                  type={n === "email" ? "email" : "text"}
                  maxLength={
                    n === "email"
                      ? 254
                      : n === "phone"
                        ? 80
                        : n === "trade_name"
                          ? 100
                          : 200
                  }
                  defaultValue={editing?.[n] ?? ""}
                />
              </label>
            ))}
            <label className="block">
              Resource type
              <select
                name="resource_type"
                defaultValue={editing?.resource_type ?? "crew"}
                className={input}
              >
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Notes
              <textarea
                className={input}
                name="notes"
                maxLength={5000}
                defaultValue={editing?.notes ?? ""}
              />
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing?.active ?? true}
              />
              Active — available for assignments
            </label>
          </ScheduleRecordForm>
        </Card>
      )}
      {resources.length === 0 && (
        <Card>
          No resources yet. Add your employees, trade partners, crews and
          suppliers once, then reuse them across jobs.
        </Card>
      )}
      <ul className="record-stack">
        {resources
          .filter((r) =>
            `${r.name} ${r.company_name} ${r.trade_name}`
              .toLowerCase()
              .includes(filter.toLowerCase()),
          )
          .map((r) => (
            <li key={r.id}>
              <Card>
                <h2 className="font-semibold">
                  {r.name} {!r.active && "· Inactive"}
                </h2>
                <p>
                  {r.resource_type.replaceAll("_", " ")} ·{" "}
                  {r.trade_name ?? "Trade not recorded"}{" "}
                  {r.company_name && `· ${r.company_name}`}
                </p>
                <p className="text-sm">
                  {r.email} {r.phone}
                </p>
                {r.notes && <p className="text-sm">{r.notes}</p>}
                <button
                  className="min-h-11 underline"
                  onClick={() => setEditing(r)}
                >
                  Edit {r.name}
                </button>
              </Card>
            </li>
          ))}
      </ul>
    </div>
  );
}
