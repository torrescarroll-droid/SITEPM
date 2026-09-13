import type { ReactNode } from "react";
import type { DocumentType, ProjectStatus, TaskPriority, TaskStatus } from "@/lib/demo-data";

const projectStatusLabel: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  complete: "Complete",
};

const documentTypeLabel: Record<DocumentType, string> = {
  contract: "Contract",
  plans: "Plans",
  specifications: "Specifications",
  schedule: "Schedule",
  selections: "Selections",
  change_order: "Change order",
  other: "Other",
};

export function PageHeader({
  kicker,
  title,
  description,
}: {
  kicker?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6">
      {kicker ? (
        <p className="text-xs font-medium tracking-[0.16em] text-stone-500 uppercase">
          {kicker}
        </p>
      ) : null}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-950 md:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600 md:text-base">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status: ProjectStatus }) {
  const tone =
    status === "active"
      ? "bg-emerald-50 text-emerald-800"
      : status === "on_hold"
        ? "bg-amber-50 text-amber-900"
        : "bg-stone-100 text-stone-600";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      {projectStatusLabel[status]}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: TaskPriority }) {
  const tone =
    priority === "high"
      ? "bg-orange-50 text-orange-900"
      : priority === "medium"
        ? "bg-stone-100 text-stone-700"
        : "bg-stone-50 text-stone-500";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      {priority}
    </span>
  );
}

export function TaskStatusText({
  status,
  overdue,
}: {
  status: TaskStatus;
  overdue?: boolean;
}) {
  if (overdue && status !== "done") {
    return <span className="text-sm font-medium text-orange-800">Overdue</span>;
  }
  const label =
    status === "done" ? "Done" : status === "in_progress" ? "In progress" : "Open";
  return <span className="text-sm text-stone-600">{label}</span>;
}

export function documentLabel(type: DocumentType) {
  return documentTypeLabel[type];
}

export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-600">{children}</p>
  );
}
