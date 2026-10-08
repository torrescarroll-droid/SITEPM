import Link from "next/link";

const tabs = [
  { slug: "", label: "Job", key: "overview" },
  { slug: "lookahead", label: "Lookahead", key: "lookahead" },
  { slug: "schedule", label: "Schedule", key: "schedule" },
  { slug: "field", label: "Daily Reports", key: "field" },
  { slug: "tasks", label: "To-Dos", key: "tasks" },
  { slug: "documents", label: "Plans & Docs", key: "documents" },
];

export function ProjectTabs({
  projectId,
  active,
}: {
  projectId: string;
  active: "overview" | "ask" | "documents" | "field" | "tasks" | "schedule" | "lookahead";
}) {
  return (
    <nav aria-label="Job sections" className="job-tabs mb-5 overflow-x-auto">
      <div className="flex min-w-max gap-1 px-1">
        {tabs.map((tab) => {
          const href = tab.slug
            ? `/projects/${projectId}/${tab.slug}`
            : `/projects/${projectId}`;
          const isActive = active === tab.key;
          return (
            <Link
              key={tab.label}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`job-tab px-3 py-2 text-sm font-medium whitespace-nowrap ${
                isActive
                  ? "job-tab-active"
                  : "text-stone-600"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
