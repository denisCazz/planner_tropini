"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { Users, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Client, Settings, RouteResult, RouteHistoryEntry, StatoCliente } from "@/types/client";
import RoutePanel from "@/components/RoutePanel";
import MapTopBar from "@/components/mappa/MapTopBar";
import ClientListPanel from "@/components/mappa/ClientListPanel";
import NearestRoutePrompt from "@/components/mappa/NearestRoutePrompt";
import RouteHistoryPanel from "@/components/mappa/RouteHistoryPanel";

const ClientMap = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-50">
      <Loader2 size={22} className="animate-spin text-indigo-500" />
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

type MobilePanel = "clients" | "history" | null;
type DesktopPanel = "clients" | "history";

export default function MappaPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [search, setSearch] = useState("");
  const [statoFilter, setStatoFilter] = useState<StatoCliente | "">("");
  const [urgenteOnly, setUrgenteOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [desktopPanel, setDesktopPanel] = useState<DesktopPanel>("clients");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [nearestPrompt, setNearestPrompt] = useState<Client | null>(null);
  const [routeHistory, setRouteHistory] = useState<RouteHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSelectedSizeRef = useRef(0);

  const mapClients = useMemo(() => {
    // Con selezione o percorso: sulla mappa solo le tappe del percorso
    if (selectedIds.size > 0 || routeResult) {
      const ids =
        routeResult != null
          ? routeResult.steps.map((s) => s.client.id)
          : [...selectedIds];

      const byId = new Map<number, Client>();
      for (const id of ids) {
        const fromStep = routeResult?.steps.find((s) => s.client.id === id)?.client;
        const c = fromStep ?? clients.find((x) => x.id === id);
        if (c) byId.set(id, c);
      }
      return Array.from(byId.values());
    }

    return filtered;
  }, [clients, filtered, selectedIds, routeResult]);

  const mapFocusMode = selectedIds.size > 0 || routeResult != null;

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    fetch("/api/route-history")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: RouteHistoryEntry[]) => setRouteHistory(Array.isArray(data) ? data : []))
      .catch(() => setRouteHistory([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/clients?slim=1").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/settings").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([clientsData, settingsData]: [Client[], Settings | null]) => {
        const data: Client[] = Array.isArray(clientsData) ? clientsData : [];
        setClients(data);
        setFiltered(data);
        setSettings(settingsData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    loadHistory();
  }, [loadHistory]);

  const reloadClients = useCallback(() => {
    fetch("/api/clients?slim=1")
      .then((r) => (r.ok ? r.json() : []))
      .then((clientsData: Client[]) => {
        setClients(Array.isArray(clientsData) ? clientsData : []);
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
          toast.error("Cliente senza coordinate sulla mappa");
        }
      }
    }
    if (curr === 0) setNearestPrompt(null);
    prevSelectedSizeRef.current = curr;
  }, [selectedIds, clients]);

  const focusClient = useCallback((id: number) => {
    setFocusedId(id);
  }, []);

  async function saveToHistory(data: RouteResult, clientIds: number[]) {
    try {
      const res = await fetch("/api/route-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientIds,
          totalDistance: data.totalDistance,
          totalDuration: data.totalDuration,
        }),
      });
      if (res.ok) {
        const entry = await res.json();
        setRouteHistory((prev) => [entry, ...prev].slice(0, 50));
      }
    } catch {
      /* storico opzionale */
    }
  }

  async function calculateRoute(
    idsArg?: Set<number>,
    options?: { visitOrder?: number[]; saveHistory?: boolean }
  ) {
    const ids = idsArg ?? selectedIds;
    if (ids.size < 2) {
      toast.error("Seleziona almeno 2 clienti");
      return;
    }
    setCalculating(true);
    try {
      const clientIds = options?.visitOrder ?? Array.from(ids);
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientIds,
          visitOrder: options?.visitOrder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRouteResult(data);
      if (options?.saveHistory !== false && !options?.visitOrder) {
        const orderIds = data.steps.map((s: { client: Client }) => s.client.id);
        await saveToHistory(data, orderIds);
      }
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
        toast.error("Cliente senza coordinate");
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
      setMobilePanel(null);
      await calculateRoute(ids);
    },
    [clients, nearestCount]
  );

  async function restoreFromHistory(entry: RouteHistoryEntry) {
    setSelectedIds(new Set(entry.clientIds));
    setMobilePanel(null);
    setDesktopPanel("clients");
    await calculateRoute(new Set(entry.clientIds), {
      visitOrder: entry.clientIds,
      saveHistory: false,
    });
    toast.success("Percorso ripristinato");
  }

  async function deleteHistoryEntry(id: number) {
    const res = await fetch(`/api/route-history/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRouteHistory((prev) => prev.filter((e) => e.id !== id));
    }
  }

  function openHistory() {
    loadHistory();
    if (window.matchMedia("(min-width: 768px)").matches) {
      setSidebarOpen(true);
      setDesktopPanel("history");
    } else {
      setMobilePanel("history");
    }
  }

  const sharePhone = process.env.NEXT_PUBLIC_SHARE_PHONE;

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50">
      <MapTopBar
        search={search}
        onSearchChange={setSearch}
        statoFilter={statoFilter}
        onStatoFilterChange={setStatoFilter}
        urgenteOnly={urgenteOnly}
        onUrgenteOnlyChange={setUrgenteOnly}
        selectedCount={selectedIds.size}
        filteredCount={filtered.length}
        mapFocusMode={mapFocusMode}
        calculating={calculating}
        onCalculateRoute={() => calculateRoute()}
        onClearSelection={clearSelection}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onOpenHistory={openHistory}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
      />

      <div className="flex flex-1 min-h-0 relative">
        {sidebarOpen && (
          <aside className="hidden md:flex w-72 shrink-0 border-r border-slate-200 bg-white flex-col">
            <div className="flex border-b border-slate-200 shrink-0">
              <SideTab
                active={desktopPanel === "clients"}
                onClick={() => setDesktopPanel("clients")}
                label="Clienti"
              />
              <SideTab
                active={desktopPanel === "history"}
                onClick={() => {
                  setDesktopPanel("history");
                  loadHistory();
                }}
                label="Storico"
              />
            </div>
            <div className="flex-1 min-h-0">
              {desktopPanel === "clients" ? (
                <ClientListPanel
                  filtered={filtered}
                  selectedIds={selectedIds}
                  onFocus={focusClient}
                  onToggleSelect={toggleSelect}
                />
              ) : (
                <RouteHistoryPanel
                  entries={routeHistory}
                  loading={historyLoading}
                  onClose={() => setDesktopPanel("clients")}
                  onRestore={restoreFromHistory}
                  onDelete={deleteHistoryEntry}
                />
              )}
            </div>
          </aside>
        )}

        <div className="flex-1 relative min-w-0">
          {loading && (
            <div className="absolute inset-0 z-[500] bg-white/80 flex items-center justify-center">
              <Loader2 size={28} className="text-indigo-500 animate-spin" />
            </div>
          )}

          {calculating && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[600] bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 flex items-center gap-2 shadow-sm">
              <Loader2 size={14} className="animate-spin text-indigo-600" />
              Calcolo...
            </div>
          )}

          <ClientMap
            clients={mapClients}
            settings={settings}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            routeResult={routeResult}
            focusedId={focusedId}
            focusMode={mapFocusMode}
          />

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

      {/* Mobile: barra azioni sopra nav */}
      <div className="md:hidden fixed bottom-14 inset-x-0 z-[500] flex border-t border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setMobilePanel(mobilePanel === "clients" ? null : "clients")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium ${
            mobilePanel === "clients" ? "text-indigo-600 bg-indigo-50" : "text-slate-600"
          }`}
        >
          <Users size={16} />
          Clienti
          {selectedIds.size > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] px-1.5 rounded-full">
              {selectedIds.size}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            loadHistory();
            setMobilePanel(mobilePanel === "history" ? null : "history");
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-l border-slate-200 ${
            mobilePanel === "history" ? "text-indigo-600 bg-indigo-50" : "text-slate-600"
          }`}
        >
          <History size={16} />
          Storico
        </button>
      </div>

      {/* Mobile sheet */}
      {mobilePanel && (
        <>
          <div
            className="md:hidden fixed inset-0 z-[600] bg-black/30"
            onClick={() => setMobilePanel(null)}
          />
          <div className="md:hidden fixed inset-x-0 bottom-[6.75rem] z-[700] bg-white rounded-t-xl border-t border-slate-200 flex flex-col max-h-[55vh] shadow-xl">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-2 mb-1 shrink-0" />
            <div className="flex-1 min-h-0 overflow-hidden">
              {mobilePanel === "clients" ? (
                <ClientListPanel
                  filtered={filtered}
                  selectedIds={selectedIds}
                  onFocus={(id) => {
                    focusClient(id);
                    setMobilePanel(null);
                  }}
                  onToggleSelect={toggleSelect}
                />
              ) : (
                <RouteHistoryPanel
                  entries={routeHistory}
                  loading={historyLoading}
                  onClose={() => setMobilePanel(null)}
                  onRestore={restoreFromHistory}
                  onDelete={deleteHistoryEntry}
                />
              )}
            </div>
          </div>
        </>
      )}

      {nearestPrompt && (
        <NearestRoutePrompt
          client={nearestPrompt}
          nearestCount={nearestCount}
          onConfirm={() => runNearestRoute(nearestPrompt)}
          onDismiss={() => setNearestPrompt(null)}
        />
      )}
    </div>
  );
}

function SideTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
        active
          ? "border-indigo-600 text-indigo-600"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
