"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import PageHeader from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { minutesToHHMM, toLocalDateKey, formatItalianDateLong } from "@/lib/dates";
import { TIPO_LABEL } from "@/lib/status";
import { useOrgUsers } from "@/lib/useOrgUsers";
import { technicianDisplayName } from "@/lib/roles";
import { nextFreeStartMin } from "@/lib/planning/nextSlot";
import type { Intervento } from "@/types/client";

type Apt = {
  id: number;
  startMin: number;
  durationMin: number;
  interventoId?: number | null;
  client: { nome: string; cognome: string; citta: string | null } | null;
  technicianName: string | null;
};

type Planning = {
  date: string;
  technicianId: string | null;
  appointments: Apt[];
  confirmed: (Intervento & { distanceKm: number | null })[];
  available: (Intervento & { distanceKm: number | null })[];
  toPlan: (Intervento & { distanceKm: number | null })[];
  nearby: (Intervento & { distanceKm: number | null })[];
};

type SuggestStop = {
  interventoId: number;
  clientId: number;
  startMin: number;
  durationMin: number;
  reason: string;
};

function PlanningContent() {
  const sp = useSearchParams();
  const [date, setDate] = useState(toLocalDateKey(new Date()));
  const [technicianId, setTechnicianId] = useState(sp.get("technicianId") ?? "");
  const [data, setData] = useState<Planning | null>(null);
  const [suggest, setSuggest] = useState<SuggestStop[] | null>(null);
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { users } = useOrgUsers();

  const load = useCallback(() => {
    const p = new URLSearchParams({ date });
    if (technicianId) p.set("technicianId", technicianId);
    fetch(`/api/planning?${p}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [date, technicianId]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const nextSlotFor = (durationMin: number) =>
    nextFreeStartMin(data?.appointments ?? [], durationMin);

  async function schedule(i: Intervento, startMin: number | null) {
    if (!technicianId) {
      toast.error("Seleziona un tecnico");
      return;
    }
    if (startMin == null) {
      toast.error("Non c'è più spazio nella giornata lavorativa");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: i.clientId,
          interventoId: i.id,
          technicianId,
          date,
          startMin,
          durationMin: i.durataStimata,
          tipo: i.tipo === "ASSISTENZA" ? "PRONTO_INTERVENTO" : i.tipo,
          stato: "PIANIFICATO",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Impossibile creare l'appuntamento");
        return;
      }
      toast.success(`Inserito alle ${minutesToHHMM(startMin)}`);
      load();
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setBusy(false);
    }
  }

  async function suggestDay() {
    if (!technicianId) {
      toast.error("Seleziona un tecnico");
      return;
    }
    const res = await fetch("/api/planning/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ technicianId, date }),
    });
    const json = await res.json();
    setSuggestMsg(json.message ?? "");
    setSuggest(Array.isArray(json.suggestedStops) ? json.suggestedStops : []);
  }

  async function applySuggest() {
    if (!suggest?.length || !technicianId) return;
    for (const stop of suggest) {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: stop.clientId,
          interventoId: stop.interventoId,
          technicianId,
          date,
          startMin: stop.startMin,
          durationMin: stop.durationMin,
          stato: "PIANIFICATO",
          tipo: "MANUTENZIONE",
        }),
      });
      if (!res.ok) {
        toast.error(`Errore su ${minutesToHHMM(stop.startMin)}`);
        break;
      }
    }
    toast.success("Proposta applicata");
    setSuggest(null);
    load();
  }

  const candidateLists = useMemo(
    () => [
      { title: "Confermati", items: data?.confirmed ?? [] },
      { title: "Disponibili", items: data?.available ?? [] },
      { title: "Vicini / da pianificare", items: data?.nearby.length ? data.nearby : data?.toPlan ?? [] },
    ],
    [data]
  );

  return (
    <div className="p-5 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title="Pianificazione"
        subtitle={formatItalianDateLong(date)}
        action={
          <Link href={`/mappa?date=${date}&technicianId=${technicianId}`} className="btn btn-ghost">
            Vedi percorso
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          className="field w-44"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSuggest(null);
            setSuggestMsg(null);
          }}
        />
        <select
          className="field w-56"
          value={technicianId}
          onChange={(e) => {
            setTechnicianId(e.target.value);
            setSuggest(null);
            setSuggestMsg(null);
          }}
        >
          <option value="">Tecnico…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{technicianDisplayName(u)}</option>
          ))}
        </select>
        <button type="button" className="btn btn-ghost" onClick={() => void suggestDay()}>
          Suggerisci giornata
        </button>
      </div>

      {suggestMsg && (
        <div className="card p-3 space-y-2">
          <p className="text-sm text-slate-600">{suggestMsg}</p>
          {suggest && suggest.length > 0 && (
            <>
              <ol className="text-sm space-y-1">
                {suggest.map((s) => (
                  <li key={s.interventoId}>
                    <span className="font-semibold tabular-nums text-teal-800 w-14 inline-block">
                      {minutesToHHMM(s.startMin)}
                    </span>
                    {s.reason} · {s.durationMin} min
                  </li>
                ))}
              </ol>
              <button type="button" className="btn btn-primary text-xs" onClick={() => void applySuggest()}>
                Applica in calendario
              </button>
            </>
          )}
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm">Giornata già pianificata</div>
        {(data?.appointments.length ?? 0) === 0 ? (
          <p className="p-4 text-sm text-slate-400">Nessun appuntamento</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data!.appointments.map((a) => (
              <div key={a.id} className="px-4 py-2.5 flex gap-3 text-sm">
                <span className="tabular-nums font-semibold w-14 text-teal-800">{minutesToHHMM(a.startMin)}</span>
                <span className="font-medium">
                  {a.client ? `${a.client.cognome} ${a.client.nome}` : "—"}
                </span>
                <span className="text-slate-500">{a.client?.citta}</span>
                <span className="text-slate-400 ml-auto">{a.durationMin} min</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {candidateLists.map(({ title, items }) => (
          <div key={title} className="card overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 text-sm font-semibold">{title}</div>
            {items.length === 0 ? (
              <p className="p-4 text-xs text-slate-400">Vuoto</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((i) => {
                  const start = nextSlotFor(i.durataStimata);
                  return (
                    <div key={i.id} className="px-3 py-2 text-sm">
                      <div className="font-medium truncate">{i.client?.displayName}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        {i.client?.citta}
                        {i.distanceKm != null && <span>{i.distanceKm.toFixed(1)} km</span>}
                        <span>{TIPO_LABEL[i.tipo]}</span>
                        <StatusBadge stato={i.stato} />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary text-[11px] mt-1 py-1"
                        disabled={busy || start == null}
                        onClick={() => void schedule(i, start)}
                      >
                        {start == null ? "Giornata piena" : `Metti alle ${minutesToHHMM(start)}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PianificazionePage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Caricamento…</div>}>
      <PlanningContent />
    </Suspense>
  );
}
