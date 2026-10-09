"use client";

import Link from "next/link";
import { useEffect } from "react";
import { clearOtherReportDrafts } from "@/lib/report-draft-storage";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";

const desktopNav = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Jobs" },
  { href: "/schedule", label: "Schedule" },
  { href: "/resources", label: "Resources" },
  { href: "/tasks", label: "To-Dos" },
  { href: "/field", label: "Daily Reports" },
  { href: "/documents", label: "Plans & Docs" },
];

const mobileNav = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Jobs" },
  { href: "/schedule", label: "Schedule" },
  { href: "/field", label: "Reports" },
  { href: "/tasks", label: "To-Dos" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  userName,
  companyName,
  roleLabel,
  userId,
}: {
  userId?: string;
  children: React.ReactNode;
  userName: string;
  companyName: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  useEffect(() => {
    try { clearOtherReportDrafts(sessionStorage, userId); } catch { /* Storage may be blocked. */ }
  }, [userId]);
  function clearDraftsOnLogout() {
    try { clearOtherReportDrafts(sessionStorage); } catch { /* Never prevent logout. */ }
  }

  return (
    <div className="app-shell min-h-full bg-background text-foreground">
      <a href="#main-content" className="skip-link">Skip to job content</a>
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-60 md:flex-col md:overflow-y-auto md:bg-shell md:text-stone-100">
        <div className="border-b border-stone-800 px-5 py-5">
          <p className="text-xs font-medium tracking-wide text-stone-300">
            Built for builders, by builders.
          </p>
          <p className="mt-2 text-xl font-semibold tracking-[0.12em]">LINEHORSE</p>
          <p className="mt-1 text-sm text-stone-400">Construction intelligence</p>
        </div>
        <nav aria-label="Company navigation" className="flex flex-1 flex-col gap-1 p-3">
          {desktopNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`nav-item px-3 py-2.5 text-sm font-medium ${
                  active
                    ? "nav-item-active"
                    : "text-stone-200 hover:bg-stone-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-stone-800 px-5 py-4 text-sm">
          <p className="font-medium">{userName}</p>
          <p className="text-stone-400">{companyName}</p>
          <p className="text-stone-400 capitalize">{roleLabel}</p>
          <form action={signOut} onSubmit={clearDraftsOnLogout} title="Logging out clears this tab’s unsent drafts." className="mt-3">
            <button
              type="submit"
              className="control text-sm font-medium text-stone-200 hover:text-white"
            >
              Log out
            </button>
          </form>
          <Link
            href="/guide"
            className="mt-3 inline-block text-sm text-stone-400 hover:text-white"
          >
            Private beta guide
          </Link>
        </div>
      </aside>

      <div className="min-w-0 md:pl-60">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-[0.18em] text-stone-500 uppercase">
              LINEHORSE
            </p>
            <p className="truncate text-sm text-stone-600">{companyName}</p>
          </div>
          <Link href="/documents" className="control min-h-11 text-sm font-medium" aria-label="Company documents">Docs</Link>
          <form action={signOut} onSubmit={clearDraftsOnLogout} title="Logging out clears this tab’s unsent drafts.">
            <button
              type="submit"
              className="control min-h-11 text-sm font-medium text-stone-700"
            >
              Log out
            </button>
          </form>
        </header>
        <main id="main-content" tabIndex={-1} className="workspace">{children}</main>
      </div>

      <nav aria-label="Mobile company navigation" className="fixed right-0 bottom-0 left-0 z-10 border-t border-stone-800 bg-shell pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-5">
          {mobileNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 items-center justify-center px-1 text-center text-xs font-medium ${
                    active ? "border-t-2 border-brass bg-white/10 text-white" : "border-t-2 border-transparent text-stone-300"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
