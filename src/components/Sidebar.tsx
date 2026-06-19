"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Users, Settings, LayoutDashboard } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/mappa", label: "Mappa", icon: Map },
  { href: "/clienti", label: "Clienti", icon: Users },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden md:flex w-[4.25rem] shrink-0 bg-slate-900 flex-col items-center py-5 gap-1 border-r border-slate-800">
        <Link
          href="/dashboard"
          className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center mb-5 shadow-lg shadow-indigo-900/40 hover:bg-indigo-500 transition-colors"
          title="Planner Tropini"
        >
          <Map size={18} className="text-white" />
        </Link>

        {NAV.map(({ href, label, icon: Icon }) => {
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
      </aside>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-around h-14 pb-safe">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors ${
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
