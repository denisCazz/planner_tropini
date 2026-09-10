"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { Intervento, StatoIntervento, TipoIntervento, PrioritaIntervento } from "@/types/client";
import { STATO_INTERVENTO, TIPO_INTERVENTO, PRIORITA_INTERVENTO, STATO_META, TIPO_LABEL } from "@/lib/status";
import { StatusBadge, PriorityBadge } from "@/components/ui/StatusBadge";
import PageHeader from "@/components/ui/PageHeader";
import AvailabilityForm from "@/components/planning/AvailabilityForm";
import { useOrgUsers } from "@/lib/useOrgUsers";
import { technicianDisplayName } from "@/lib/roles";

function InterventiContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Intervento[]>([]);
  const [stato, setStato] = useState(searchParams.get("stato") ?? "");
  const [tipo, setTipo] = useState("");
  const [priorita, setPriorita] = useState(searchParams.get("priorita") ?? "");
  const [selected, setSelected] = useState<Intervento | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { users } = useOrgUsers();

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ open: stato ? "0" : "1", limit: "400" });
    if (stato) p.set("stato", stato);
    else p.set("open", "1");
    if (tipo) p.set("tipo", tipo);
    if (priorita) p.set("priorita", priorita);
    try {
      const res = await fetch(`/api/interventi?${p}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Impossibile caricare gli interventi");
      }
      const data = await res.json();
      const list: Intervento[] = Array.isArray(data) ? data : [];
      setItems(list);
      setLoadError(null);
      const focus = searchParams.get("focus");
      if (focus) {
        const found = list.find((i) => String(i.id) === focus) ?? null;
        setSelected(found);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Impossibile caricare gli interventi");
    } finally {
      setLoading(false);
    }
  }, [stato, tipo, priorita, searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchStato(id: number, next: StatoIntervento) {
    const res = await fetch(`/api/interventi/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stato: next }),
    });
    if (!res.ok) {
      toast.error("Impossibile aggiornare lo stato");
      return;
    }
    const updated = await res.json();
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
    setSelected((s) => (s?.id === id ? { ...s, ...updated } : s));
  }

  return (
    <div className="p-5 max-w-7xl mx-auto">
      <PageHeader title="Interventi" subtitle="Coda operativa: contatto → disponibilità → pianificazione" />

      <div className="flex flex-wrap gap-2 mb-4">
        <select className="field w-48" value={stato} onChange={(e) => setStato(e.target.value)}>
          <option value="">Aperti</option>
          {STATO_INTERVENTO.map((s) => (
            <option key={s} value={s}>{STATO_META[s].label}</option>
          ))}
        </select>
        <select className="field w-44" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Tutti i tipi</option>
          {TIPO_INTERVENTO.map((t) => (
            <option key={t} value={t}>{TIPO_LABEL[t as TipoIntervento]}</option>
          ))}
        </select>
        <select className="field w-36" value={priorita} onChange={(e) => setPriorita(e.target.value)}>
          <option value="">Priorità</option>
          {PRIORITA_INTERVENTO.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <Link href="/mappa" className="btn btn-ghost">Mappa</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 card overflow-hidden">
          {loadError && items.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">
              <p>{loadError}</p>
              <button type="button" className="btn btn-ghost mt-3" onClick={() => void load()}>
                Riprova
              </button>
            </div>
          ) : loading ? (
            <p className="p-6 text-sm text-slate-400">Caricamento…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">Nessun intervento</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto panel-scroll">
              {items.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 ${selected?.id === i.id ? "bg-teal-50" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{i.client?.displayName}</span>
                    <span className="ml-auto"><StatusBadge stato={i.stato} /></span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{i.client?.citta ?? "—"}</span>
                    <span>· {TIPO_LABEL[i.tipo]}</span>
                    <PriorityBadge priorita={i.priorita} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="card p-8 text-sm text-slate-400">Seleziona un intervento</div>
          ) : (
            <div className="card p-4 space-y-3">
              <div>
                <div className="text-lg font-semibold">{selected.client?.displayName}</div>
                <div className="text-sm text-slate-500">
                  {selected.client?.indirizzo} {selected.client?.citta}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge stato={selected.stato} />
                <PriorityBadge priorita={selected.priorita} />
                <span className="text-xs text-slate-500">{selected.durataStimata} min</span>
              </div>
              <p className="text-sm">{selected.descrizione || "Nessuna descrizione"}</p>
              {selected.technicianName && (
                <p className="text-xs text-slate-500">Tecnico: {selected.technicianName}</p>
              )}

              <div className="flex flex-wrap gap-2">
                {selected.client?.telefono && (
                  <a className="btn btn-primary text-xs" href={`tel:${selected.client.telefono}`}>
                    <Phone size={13} /> Chiama
                  </a>
                )}
                <Link href={`/clienti/${selected.clientId}`} className="btn btn-ghost text-xs">
                  Vedi cliente
                </Link>
                <Link href={`/pianificazione?interventoId=${selected.id}`} className="btn btn-ghost text-xs">
                  Pianifica
                </Link>
                <Link href={`/mappa?focus=${selected.id}`} className="btn btn-ghost text-xs">
                  <MapPin size={13} /> Mappa
                </Link>
              </div>

              <label className="block text-xs font-medium text-slate-500">
                Cambia stato
                <select
                  className="field mt-1"
                  value={selected.stato}
                  onChange={(e) => void patchStato(selected.id, e.target.value as StatoIntervento)}
                >
                  {STATO_INTERVENTO.map((s) => (
                    <option key={s} value={s}>{STATO_META[s].label}</option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-500">
                Assegna tecnico
                <select
                  className="field mt-1"
                  value={selected.technicianId ?? ""}
                  onChange={async (e) => {
                    const res = await fetch(`/api/interventi/${selected.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ technicianId: e.target.value || null }),
                    });
                    if (res.ok) {
                      const updated = await res.json();
                      setSelected(updated);
                      toast.success("Tecnico aggiornato");
                    }
                  }}
                >
                  <option value="">Nessuno</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{technicianDisplayName(u)}</option>
                  ))}
                </select>
              </label>

              <div className="border-t border-slate-100 pt-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Disponibilità (durante la chiamata)
                </div>
                <AvailabilityForm
                  clientId={selected.clientId}
                  interventoId={selected.id}
                  onSaved={() => void load()}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InterventiPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Caricamento…</div>}>
      <InterventiContent />
    </Suspense>
  );
}
