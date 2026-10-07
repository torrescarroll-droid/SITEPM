"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";

const desktopNav = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Jobs" },
  { href: "/schedule", label: "Schedule" },
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
}: {
  children: React.ReactNode;
  userName: string;
  companyName: string;
  roleLabel: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-full bg-stone-100 text-stone-950">
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col md:bg-stone-950 md:text-stone-100">
        <div className="border-b border-stone-800 px-5 py-5">
          <p className="text-xs font-medium tracking-[0.18em] text-stone-400 uppercase">
            Built for builders, by builders.
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight">LINEHORSE</p>
          <p className="mt-1 text-sm text-stone-400">Construction intelligence</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {desktopNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium ${
                  active
                    ? "bg-stone-100 text-stone-950"
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
          <form action={signOut} className="mt-3">
            <button
              type="submit"
              className="text-sm font-medium text-stone-200 hover:text-white"
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

      <div className="md:pl-64">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-stone-500 uppercase">
              LINEHORSE
            </p>
            <p className="text-sm text-stone-600">{companyName}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="min-h-11 text-sm font-medium text-stone-700"
            >
              Log out
            </button>
          </form>
        </header>
        <main className="px-4 py-5 pb-28 md:px-8 md:py-8 md:pb-8">{children}</main>
      </div>

      <nav className="fixed right-0 bottom-0 left-0 z-10 border-t border-stone-800 bg-stone-950 pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-5">
          {mobileNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex min-h-14 items-center justify-center px-1 text-center text-xs font-medium ${
                    active ? "text-white" : "text-stone-400"
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
