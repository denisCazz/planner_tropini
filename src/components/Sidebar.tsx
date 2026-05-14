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
      {/* Desktop: left icon bar */}
      <aside className="hidden md:flex w-16 shrink-0 bg-gray-900 flex-col items-center py-4 gap-1">
        {/* Logo */}
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center mb-4">
          <Map size={18} className="text-white" />
        </div>

        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors group relative ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon size={18} />
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50">
                {label}
              </span>
            </Link>
          );
        })}
      </aside>

      {/* Mobile: bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-gray-900 flex items-center justify-around h-14 pb-safe">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors ${
                active ? "text-blue-400" : "text-gray-400"
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
