"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Map, Users, Settings, LayoutDashboard, LogOut, Building2 } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/mappa", label: "Mappa", icon: Map },
  { href: "/clienti", label: "Clienti", icon: Users },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
];

type SessionInfo = {
  username: string;
  role: "ADMIN" | "USER";
  organizationName: string;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSession)
      .catch(() => setSession(null));
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const navItems = [
    ...NAV,
    ...(session?.role === "ADMIN"
      ? [{ href: "/admin/societa", label: "Società", icon: Building2 }]
      : []),
  ];

  return (
    <>
      <aside className="hidden md:flex w-[4.25rem] shrink-0 bg-slate-900 flex-col items-center py-5 gap-1 border-r border-slate-800">
        <Link
          href="/dashboard"
          className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center mb-3 shadow-lg shadow-indigo-900/40 hover:bg-indigo-500 transition-colors"
          title="Planner"
        >
          <Map size={18} className="text-white" />
        </Link>

        {session && (
          <div
            className="mb-3 px-1 text-center"
            title={`${session.organizationName} · ${session.username}`}
          >
            <span className="block text-[9px] font-bold uppercase tracking-wider text-cyan-400/90 truncate max-w-[3.5rem]">
              {session.organizationName.slice(0, 8)}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1 flex-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative ${
                  active
                    ? "bg-white/15 text-white shadow-inner"
                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.25 : 2} />
                <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50 shadow-lg">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          title="Esci"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all group relative mt-auto"
        >
          <LogOut size={18} />
          <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50 shadow-lg">
            Esci
          </span>
        </button>
      </aside>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-around h-14 pb-safe">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                active ? "text-indigo-400" : "text-slate-500"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
