"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startDocumentUpload,
  confirmDocumentUpload,
} from "@/lib/document-management-actions";
import { DOCUMENT_TYPES } from "@/lib/document-types";
import { uploadDocumentResumable } from "@/lib/document-upload-transport";
type Draft = {
  request: string;
  record: Record<string, unknown>;
  uploadUrl?: string;
};
const accept = ".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.pptx";
export function DocumentUpload({
  projects,
  scope,
  projectId,
  familyId,
}: {
  projects: { id: string; name: string }[];
  scope: string;
  projectId?: string;
  familyId?: string;
}) {
  const router = useRouter(),
    form = useRef<HTMLFormElement>(null),
    locked = useRef(false),
    draft = useRef<Draft | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [percent, setPercent] = useState(0),
    [recovered, setRecovered] = useState(false),
    [discarding, setDiscarding] = useState(false);
  const key = `sitepm-report-v1:${scope}:document-upload:${familyId ?? projectId ?? "company"}`;
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      draft.current = null;
      setRecovered(false);
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const d = JSON.parse(raw);
          if (
            typeof d.request === "string" &&
            /^[0-9a-f-]{36}$/i.test(d.request) &&
            d.record &&
            typeof d.record.sha256 === "string" &&
            /^[a-f0-9]{64}$/.test(d.record.sha256) &&
            Number.isSafeInteger(d.record.byte_size) &&
            (!projectId || d.record.project_id === projectId) &&
            (d.record.family_id ?? null) === (familyId ?? null)
          ) {
            draft.current = d;
            for (const name of [
              "project_id",
              "title",
              "category",
              "collection",
              "trade",
              "issue_label",
              "issued_on",
            ]) {
              const value = d.record[name];
              const input = form.current?.elements.namedItem(name);
              if (
                input instanceof HTMLInputElement ||
                input instanceof HTMLSelectElement ||
                input instanceof HTMLTextAreaElement
              )
                input.value = String(value ?? "");
            }
            setRecovered(true);
          } else {
            try {
              sessionStorage.removeItem(key);
            } catch {}
            setMessage(
              "Invalid local recovery details were cleared. Choose the file to start safely.",
            );
          }
        }
      } catch {
        setMessage(
          "Tab recovery is unavailable. Keep this page open until the upload is confirmed.",
        );
      }
    });
    return () => {
      live = false;
    };
  }, [key, projectId, familyId]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setPercent(0);
    setMessage("Preparing upload…");
    try {
      const f = new FormData(event.currentTarget),
        file = f.get("file");
      if (!(file instanceof File) || !file.size)
        throw Error(
          "Reselect the same file to retry, or choose a supported file.",
        );
      if (file.size > 20 * 1024 * 1024)
        throw Error("Files must be 20 MiB or smaller.");
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
      )
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      if (draft.current) {
        if (
          draft.current.record.sha256 !== hash ||
          draft.current.record.byte_size !== file.size
        )
          throw Error(
            "Recovered upload requires the same file. Discard the draft to start another upload.",
          );
      } else
        draft.current = {
          request: crypto.randomUUID(),
          record: {
            id: crypto.randomUUID(),
            project_id: projectId ?? f.get("project_id"),
            family_id: familyId ?? null,
            filename: file.name,
            byte_size: file.size,
            sha256: hash,
            title: f.get("title") || file.name,
            category: f.get("category") || "other",
            collection: f.get("collection") || "",
            trade: f.get("trade") || "",
            notes: "",
            issue_label: f.get("issue_label") || "",
            issued_on: f.get("issued_on") || "",
          },
        };
      try {
        sessionStorage.setItem(key, JSON.stringify(draft.current));
      } catch {
        setMessage("Tab recovery unavailable. Keep this page open.");
      }
      // Storage may already have committed even when its response was lost.
      let confirmation = await confirmDocumentUpload(draft.current.request);
      if (!confirmation.data) {
        const started = await startDocumentUpload(
          draft.current.request,
          draft.current.record,
        );
        if (started.error || !started.data)
          throw Error(started.error ?? "Upload not confirmed.");
        if (!started.data.verified) {
          setMessage("Uploading…");
          try {
            await uploadDocumentResumable(
              started.data,
              file,
              setPercent,
              draft.current.uploadUrl,
              (location) => {
                if (draft.current) {
                  draft.current.uploadUrl = location;
                  try {
                    sessionStorage.setItem(key, JSON.stringify(draft.current));
                  } catch {}
                }
              },
            );
          } catch {
            /* Always verify possible persisted bytes before deciding whether upload failed. */
          }
        }
        setMessage("Verifying stored file…");
        confirmation = await confirmDocumentUpload(draft.current.request);
      }
      if (confirmation.error || !confirmation.data)
        throw Error(
          confirmation.error ?? "Save not confirmed. Retry the same file.",
        );
      try {
        sessionStorage.removeItem(key);
      } catch {}
      draft.current = null;
      setRecovered(false);
      setMessage(
        "File saved and verified. Review the version and explicitly make it current.",
      );
      router.push(`/documents/${confirmation.data.family_id}`);
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
      setRecovered(Boolean(draft.current));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="section-title">
        {familyId ? "Add version" : "Upload document"}
      </h2>
      <p className="my-3 text-sm text-stone-600">
        PDF, JPG, PNG, DOCX, XLSX, PPTX · 20 MiB per file · 50 uploads/hour per
        user · 2 GiB company pilot capacity (including retained versions).
        Pending uploads reserve 20 MiB until their stored bytes are verified.
        Office files are download-only; macros and legacy Office formats are not
        supported. Uploading does not make a version current.
      </p>
      {recovered && (
        <p role="status">
          Recovered upload with its original metadata. Reselect the same file to
          continue or confirm safely. Metadata changes can be made after
          verification.
        </p>
      )}
      <form ref={form} onSubmit={submit} className="space-y-3">
        <fieldset disabled={busy} className="space-y-3">
          {!projectId && (
            <label className="block">
              Job
              <select name="project_id" required className="control w-full">
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!familyId && (
            <>
              <label className="block">
                Document title
                <input
                  name="title"
                  maxLength={200}
                  required
                  className="control w-full"
                />
              </label>
              <label className="block">
                Category
                <select name="category" className="control w-full">
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                Collection
                <input
                  name="collection"
                  maxLength={100}
                  placeholder="e.g. Permit set"
                  className="control w-full"
                />
              </label>
              <label className="block">
                Trade
                <input
                  name="trade"
                  maxLength={100}
                  className="control w-full"
                />
              </label>
            </>
          )}
          <label className="block">
            Issue label
            <input
              name="issue_label"
              maxLength={100}
              className="control w-full"
            />
          </label>
          <label className="block">
            Issued date (if known)
            <input name="issued_on" type="date" className="control w-full" />
          </label>
          <label className="block">
            File
            <input
              name="file"
              type="file"
              accept={accept}
              required
              className="block w-full py-3"
            />
          </label>
          <button
            className="control w-full button-primary text-white"
            disabled={!projects.length}
          >
            {busy
              ? "Saving…"
              : recovered
                ? "Retry and confirm upload"
                : "Upload and verify"}
          </button>
        </fieldset>
        {busy && (
          <progress
            aria-label="Upload progress"
            max="100"
            value={percent}
            className="w-full"
          />
        )}
        <p role="status" className="break-words text-sm">
          {message}
        </p>
        {recovered && !busy && (
          <button
            type="button"
            className="control"
            onClick={() => {
              if (!discarding) {
                setDiscarding(true);
                return;
              }
              {
                try {
                  sessionStorage.removeItem(key);
                } catch {}
                draft.current = null;
                setRecovered(false);
                setMessage("Ready for another upload.");
              }
            }}
          >
            {discarding ? "Confirm discard local draft" : "Discard local draft"}
          </button>
        )}
      </form>
    </section>
  );
}
