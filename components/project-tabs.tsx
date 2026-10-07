import Link from "next/link";

const tabs = [
  { slug: "", label: "Job", key: "overview" },
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
  active: "overview" | "ask" | "documents" | "field" | "tasks" | "schedule";
}) {
  return (
    <div className="-mx-1 mb-6 overflow-x-auto">
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
              className={`rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap ${
                isActive
                  ? "bg-stone-900 text-white"
                  : "bg-white text-stone-600 ring-1 ring-stone-200"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
