"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  manageDocument,
  processDocumentText,
} from "@/lib/document-management-actions";
import type {
  DocumentFamily,
  DocumentVersion,
} from "@/lib/document-management";
type Target = {
  id: string;
  label: string;
  kind: "task_id" | "activity_id" | "field_log_id";
};
export function DocumentControls({
  family,
  versions,
  targets,
}: {
  family: DocumentFamily;
  versions: DocumentVersion[];
  targets: Target[];
}) {
  const router = useRouter(),
    lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [confirmation, setConfirmation] = useState<{
      action: string;
      data: Record<string, unknown>;
    } | null>(null);
  async function run(
    action: string,
    data: Record<string, unknown>,
    confirmed = false,
  ) {
    if (lock.current) return;
    if (["archive", "promote"].includes(action) && !confirmed) {
      setConfirmation({ action, data });
      return;
    }
    setConfirmation(null);
    lock.current = true;
    setBusy(true);
    try {
      const r = await manageDocument(family.id, family.revision, action, data);
      setMessage(r.error ?? "Change saved.");
      if (r.data) router.refresh();
    } catch {
      setMessage(
        "Save not confirmed. Reload the latest document before retrying.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      {confirmation && (
        <section
          role="alertdialog"
          aria-label="Confirm document change"
          className="rounded-lg border-2 border-amber-600 bg-amber-50 p-4"
        >
          <p>
            {confirmation.action === "archive"
              ? "Archive this document group? Files and history will be retained."
              : "Make this exact version current? Existing work references stay pinned to their original versions."}
          </p>
          <div className="flex flex-wrap gap-3 mt-3">
            <button
              className="control"
              onClick={() =>
                void run(confirmation.action, confirmation.data, true)
              }
            >
              Confirm change
            </button>
            <button className="control" onClick={() => setConfirmation(null)}>
              Keep unchanged
            </button>
          </div>
        </section>
      )}
      <p role="status" className="text-sm">
        {busy ? "Saving…" : message}
      </p>
      <section className="rounded-lg border bg-white p-4">
        <h2 className="section-title">Document organization</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              "metadata",
              Object.fromEntries(new FormData(e.currentTarget)),
            );
          }}
        >
          <fieldset disabled={busy} className="space-y-3">
            <label className="block">
              Title
              <input
                className="control w-full"
                name="title"
                defaultValue={family.title}
                required
                maxLength={200}
              />
            </label>
            <label className="block">
              Category
              <select
                className="control w-full"
                name="category"
                defaultValue={family.category}
              >
                {[
                  "contract",
                  "plans",
                  "specifications",
                  "schedule",
                  "selections",
                  "change_order",
                  "other",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block">
              Collection
              <input
                className="control w-full"
                name="collection"
                defaultValue={family.collection}
                maxLength={100}
              />
            </label>
            <label className="block">
              Trade
              <input
                className="control w-full"
                name="trade"
                defaultValue={family.trade}
                maxLength={100}
              />
            </label>
            <label className="block">
              Notes
              <textarea
                className="control w-full"
                name="notes"
                defaultValue={family.notes}
                maxLength={5000}
              />
            </label>
            <button className="control bg-shell text-white">
              Save organization
            </button>
          </fieldset>
        </form>
        <button
          disabled={busy}
          className="control mt-3"
          onClick={() => void run(family.archived ? "restore" : "archive", {})}
        >
          {family.archived ? "Restore document" : "Archive document"}
        </button>
      </section>
      <section className="space-y-3">
        <h2 className="section-title">Version history</h2>
        <p className="text-sm">
          Latest 100 versions. Original files and hashes are retained. “Current”
          is an explicit team selection, not approval of construction
          instructions.
        </p>
        {versions.map((v) => (
          <article
            key={v.document_id}
            className="rounded-lg border bg-white p-4 break-words"
          >
            <h3 className="font-semibold">
              Version {v.version_number} ·{" "}
              {v.issue_label || v.documents.filename}
            </h3>
            <p>
              {family.current_document_id === v.document_id
                ? "Current version"
                : v.documents.status === "ready"
                  ? "Available candidate / historical version"
                  : "Upload not confirmed"}
            </p>
            <p className="text-sm">
              {v.documents.filename} ·{" "}
              {(v.documents.byte_size / 1024 / 1024).toFixed(2)} MiB ·{" "}
              {v.issued_on
                ? `Issued ${v.issued_on}`
                : "Issue date not recorded"}
            </p>
            <p className="text-sm">
              Uploaded {v.documents.created_at.slice(0, 10)} ·{" "}
              {v.documents.content_type === "application/pdf"
                ? `Text search: ${v.processing_state.replaceAll("_", " ")}`
                : "Download only · metadata searchable"}
            </p>
            <details className="text-xs">
              <summary>Source identity</summary>
              <p>File ID {v.document_id}</p>
              <p>
                SHA-256 {v.documents.sha256 ?? "Legacy checksum not recorded"}
              </p>
              <p>
                {v.verified_at
                  ? `Stored bytes checked ${v.verified_at}`
                  : "Legacy source — no Sprint 5 byte-verification receipt"}
              </p>
            </details>
            {v.documents.status === "ready" && !family.archived && (
              <div className="flex flex-wrap gap-3 mt-3">
                <a
                  className="control"
                  href={`/documents/file/${v.document_id}`}
                >
                  Download version {v.version_number}
                </a>
                {family.current_document_id !== v.document_id && (
                  <button
                    className="control"
                    disabled={busy}
                    onClick={() =>
                      void run("promote", { document_id: v.document_id })
                    }
                  >
                    Make version {v.version_number} current
                  </button>
                )}
                {v.documents.content_type === "application/pdf" && (
                  <button
                    className="control"
                    disabled={busy}
                    onClick={async () => {
                      if (lock.current) return;
                      lock.current = true;
                      setBusy(true);
                      try {
                        const r = await processDocumentText(v.document_id);
                        setMessage(
                          r.error ??
                            "PDF text indexed. Source file is unchanged.",
                        );
                        router.refresh();
                      } catch {
                        setMessage(
                          "Text indexing not confirmed. The source file remains saved.",
                        );
                      } finally {
                        lock.current = false;
                        setBusy(false);
                      }
                    }}
                  >
                    Index PDF text
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      </section>
      {!family.archived && targets.length > 0 && (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="section-title">Link a version to work</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                [kind, id] = String(f.get("target")).split(":");
              void run("link", {
                id: crypto.randomUUID(),
                document_id: f.get("document_id"),
                [kind]: id,
              });
            }}
          >
            <fieldset disabled={busy} className="space-y-3">
              <label className="block">
                Exact version
                <select required name="document_id" className="control w-full">
                  {versions
                    .filter((v) => v.documents.status === "ready")
                    .map((v) => (
                      <option key={v.document_id} value={v.document_id}>
                        Version {v.version_number} ·{" "}
                        {v.issue_label || v.documents.filename}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block">
                Work reference
                <select required name="target" className="control w-full">
                  {targets.map((t) => (
                    <option key={t.kind + t.id} value={`${t.kind}:${t.id}`}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="control">Save version link</button>
            </fieldset>
          </form>
        </section>
      )}
    </div>
  );
}
export function RemoveDocumentLink({
  family,
  link,
}: {
  family: DocumentFamily;
  link: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [confirming, setConfirming] = useState(false);
  return (
    <>
      <button
        className="control"
        disabled={busy}
        onClick={async () => {
          if (!confirming) {
            setConfirming(true);
            return;
          }
          setBusy(true);
          try {
            const r = await manageDocument(
              family.id,
              family.revision,
              "unlink",
              { id: link },
            );
            setMessage(r.error ?? "Link removed.");
            if (r.data) router.refresh();
          } catch {
            setMessage("Removal not confirmed. Reload and reconcile.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {confirming ? "Confirm remove link" : "Remove link"}
      </button>
      {confirming && (
        <button className="control" onClick={() => setConfirming(false)}>
          Keep link
        </button>
      )}
      <span role="status">{message}</span>
    </>
  );
}
