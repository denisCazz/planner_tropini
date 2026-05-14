"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  UserX, Phone, MapPin, Calendar, ChevronRight, Flame,
} from "lucide-react";

interface DashboardData {
  totalCount: number;
  attivi: number;
  inattivi: number;
  prospect: number;
  urgentiCount: number;
  noVisitaCount: number;
  visitaAnzianaCount: number;
  recentiCount: number;
  mesi: number;
  urgentiClients: {
    id: number; nome: string; cognome: string;
    telefono: string | null; citta: string | null;
    indirizzo: string | null; ultimaVisita: string | null;
    stato: string;
  }[];
  daVisitareClients: {
    id: number; nome: string; cognome: string;
    telefono: string | null; citta: string | null;
    ultimaVisita: string | null;
  }[];
  topBrands: { brand: string; count: number }[];
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  href?: string;
}) {
  const inner = (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4 items-start hover:shadow-md transition-shadow ${href ? "cursor-pointer" : ""}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-sm text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [mesi, setMesi] = useState(6);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?mesi=${mesi}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [mesi]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
          <span className="text-sm text-gray-400">Caricamento...</span>
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-6 text-gray-400">Errore caricamento dati.</div>;

  const maxBrand = data.topBrands[0]?.count ?? 1;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Panoramica aggiornata — {new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Soglia visita:</span>
            <select
              value={mesi}
              onChange={(e) => setMesi(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {[3, 6, 9, 12, 18, 24].map((m) => (
                <option key={m} value={m}>{m} mesi</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            icon={<Users size={18} className="text-blue-600" />}
            color="bg-blue-50"
            label="Totale clienti"
            value={data.totalCount}
            href="/clienti"
          />
          <StatCard
            icon={<CheckCircle2 size={18} className="text-green-600" />}
            color="bg-green-50"
            label="Attivi"
            value={data.attivi}
            sub={`${Math.round((data.attivi / data.totalCount) * 100)}%`}
          />
          <StatCard
            icon={<TrendingUp size={18} className="text-amber-600" />}
            color="bg-amber-50"
            label="Non categorizzati"
            value={data.prospect}
            sub={`${Math.round((data.prospect / data.totalCount) * 100)}%`}
          />
          <StatCard
            icon={<AlertTriangle size={18} className="text-red-600" />}
            color="bg-red-50"
            label="Urgenti"
            value={data.urgentiCount}
            sub="da visitare subito"
          />
          <StatCard
            icon={<Clock size={18} className="text-orange-600" />}
            color="bg-orange-50"
            label={`Da visitare (${mesi}m)`}
            value={data.visitaAnzianaCount + data.noVisitaCount}
            sub={`${data.noVisitaCount} mai visitati`}
          />
        </div>

        {/* Second row: urgenti + top brands */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Urgenti */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" />
                <span className="font-semibold text-gray-900 text-sm">Clienti urgenti</span>
                <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-medium">{data.urgentiCount}</span>
              </div>
              <Link href="/mappa?urgente=1" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Vedi su mappa <ChevronRight size={12} />
              </Link>
            </div>
            {data.urgentiClients.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">Nessun cliente urgente</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.urgentiClients.map((c) => {
                  const days = daysSince(c.ultimaVisita);
                  return (
                    <Link
                      key={c.id}
                      href={`/clienti/${c.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <AlertTriangle size={14} className="text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {c.cognome} {c.nome}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          {c.citta && <span className="flex items-center gap-0.5"><MapPin size={10}/>{c.citta}</span>}
                          {c.telefono && <span className="flex items-center gap-0.5"><Phone size={10}/>{c.telefono}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {days !== null ? (
                          <span className={`text-xs font-medium ${days > 180 ? "text-red-600" : "text-amber-600"}`}>
                            {days}gg fa
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">mai</span>
                        )}
                        <div className="text-xs text-gray-300 mt-0.5 group-hover:text-blue-500">→</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top brands */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Flame size={16} className="text-orange-500" />
              <span className="font-semibold text-gray-900 text-sm">Marche stufe</span>
            </div>
            <div className="p-4 space-y-2.5">
              {data.topBrands.slice(0, 10).map(({ brand, count }) => (
                <div key={brand}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-700 font-medium truncate max-w-[160px]" title={brand}>{brand}</span>
                    <span className="text-gray-400 ml-2 shrink-0">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-400 rounded-full transition-all"
                      style={{ width: `${Math.round((count / maxBrand) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {data.topBrands.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nessun dato</p>
              )}
            </div>
          </div>
        </div>

        {/* Da visitare */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <UserX size={16} className="text-orange-500" />
              <span className="font-semibold text-gray-900 text-sm">Attivi da visitare</span>
              <span className="text-xs text-gray-400">(ultima visita &gt; {mesi} mesi fa o mai visitati)</span>
              <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-medium">
                {data.visitaAnzianaCount + data.noVisitaCount}
              </span>
            </div>
          </div>
          {data.daVisitareClients.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              Tutti i clienti attivi sono stati visitati di recente
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left px-4 py-2 font-medium">Cliente</th>
                    <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Città</th>
                    <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Telefono</th>
                    <th className="text-left px-4 py-2 font-medium">Ultima visita</th>
                    <th className="text-left px-4 py-2 font-medium">Attesa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.daVisitareClients.map((c) => {
                    const days = daysSince(c.ultimaVisita);
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <Link href={`/clienti/${c.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                            {c.cognome} {c.nome}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">
                          {c.citta ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">
                          {c.telefono ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar size={12} className="text-gray-300" />
                            {formatDate(c.ultimaVisita)}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {days !== null ? (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              days > 365 ? "bg-red-100 text-red-700" :
                              days > 180 ? "bg-orange-100 text-orange-700" :
                              "bg-yellow-100 text-yellow-700"
                            }`}>
                              {days}gg
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">mai</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-gray-700">{data.inattivi}</div>
            <div className="text-xs text-gray-400 mt-1">Inattivi</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-gray-700">{data.noVisitaCount}</div>
            <div className="text-xs text-gray-400 mt-1">Mai visitati</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{data.recentiCount}</div>
            <div className="text-xs text-gray-400 mt-1">Aggiunti (30gg)</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-gray-700">{data.totalCount - data.noVisitaCount}</div>
            <div className="text-xs text-gray-400 mt-1">Con ultima visita</div>
          </div>
        </div>

      </div>
    </div>
  );
}
