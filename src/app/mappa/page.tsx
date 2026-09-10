"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Phone, Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Client, Intervento, StatoIntervento } from "@/types/client";
import { STATO_INTERVENTO, STATO_META, TIPO_LABEL } from "@/lib/status";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { haversineKm } from "@/lib/geo";
import { useOrgUsers } from "@/lib/useOrgUsers";
import { technicianDisplayName } from "@/lib/roles";
import { toLocalDateKey } from "@/lib/dates";

const ClientMap = dynamic(() => import("@/components/map/ClientMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-slate-400">
      <Loader2 className="animate-spin" />
    </div>
  ),
});

const InterventionMap = dynamic(() => import("@/components/map/InterventionMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-slate-400">
      <Loader2 className="animate-spin" />
    </div>
  ),
});

function displayName(c: Pick<Client, "nome" | "cognome" | "ragioneSociale">) {
  const person = [c.cognome, c.nome].filter(Boolean).join(" ").trim();
  if (c.ragioneSociale && person) return `${c.ragioneSociale} (${person})`;
  return c.ragioneSociale || person || "Cliente";
}

function MappaContent() {
  const sp = useSearchParams();
  const [layer, setLayer] = useState<"clienti" | "interventi">("clienti");
  const [clients, setClients] = useState<Client[]>([]);
  const [clientTotal, setClientTotal] = useState(0);
  const [items, setItems] = useState<Intervento[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stato, setStato] = useState(sp.get("stato") ?? "");
  const [tipo, setTipo] = useState("");
  const [citta, setCitta] = useState("");
  const [tech, setTech] = useState(sp.get("technicianId") ?? "");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [radiusKm, setRadiusKm] = useState("");
  const [date, setDate] = useState(sp.get("date") ?? toLocalDateKey(new Date()));
  const [routeIds, setRouteIds] = useState<number[]>([]);
  const [settings, setSettings] = useState<{ startLat: number; startLng: number; startLabel: string } | null>(null);
  const { users } = useOrgUsers();
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => setDebouncedQ(q), 300);
    return () => {
      if (qTimer.current) clearTimeout(qTimer.current);
    };
  }, [q]);

  const loadClients = useCallback(async () => {
    const p = new URLSearchParams({ slim: "1", hasCoords: "1", limit: "5000" });
    if (stato) p.set("stato", stato);
    if (debouncedQ) p.set("search", debouncedQ);
    try {
      const res = await fetch(`/api/clients?${p}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Impossibile caricare i clienti in mappa");
      }
      const data = await res.json();
      const list: Client[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setClients(list);
      setClientTotal(typeof data?.total === "number" ? data.total : list.length);
      setLoadError(null);
      const focus = sp.get("focus");
      if (focus) setSelectedId(Number(focus));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Impossibile caricare i clienti in mappa");
    }
  }, [stato, debouncedQ, sp]);

  const loadInterventi = useCallback(async () => {
    const p = new URLSearchParams({ open: "1", hasCoords: "1", limit: "800" });
    if (stato) {
      p.delete("open");
      p.set("stato", stato);
    }
    if (tipo) p.set("tipo", tipo);
    if (citta) p.set("citta", citta);
    if (tech) p.set("technicianId", tech);
    if (debouncedQ) p.set("search", debouncedQ);
    try {
      const res = await fetch(`/api/interventi?${p}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Impossibile caricare gli interventi in mappa");
      }
      const data = await res.json();
      const list: Intervento[] = Array.isArray(data) ? data : [];
      setItems(list);
      setLoadError(null);
      const focus = sp.get("focus");
      if (focus) setSelectedId(Number(focus));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Impossibile caricare gli interventi in mappa");
    }
  }, [stato, tipo, citta, tech, debouncedQ, sp]);

  useEffect(() => {
    if (layer === "clienti") void loadClients();
    else void loadInterventi();
  }, [layer, loadClients, loadInterventi]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  const origin = settings ? { lat: settings.startLat, lng: settings.startLng } : { lat: 44.7089, lng: 7.6617 };

  const filteredClients = useMemo(() => {
    const km = parseFloat(radiusKm);
    let list = clients;
    if (citta.trim()) {
      const needle = citta.trim().toLowerCase();
      list = list.filter((c) => (c.citta ?? "").toLowerCase().includes(needle));
    }
    if (!Number.isFinite(km) || km <= 0) return list;
    return list.filter((c) => {
      if (c.lat == null || c.lng == null) return false;
      return haversineKm(origin.lat, origin.lng, c.lat, c.lng) <= km;
    });
  }, [clients, radiusKm, origin.lat, origin.lng, citta]);

  const filteredInterventi = useMemo(() => {
    const km = parseFloat(radiusKm);
    if (!Number.isFinite(km) || km <= 0) return items;
    return items.filter((i) => {
      if (i.client?.lat == null || i.client.lng == null) return false;
      return haversineKm(origin.lat, origin.lng, i.client.lat, i.client.lng) <= km;
    });
  }, [items, radiusKm, origin.lat, origin.lng]);

  const selectedClient = filteredClients.find((c) => c.id === selectedId) ?? null;
  const selectedIntervento = filteredInterventi.find((i) => i.id === selectedId) ?? null;

  async function changeStato(next: StatoIntervento) {
    if (!selectedIntervento) return;
    const res = await fetch(`/api/interventi/${selectedIntervento.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stato: next }),
    });
    if (!res.ok) {
      toast.error("Stato non aggiornato");
      return;
    }
    toast.success("Stato aggiornato");
    void loadInterventi();
  }

  async function loadRoute() {
    if (!tech) {
      toast.error("Seleziona un tecnico");
      return;
    }
    const res = await fetch(`/api/planning?date=${date}&technicianId=${tech}`);
    const data = await res.json();
    const ids = (data.appointments ?? [])
      .map((a: { interventoId?: number | null }) => a.interventoId)
      .filter((id: number | null | undefined): id is number => typeof id === "number");
    setRouteIds(ids);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[300px_1fr]">
        <aside className="border-r border-slate-200 bg-white flex flex-col min-h-0">
          <div className="p-3 border-b border-slate-100 space-y-2 shrink-0">
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                className={`flex-1 rounded-md py-1.5 ${layer === "clienti" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
                onClick={() => {
                  setLayer("clienti");
                  setSelectedId(null);
                  setStato("");
                }}
              >
                Clienti
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md py-1.5 ${layer === "interventi" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
                onClick={() => {
                  setLayer("interventi");
                  setSelectedId(null);
                  setStato("");
                }}
              >
                Interventi
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <SlidersHorizontal size={12} /> Filtri
            </div>
            <input className="field" placeholder="Cerca cliente o città" value={q} onChange={(e) => setQ(e.target.value)} />
            {layer === "clienti" ? (
              <label className="block text-[11px] font-medium text-slate-500">
                Stato
                <select className="field mt-1" value={stato} onChange={(e) => setStato(e.target.value)}>
                  <option value="">Tutti</option>
                  <option value="ATTIVO">Attivi</option>
                  <option value="INATTIVO">Inattivi</option>
                  <option value="PROSPECT">Prospect</option>
                </select>
              </label>
            ) : (
              <>
                <label className="block text-[11px] font-medium text-slate-500">
                  Stato
                  <select className="field mt-1" value={stato} onChange={(e) => setStato(e.target.value)}>
                    <option value="">Aperti</option>
                    {STATO_INTERVENTO.map((s) => (
                      <option key={s} value={s}>{STATO_META[s].label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] font-medium text-slate-500">
                  Tipo
                  <select className="field mt-1" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                    <option value="">Tutti</option>
                    {Object.entries(TIPO_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] font-medium text-slate-500">
                  Tecnico
                  <select className="field mt-1" value={tech} onChange={(e) => setTech(e.target.value)}>
                    <option value="">Tutti</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{technicianDisplayName(u)}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label className="block text-[11px] font-medium text-slate-500">
              Città
              <input className="field mt-1" placeholder="es. Carmagnola" value={citta} onChange={(e) => setCitta(e.target.value)} />
            </label>
            <label className="block text-[11px] font-medium text-slate-500">
              Raggio km (da sede)
              <input className="field mt-1" inputMode="numeric" placeholder="es. 20" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
            </label>
            {layer === "interventi" && (
              <div className="flex gap-2">
                <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
                <button type="button" className="btn btn-ghost text-xs shrink-0" onClick={() => void loadRoute()}>
                  Percorso
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-400">
              {layer === "clienti"
                ? `${filteredClients.length} clienti in mappa${clientTotal > filteredClients.length ? ` · ${clientTotal} con GPS` : ""}`
                : `${filteredInterventi.length} interventi in mappa`}
            </p>
            {loadError && <p className="text-xs text-red-600">{loadError}</p>}
          </div>
          <div className="flex-1 overflow-y-auto panel-scroll">
            {layer === "clienti"
              ? filteredClients.slice(0, 400).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-slate-100 ${
                      selectedId === c.id ? "bg-teal-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-medium text-sm truncate">{displayName(c)}</div>
                    <div className="text-xs text-slate-500">{c.citta ?? "—"}</div>
                  </button>
                ))
              : filteredInterventi.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setSelectedId(i.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-slate-100 ${
                      selectedId === i.id ? "bg-teal-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{i.client?.displayName}</span>
                      <span className="ml-auto"><StatusBadge stato={i.stato} /></span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {i.client?.citta ?? "—"} · {TIPO_LABEL[i.tipo]}
                    </div>
                  </button>
                ))}
            {layer === "clienti" && filteredClients.length === 0 && (
              <p className="p-4 text-sm text-slate-400">Nessun cliente geolocalizzato</p>
            )}
            {layer === "interventi" && filteredInterventi.length === 0 && (
              <p className="p-4 text-sm text-slate-400">Nessun intervento geolocalizzato</p>
            )}
          </div>
        </aside>
        <div className="relative min-h-[50vh]">
          {layer === "clienti" ? (
            <ClientMap
              items={filteredClients}
              selectedId={selectedId}
              onSelect={setSelectedId}
              start={settings ? { lat: settings.startLat, lng: settings.startLng, label: settings.startLabel } : undefined}
            />
          ) : (
            <InterventionMap
              items={filteredInterventi}
              selectedId={selectedId}
              onSelect={setSelectedId}
              routeIds={routeIds}
              start={settings ? { lat: settings.startLat, lng: settings.startLng, label: settings.startLabel } : undefined}
            />
          )}
          {layer === "clienti" && selectedClient && (
            <div className="absolute bottom-4 left-4 right-4 md:left-auto md:w-80 card p-4 shadow-lg">
              <div className="font-semibold">{displayName(selectedClient)}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {selectedClient.indirizzo}<br />
                {selectedClient.citta}
              </div>
              {selectedClient.telefono && (
                <a href={`tel:${selectedClient.telefono}`} className="text-sm text-teal-700 mt-1 inline-flex items-center gap-1">
                  <Phone size={13} /> {selectedClient.telefono}
                </a>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {selectedClient.telefono && (
                  <a className="btn btn-primary text-xs py-1" href={`tel:${selectedClient.telefono}`}>Chiama</a>
                )}
                <Link className="btn btn-ghost text-xs py-1" href={`/clienti/${selectedClient.id}`}>Vedi cliente</Link>
              </div>
            </div>
          )}
          {layer === "interventi" && selectedIntervento && (
            <div className="absolute bottom-4 left-4 right-4 md:left-auto md:w-80 card p-4 shadow-lg">
              <div className="font-semibold">{selectedIntervento.client?.displayName}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {selectedIntervento.client?.indirizzo}<br />
                {selectedIntervento.client?.citta}
              </div>
              {selectedIntervento.client?.telefono && (
                <a href={`tel:${selectedIntervento.client.telefono}`} className="text-sm text-teal-700 mt-1 inline-flex items-center gap-1">
                  <Phone size={13} /> {selectedIntervento.client.telefono}
                </a>
              )}
              <div className="mt-2 text-sm">
                {TIPO_LABEL[selectedIntervento.tipo]} · {selectedIntervento.durataStimata} min
                {selectedIntervento.technicianName ? ` · ${selectedIntervento.technicianName}` : ""}
              </div>
              <div className="mt-2"><StatusBadge stato={selectedIntervento.stato} /></div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {selectedIntervento.client?.telefono && (
                  <a className="btn btn-primary text-xs py-1" href={`tel:${selectedIntervento.client.telefono}`}>Chiama</a>
                )}
                <Link className="btn btn-ghost text-xs py-1" href={`/clienti/${selectedIntervento.clientId}`}>Vedi cliente</Link>
                <Link className="btn btn-ghost text-xs py-1" href={`/pianificazione?interventoId=${selectedIntervento.id}`}>Pianifica</Link>
              </div>
              <select
                className="field mt-2 text-xs"
                value={selectedIntervento.stato}
                onChange={(e) => void changeStato(e.target.value as StatoIntervento)}
              >
                {STATO_INTERVENTO.map((s) => (
                  <option key={s} value={s}>{STATO_META[s].label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MappaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Caricamento mappa…</div>}>
      <MappaContent />
    </Suspense>
  );
}
