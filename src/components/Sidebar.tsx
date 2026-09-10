"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Wrench,
  UserCog,
  CalendarDays,
  Map,
  Route,
  Settings,
  LogOut,
} from "lucide-react";
import { ROLE_LABEL, type SessionRole } from "@/lib/roles";
import GlobalSearch from "@/components/shell/GlobalSearch";
import BrandLogo from "@/components/BrandLogo";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clienti", label: "Clienti", icon: Users },
  { href: "/interventi", label: "Interventi", icon: Wrench },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/pianificazione", label: "Pianificazione", icon: Route },
  { href: "/mappa", label: "Mappa", icon: Map },
  { href: "/tecnici", label: "Tecnici", icon: UserCog },
];

type SessionInfo = {
  username: string;
  role: SessionRole;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (r.status === 401) {
          router.replace(`/login?from=${encodeURIComponent(pathname)}`);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then(setSession)
      .catch(() => setSession(null));
  }, [pathname, router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const items = [...NAV, { href: "/impostazioni", label: "Impostazioni", icon: Settings }];

  return (
    <>
      <aside className="hidden md:flex w-[13.5rem] shrink-0 bg-white border-r border-slate-200 flex-col relative z-30 overflow-visible">
        <div className="px-4 py-4 border-b border-slate-100">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <BrandLogo variant="mark" className="h-9 w-9 shrink-0" />
            <div>
              <div className="text-[15px] font-semibold text-slate-900 tracking-tight leading-tight">
                Tropini Service
              </div>
              <div className="text-[11px] text-teal-700 font-medium">Gestionale operativo</div>
            </div>
          </Link>
        </div>

        <div className="px-3 py-3 border-b border-slate-100 overflow-visible">
          <GlobalSearch />
        </div>

        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto panel-scroll">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium ${
                  active
                    ? "bg-teal-50 text-teal-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={17} strokeWidth={active ? 2.25 : 2} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3">
          {session && (
            <div className="px-1 mb-2">
              <div className="text-sm font-medium text-slate-800 truncate">{session.username}</div>
              <div className="text-[11px] text-slate-400">{ROLE_LABEL[session.role]}</div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          >
            <LogOut size={16} />
            Esci
          </button>
        </div>
      </aside>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex items-center justify-around h-14 pb-safe">
        {NAV.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-1 py-1 ${
                active ? "text-teal-700" : "text-slate-400"
              }`}
            >
              <Icon size={18} />
              <span className="text-[9px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
