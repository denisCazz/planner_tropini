"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { Users, Loader2, List } from "lucide-react";
import { toast } from "sonner";
import type { Client, Settings, RouteResult, StatoCliente } from "@/types/client";
import RoutePanel from "@/components/RoutePanel";
import MapTopBar from "@/components/mappa/MapTopBar";
import ClientListPanel from "@/components/mappa/ClientListPanel";
import NearestRoutePrompt from "@/components/mappa/NearestRoutePrompt";

const ClientMap = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
      <Loader2 size={24} className="animate-spin text-indigo-400" />
    </div>
  ),
});

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function MapLegend() {
  return (
    <div className="absolute bottom-4 left-4 z-[400] hidden sm:block pointer-events-none">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/80 px-3 py-2.5 space-y-1.5">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Legenda
        </p>
        {[
          { color: "bg-emerald-500", label: "Attivo" },
          { color: "bg-slate-400", label: "Inattivo" },
          { color: "bg-amber-500", label: "Non categorizzato" },
          { color: "bg-red-500", label: "Urgente" },
          { color: "bg-indigo-600", label: "Selezionato ✓" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${color} ring-2 ring-white shadow-sm`} />
            <span className="text-[11px] text-slate-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MappaPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [totalUrgenti, setTotalUrgenti] = useState(0);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [search, setSearch] = useState("");
  const [statoFilter, setStatoFilter] = useState<StatoCliente | "">("");
  const [urgenteOnly, setUrgenteOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [nearestPrompt, setNearestPrompt] = useState<Client | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSelectedSizeRef = useRef(0);

  const filteredIdSet = useMemo(() => new Set(filtered.map((c) => c.id)), [filtered]);

  const mapClients = useMemo(() => {
    const byId = new Map<number, Client>();
    for (const c of filtered) byId.set(c.id, c);
    for (const id of selectedIds) {
      const c = clients.find((x) => x.id === id);
      if (c) byId.set(id, c);
    }
    return Array.from(byId.values());
  }, [clients, filtered, selectedIds]);

  useEffect(() => {
    Promise.all([
      fetch("/api/clients?slim=1").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/settings").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([clientsData, settingsData]: [Client[], Settings | null]) => {
        const data: Client[] = Array.isArray(clientsData) ? clientsData : [];
        setClients(data);
        setFiltered(data);
        setTotalUrgenti(data.filter((c: Client) => c.urgente).length);
        setSettings(settingsData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const reloadClients = useCallback(() => {
    fetch("/api/clients?slim=1")
      .then((r) => (r.ok ? r.json() : []))
      .then((clientsData: Client[]) => {
        const data: Client[] = Array.isArray(clientsData) ? clientsData : [];
        setClients(data);
        setTotalUrgenti(data.filter((c) => c.urgente).length);
      })
      .catch(() => {});
  }, []);

  const nearestCount = Math.min(20, Math.max(1, settings?.nearestNeighbours ?? 4));

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      let result = clients;
      if (statoFilter) result = result.filter((c) => c.stato === statoFilter);
      if (urgenteOnly) result = result.filter((c) => c.urgente);
      if (search) {
        const q = search.toLowerCase();
        result = result.filter(
          (c) =>
            c.nome.toLowerCase().includes(q) ||
            c.cognome.toLowerCase().includes(q) ||
            (c.indirizzo ?? "").toLowerCase().includes(q) ||
            (c.citta ?? "").toLowerCase().includes(q) ||
            (c.cap ?? "").toLowerCase().includes(q) ||
            (c.telefono ?? "").toLowerCase().includes(q) ||
            (c.telefono2 ?? "").toLowerCase().includes(q) ||
            (c.marcaStufa ?? "").toLowerCase().includes(q) ||
            (c.modelloStufa ?? "").toLowerCase().includes(q)
        );
      }
      result = [...result].sort((a, b) => {
        const cmp = (a.cognome ?? "").localeCompare(b.cognome ?? "", "it");
        return cmp !== 0 ? cmp : (a.nome ?? "").localeCompare(b.nome ?? "", "it");
      });
      setFiltered(result);
    }, 200);
  }, [search, statoFilter, urgenteOnly, clients]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setRouteResult(null);
  }, []);

  // Popup vicini: solo al passaggio da 0 a 1 cliente selezionato
  useEffect(() => {
    const prev = prevSelectedSizeRef.current;
    const curr = selectedIds.size;
    if (prev === 0 && curr === 1) {
      const onlyId = [...selectedIds][0];
      const client = clients.find((c) => c.id === onlyId);
      if (client) {
        if (client.lat != null && client.lng != null) {
          setNearestPrompt(client);
        } else {
          toast.error(`${client.cognome} ${client.nome} non ha coordinate sulla mappa`);
        }
      }
    }
    if (curr === 0) setNearestPrompt(null);
    prevSelectedSizeRef.current = curr;
  }, [selectedIds, clients]);

  const focusClient = useCallback((id: number) => {
    setFocusedId(id);
  }, []);

  async function calculateRoute(idsArg?: Set<number>) {
    const ids = idsArg ?? selectedIds;
    if (ids.size < 2) {
      toast.error("Seleziona almeno 2 clienti");
      return;
    }
    setCalculating(true);
    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientIds: Array.from(ids) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRouteResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore calcolo percorso");
    } finally {
      setCalculating(false);
    }
  }

  const applyVisitOrder = useCallback(async (visitOrder: number[]) => {
    if (visitOrder.length < 2) return;
    setCalculating(true);
    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientIds: visitOrder, visitOrder }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRouteResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore aggiornamento percorso");
    } finally {
      setCalculating(false);
    }
  }, []);

  function clearSelection() {
    setSelectedIds(new Set());
    setRouteResult(null);
    setNearestPrompt(null);
  }

  const runNearestRoute = useCallback(
    async (pivot: Client) => {
      if (pivot.lat == null || pivot.lng == null) {
        toast.error("Cliente senza coordinate — verifica l'indirizzo");
        return;
      }
      const others = clients.filter((c) => c.id !== pivot.id && c.lat !== null && c.lng !== null);
      if (others.length === 0) {
        toast.error("Nessun altro cliente con coordinate");
        return;
      }
      const sorted = [...others].sort(
        (a, b) =>
          haversineKm(pivot.lat!, pivot.lng!, a.lat!, a.lng!) -
          haversineKm(pivot.lat!, pivot.lng!, b.lat!, b.lng!)
      );
      const nearest = sorted.slice(0, nearestCount);
      const ids = new Set([pivot.id, ...nearest.map((c) => c.id)]);
      setSelectedIds(ids);
      setRouteResult(null);
      setNearestPrompt(null);
      setSheetOpen(false);
      toast.info(`Percorso con ${pivot.cognome} + ${nearest.length} clienti vicini...`);
      await calculateRoute(ids);
    },
    [clients, nearestCount]
  );

  const clientsOnMap = mapClients.filter((c) => c.lat !== null && c.lng !== null).length;
  const sharePhone = process.env.NEXT_PUBLIC_SHARE_PHONE;

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-100">
      <MapTopBar
        search={search}
        onSearchChange={setSearch}
        statoFilter={statoFilter}
        onStatoFilterChange={setStatoFilter}
        urgenteOnly={urgenteOnly}
        onUrgenteOnlyChange={setUrgenteOnly}
        selectedCount={selectedIds.size}
        clientsOnMap={clientsOnMap}
        totalUrgenti={totalUrgenti}
        filteredCount={filtered.length}
        calculating={calculating}
        onCalculateRoute={() => calculateRoute()}
        onClearSelection={clearSelection}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="flex flex-1 min-h-0">
        {sidebarOpen && (
          <aside className="hidden md:flex w-[19rem] shrink-0 border-r border-slate-200/80">
            <ClientListPanel
              filtered={filtered}
              clients={clients}
              selectedIds={selectedIds}
              filteredIdSet={filteredIdSet}
              onFocus={focusClient}
              onToggleSelect={toggleSelect}
            />
          </aside>
        )}

        <div className="flex-1 relative min-w-0">
          {loading && (
            <div className="absolute inset-0 z-[500] bg-slate-50/90 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={32} className="text-indigo-500 animate-spin" />
                <span className="text-sm text-slate-500">Caricamento clienti...</span>
              </div>
            </div>
          )}

          {calculating && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-2 bg-white/95 backdrop-blur-sm shadow-lg rounded-full px-4 py-2 border border-indigo-100">
              <Loader2 size={16} className="text-indigo-600 animate-spin" />
              <span className="text-sm font-medium text-slate-800">Calcolo percorso...</span>
            </div>
          )}

          <ClientMap
            clients={mapClients}
            settings={settings}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            routeResult={routeResult}
            focusedId={focusedId}
          />

          <MapLegend />

          <button
            type="button"
            className="md:hidden absolute bottom-20 right-4 z-[600] flex items-center gap-2 bg-indigo-600 active:bg-indigo-700 text-white shadow-xl shadow-indigo-600/25 rounded-2xl px-4 py-3 text-sm font-semibold"
            onClick={() => setSheetOpen(true)}
          >
            <List size={16} />
            {selectedIds.size > 0
              ? `${selectedIds.size} selezionat${selectedIds.size === 1 ? "o" : "i"}`
              : `Clienti (${filtered.length})`}
          </button>

          {routeResult && (
            <RoutePanel
              result={routeResult}
              onClose={() => setRouteResult(null)}
              sharePhone={sharePhone}
              settings={settings}
              onVisitsLogged={reloadClients}
              onVisitOrderChange={applyVisitOrder}
            />
          )}
        </div>
      </div>

      {nearestPrompt && (
        <NearestRoutePrompt
          client={nearestPrompt}
          nearestCount={nearestCount}
          onConfirm={() => runNearestRoute(nearestPrompt)}
          onDismiss={() => setNearestPrompt(null)}
        />
      )}

      {sheetOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-[700] bg-slate-900/40 backdrop-blur-[2px]"
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="md:hidden fixed inset-x-0 bottom-14 z-[800] bg-slate-50 rounded-t-2xl shadow-2xl border-t border-slate-200 flex flex-col"
            style={{ height: "65vh" }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>
            <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-indigo-600" />
                <span className="font-semibold text-sm text-slate-900">
                  Clienti ({filtered.length})
                </span>
              </div>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    calculateRoute();
                    setSheetOpen(false);
                  }}
                  disabled={calculating}
                  className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg"
                >
                  Calcola percorso
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <ClientListPanel
                filtered={filtered}
                clients={clients}
                selectedIds={selectedIds}
                filteredIdSet={filteredIdSet}
                onFocus={(id) => {
                  focusClient(id);
                  setSheetOpen(false);
                }}
                onToggleSelect={toggleSelect}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
