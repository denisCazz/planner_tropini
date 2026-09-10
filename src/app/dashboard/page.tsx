"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, MapPin, Loader2, CalendarDays } from "lucide-react";
import { minutesToHHMM, formatItalianDateLong, addDaysToDateKey, toLocalDateKey } from "@/lib/dates";

type Apt = {
  id: number;
  startMin: number;
  durationMin: number;
  stato: string;
  tipo: string;
  technicianName: string | null;
  clientName: string;
  citta: string | null;
  telefono: string | null;
  clientId: number;
};

type Dash = {
  today: string;
  tomorrow: string;
  oggi: Apt[];
  domani: Apt[];
  stats?: {
    clients: number;
    withGps: number;
    plants: number;
    openInterventi: number;
  };
};

function DayColumn({ title, dateKey, items, empty }: { title: string; dateKey: string; items: Apt[]; empty: string }) {
  return (
    <section className="card overflow-hidden min-h-[420px] flex flex-col">
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="text-xs font-semibold uppercase tracking-wider text-teal-700">{title}</div>
        <div className="text-sm text-slate-500 capitalize">{formatItalianDateLong(dateKey)}</div>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-10 text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="divide-y divide-slate-100 flex-1">
          {items.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-start gap-3">
              <div className="w-14 shrink-0">
                <div className="text-sm font-semibold tabular-nums text-teal-800">{minutesToHHMM(a.startMin)}</div>
                <div className="text-[11px] text-slate-400">{a.durationMin} min</div>
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/clienti/${a.clientId}`} className="font-medium text-sm hover:text-teal-700">
                  {a.clientName}
                </Link>
                <div className="text-xs text-slate-500 flex flex-wrap gap-x-2 mt-0.5">
                  {a.citta && (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin size={10} /> {a.citta}
                    </span>
                  )}
                  {a.technicianName && <span>{a.technicianName}</span>}
                </div>
              </div>
              {a.telefono && (
                <a href={`tel:${a.telefono}`} className="btn btn-ghost text-xs py-1 shrink-0">
                  <Phone size={12} /> Chiama
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setError(true));
  }, []);

  if (!data && !error) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!data) {
    return <div className="p-8 text-slate-500">Impossibile caricare la dashboard.</div>;
  }

  const today = data.today || toLocalDateKey(new Date());
  const tomorrow = data.tomorrow || addDaysToDateKey(today, 1);
  const stats = data.stats;

  return (
    <div className="p-5 max-w-6xl mx-auto space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Oggi e domani</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data.oggi.length} interventi oggi · {data.domani.length} domani
          </p>
        </div>
        <Link href="/calendario" className="btn btn-ghost">
          <CalendarDays size={16} /> Calendario
        </Link>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Link href="/clienti" className="card p-4 hover:border-teal-200 transition-colors">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Clienti</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{stats.clients.toLocaleString("it-IT")}</div>
          </Link>
          <Link href="/mappa" className="card p-4 hover:border-teal-200 transition-colors">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">In mappa</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{stats.withGps.toLocaleString("it-IT")}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">con coordinate GPS</div>
          </Link>
          <div className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Impianti</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{stats.plants.toLocaleString("it-IT")}</div>
          </div>
          <Link href="/interventi" className="card p-4 hover:border-teal-200 transition-colors">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Interventi aperti</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{stats.openInterventi.toLocaleString("it-IT")}</div>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DayColumn title="Oggi" dateKey={today} items={data.oggi} empty="Nessun intervento in giornata" />
        <DayColumn title="Domani" dateKey={tomorrow} items={data.domani} empty="Nessun intervento in programma" />
      </div>
    </div>
  );
}
