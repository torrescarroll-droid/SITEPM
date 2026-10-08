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
  schedule: "Schedule file",
  selections: "Selections file",
  change_order: "Change-order file",
  other: "Other",
};

export function PageHeader({
  kicker,
  title,
  description,
}: {
  kicker?: string;
  title: ReactNode;
  description?: string;
}) {
  return (
    <header className="page-header">
      {kicker ? (
        <p className="eyebrow">
          {kicker}
        </p>
      ) : null}
      <h1 className="page-title">
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
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`panel ${className}`}
    >
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status: ProjectStatus }) {
  const tone =
    status === "active"
      ? "status-neutral"
      : status === "on_hold"
        ? "status-attention"
        : "status-success";
  return (
    <span className={`status-badge ${tone}`}>
      {projectStatusLabel[status]}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: TaskPriority }) {
  const tone =
    priority === "high"
      ? "status-attention"
      : priority === "medium"
        ? "status-neutral"
        : "status-neutral";
  return (
    <span className={`status-badge ${tone}`}>
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
    return <span className="status-overdue text-sm font-medium">Overdue</span>;
  }
  const label =
    status === "done" ? "Done" : status === "in_progress" ? "In progress" : "Open";
  return <span className={status === "done" ? "status-success status-badge" : "status-neutral status-badge"}>{label}</span>;
}

export function documentLabel(type: DocumentType) {
  return documentTypeLabel[type];
}

export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <p className="notice">{children}</p>
  );
}
