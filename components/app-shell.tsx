"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { clearOtherReportDrafts } from "@/lib/report-draft-storage";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { WorkspaceIcon } from "./workspace-icon";

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
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (mobileMenu.current) mobileMenu.current.open = false;
  }, [pathname]);
  useEffect(() => {
    try {
      clearOtherReportDrafts(sessionStorage, userId);
    } catch {
      /* Storage may be blocked. */
    }
  }, [userId]);
  function clearDraftsOnLogout() {
    try {
      clearOtherReportDrafts(sessionStorage);
    } catch {
      /* Never prevent logout. */
    }
  }

  return (
    <div className="app-shell min-h-full bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        Skip to job content
      </a>
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-60 md:flex-col md:overflow-y-auto md:bg-shell md:text-stone-100">
        <div className="shell-brand">
          <p className="shell-wordmark">LINEHORSE</p>
          <p className="shell-tagline">KEEP YOUR PROJECT RUNNING.</p>
          <p className="shell-position">Construction Intelligence</p>
        </div>
        <nav
          aria-label="Company navigation"
          className="flex flex-1 flex-col gap-1 p-3"
        >
          <p className="px-3 py-3 text-[10px] font-semibold uppercase tracking-[.16em] text-stone-400">
            Workspace
          </p>
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
                <WorkspaceIcon href={item.href} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-stone-800 px-5 py-4 text-sm">
          <p className="font-medium">{userName}</p>
          <p className="text-stone-400">{companyName}</p>
          <p className="text-stone-400 capitalize">{roleLabel}</p>
          <form
            action={signOut}
            onSubmit={clearDraftsOnLogout}
            title="Logging out clears this tab’s unsent drafts."
            className="mt-3"
          >
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
          <p className="mt-5 text-[10px] uppercase tracking-wider text-stone-400">
            Built for builders, by builders.
          </p>
        </div>
      </aside>

      <div className="min-w-0 md:pl-60">
        <header className="mobile-shell sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-3 md:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-[0.18em] text-stone-100 uppercase">
              LINEHORSE
            </p>
            <p className="truncate text-sm text-stone-300">{companyName}</p>
          </div>
          <Link
            href="/documents"
            className="control min-h-11 text-sm font-medium"
            aria-label="Company documents"
          >
            Docs
          </Link>
          <details ref={mobileMenu} className="mobile-more">
            <summary aria-label="More workspace links">More ▾</summary>
            <div className="mobile-more-menu">
              <Link href="/resources">Resources</Link>
              <Link href="/guide">Private beta guide</Link>
              <p className="px-3 py-2 text-xs capitalize">
                {userName} · {roleLabel}
              </p>
              <form
                action={signOut}
                onSubmit={clearDraftsOnLogout}
                title="Logging out clears this tab’s unsent drafts."
              >
                <button
                  type="submit"
                  className="control min-h-11 text-sm font-medium text-stone-100"
                >
                  Log out
                </button>
              </form>
            </div>
          </details>
        </header>
        <div className="workspace-bar">
          <div>
            <strong>{companyName}</strong>
            <span className="ml-3">Company workspace</span>
          </div>
          <div className="workspace-identity">
            <span className="workspace-avatar" aria-hidden="true">
              {userName.trim().slice(0, 2).toUpperCase()}
            </span>
            <span>
              {userName}
              <span className="ml-2 capitalize">· {roleLabel}</span>
            </span>
          </div>
        </div>
        <main id="main-content" tabIndex={-1} className="workspace">
          {children}
        </main>
      </div>

      <nav
        aria-label="Mobile company navigation"
        className="fixed right-0 bottom-0 left-0 z-10 border-t border-stone-800 bg-shell pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {mobileNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-16 flex-col gap-1 items-center justify-center px-1 text-center text-xs font-medium ${
                    active
                      ? "border-t-2 border-brass bg-white/10 text-white"
                      : "border-t-2 border-transparent text-stone-300"
                  }`}
                >
                  <WorkspaceIcon href={item.href} />
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
