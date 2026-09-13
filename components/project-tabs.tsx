import Link from "next/link";
import { projects } from "@/lib/demo-data";

const tabs = [
  { slug: "", label: "Overview" },
  { slug: "ask", label: "Ask SITEPM" },
  { slug: "documents", label: "Documents" },
  { slug: "field", label: "Field" },
  { slug: "tasks", label: "Tasks" },
];

export function ProjectTabs({
  projectId,
  active,
}: {
  projectId: string;
  active: "overview" | "ask" | "documents" | "field" | "tasks";
}) {
  const project = projects.find((item) => item.id === projectId);
  if (!project) return null;

  return (
    <div className="-mx-1 mb-6 overflow-x-auto">
      <div className="flex min-w-max gap-1 px-1">
        {tabs.map((tab) => {
          const href = tab.slug
            ? `/projects/${projectId}/${tab.slug}`
            : `/projects/${projectId}`;
          const isActive =
            (active === "overview" && tab.slug === "") || active === tab.slug;
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
