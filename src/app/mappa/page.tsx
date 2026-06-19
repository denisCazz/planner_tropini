"use client";

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import dynamic from "next/dynamic";
import { Search, Navigation, X, MapPin, Users, Target, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Client, Settings, RouteResult, StatoCliente } from "@/types/client";
import RoutePanel from "@/components/RoutePanel";

const ClientMap = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
      Caricamento mappa...
    </div>
  ),
});

const STATO_LABELS: Record<StatoCliente, string> = {
  ATTIVO: "Attivo",
  INATTIVO: "Inattivo",
  PROSPECT: "Non categorizzato",
};

const STATO_DOT: Record<StatoCliente, string> = {
  ATTIVO: "bg-green-500",
  INATTIVO: "bg-red-500",
  PROSPECT: "bg-yellow-500",
};

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

interface ClientRowProps {
  client: Client;
  isSelected: boolean;
  nearestCount: number;
  onFocus: (id: number) => void;
  onToggleSelect: (id: number) => void;
  onNearestRoute: (client: Client) => void;
  compact?: boolean;
}

const ClientRow = memo(function ClientRow({
  client: c,
  isSelected,
  nearestCount,
  onFocus,
  onToggleSelect,
  onNearestRoute,
  compact = false,
}: ClientRowProps) {
  return (
    <div
      className={`flex items-start gap-2.5 px-3 ${compact ? "py-3" : "py-2.5"} border-b border-gray-50 transition-colors ${
        isSelected ? "bg-blue-50" : "hover:bg-gray-50"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(c.id);
        }}
        className={`${compact ? "w-5 h-5 mt-0.5" : "w-4 h-4 mt-0.5"} rounded shrink-0 border-2 flex items-center justify-center transition-colors ${
          isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 hover:border-blue-400"
        }`}
        aria-label={isSelected ? "Deseleziona cliente" : "Seleziona cliente"}
      >
        {isSelected && (
          <svg viewBox="0 0 10 8" fill="none" className={compact ? "w-3 h-3" : "w-2.5 h-2.5"}>
            <path
              d="M1 4l2.5 2.5L9 1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={() => onFocus(c.id)}
        className="min-w-0 flex-1 text-left"
        title="Centra sulla mappa"
      >
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${STATO_DOT[c.stato]}`} />
          <span className="text-sm font-medium text-gray-900 truncate">
            <span className="font-semibold">{c.cognome}</span>
            {c.cognome && c.nome ? " " : ""}
            {c.nome}
          </span>
        </div>
        {c.indirizzo && (
          <div className="flex items-center gap-1 mt-0.5">
            {c.lat && c.lng ? (
              <MapPin size={10} className="text-gray-400 shrink-0" />
            ) : (
              <MapPin size={10} className="text-red-300 shrink-0" />
            )}
            <span className="text-xs text-gray-400 truncate">{c.indirizzo}</span>
          </div>
        )}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNearestRoute(c);
        }}
        className={`shrink-0 flex items-center gap-1 ${compact ? "px-2 py-1.5 rounded-lg" : "px-1.5 py-1 rounded-md"} bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-600 transition-colors`}
        title={`Percorso: ${c.nome} + ${nearestCount} clienti più vicini`}
      >
        <Target size={compact ? 13 : 11} />
        <span className="text-[10px] font-semibold">{nearestCount} vicini</span>
      </button>
    </div>
  );
});

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
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const selectedOutOfFilter = useMemo(
    () => [...selectedIds].filter((id) => !filteredIdSet.has(id)).length,
    [selectedIds, filteredIdSet]
  );

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
  }

  const handleNearestRoute = useCallback(
    async (pivot: Client) => {
      if (pivot.lat == null || pivot.lng == null) {
        toast.error(`${pivot.nome} non ha coordinate — aggiungi un indirizzo geocodificato`);
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
      setSheetOpen(false);
      toast.info(`Calcolo percorso con ${pivot.nome} + ${nearest.length} clienti vicini...`);
      await calculateRoute(ids);
    },
    [clients, nearestCount]
  );

  const clientsOnMap = mapClients.filter((c) => c.lat !== null && c.lng !== null).length;

  const sharePhone = process.env.NEXT_PUBLIC_SHARE_PHONE;

  const panelInner = (
    <>
      <div className="p-3 border-b border-gray-100 space-y-2 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full border border-gray-200 rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Cerca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setStatoFilter("")}
            className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              statoFilter === ""
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            Tutti
          </button>
          {(Object.keys(STATO_LABELS) as StatoCliente[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatoFilter(s)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                statoFilter === s
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {STATO_LABELS[s]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setUrgenteOnly((v) => !v)}
          className={`w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md border transition-colors ${
            urgenteOnly
              ? "bg-red-600 border-red-600 text-white"
              : "border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-500"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-current" />
          Solo urgenti
        </button>
      </div>

      <div className="p-3 border-b border-gray-100 space-y-2 shrink-0">
        {selectedIds.size > 0 ? (
          <>
            <div className="text-xs text-blue-600 font-medium">
              {selectedIds.size} cliente{selectedIds.size !== 1 ? "i" : ""} selezionat
              {selectedIds.size !== 1 ? "i" : "o"}
              {selectedOutOfFilter > 0 && (
                <span className="text-blue-400 font-normal">
                  {" "}
                  · {selectedOutOfFilter} visibil{selectedOutOfFilter === 1 ? "e" : "i"} sulla mappa
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => calculateRoute()}
                disabled={calculating}
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded-md transition-colors"
              >
                <Navigation size={12} />
                {calculating ? "Calcolo..." : "Percorso ottimale"}
              </button>
              <button
                onClick={clearSelection}
                className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
                title="Cancella selezione"
              >
                <X size={14} />
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-400">
            Usa la casella per selezionare · clic sul nome per centrare la mappa
          </p>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="border-b border-blue-100 bg-blue-50 shrink-0">
          <div className="px-3 pt-2 pb-1 text-xs font-semibold text-blue-700 uppercase tracking-wide">
            Selezionati ({selectedIds.size})
          </div>
          <div className="max-h-36 overflow-y-auto">
            {clients
              .filter((c) => selectedIds.has(c.id))
              .map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-3 py-1.5 hover:bg-blue-100 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => focusClient(c.id)}
                    className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                    title="Centra sulla mappa"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATO_DOT[c.stato]}`} />
                    <span className="text-xs text-blue-900 font-medium truncate">
                      <span className="font-semibold">{c.cognome}</span>
                      {c.cognome && c.nome ? " " : ""}
                      {c.nome}
                    </span>
                    {!filteredIdSet.has(c.id) && (
                      <span className="text-[10px] text-blue-400 shrink-0">fuori filtro</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(c.id);
                    }}
                    className="ml-2 shrink-0 text-blue-300 hover:text-red-500 transition-colors"
                    title="Rimuovi dalla selezione"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="px-3 py-2 border-b border-gray-100 flex gap-3 text-xs text-gray-500 shrink-0">
        <span>
          {clientsOnMap} su mappa
          {mapClients.length > filtered.length && (
            <span className="text-blue-500"> (+{mapClients.length - filtered.length} selezionati)</span>
          )}
        </span>
        <span>•</span>
        <span className="text-red-500">{totalUrgenti} urgenti</span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-3 py-1.5 bg-orange-50 border-b border-orange-100 flex items-center gap-1.5 text-[10px] text-orange-700">
          <Target size={10} className="shrink-0" />
          <span>
            <strong>{nearestCount} vicini</strong> — percorso ottimale con questo cliente più i{" "}
            {nearestCount} più vicini
          </span>
        </div>
        {filtered.map((c) => (
          <ClientRow
            key={c.id}
            client={c}
            isSelected={selectedIds.has(c.id)}
            nearestCount={nearestCount}
            onFocus={focusClient}
            onToggleSelect={toggleSelect}
            onNearestRoute={handleNearestRoute}
          />
        ))}
        {filtered.length === 0 && (
          <div className="p-6 text-center text-xs text-gray-400">Nessun cliente trovato</div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-full">
      <div className="hidden md:flex w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
        {panelInner}
      </div>

      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 z-[500] bg-white/80 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
              <span className="text-sm text-gray-500">Caricamento clienti...</span>
            </div>
          </div>
        )}

        {calculating && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-2 bg-white/95 backdrop-blur-sm shadow-lg rounded-full px-4 py-2 border border-blue-100">
            <Loader2 size={16} className="text-blue-600 animate-spin" />
            <span className="text-sm font-medium text-gray-800">Calcolo percorso...</span>
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

        <button
          className="md:hidden absolute bottom-20 right-4 z-[600] flex items-center gap-2 bg-blue-600 active:bg-blue-700 text-white shadow-lg rounded-2xl px-4 py-3 text-sm font-semibold"
          onClick={() => setSheetOpen(true)}
        >
          <Users size={16} />
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

      {sheetOpen && (
        <div
          className="md:hidden fixed inset-0 z-[700] bg-black/40"
          onClick={() => setSheetOpen(false)}
        />
      )}

      {sheetOpen && (
        <div
          className="md:hidden fixed inset-x-0 bottom-14 z-[800] bg-white rounded-t-2xl shadow-2xl"
          style={{ height: "70vh" }}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>

          <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-900">Clienti ({filtered.length})</span>
            <button onClick={() => setSheetOpen(false)} className="p-1 rounded-md hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>

          <div className="px-3 pt-2 pb-2 space-y-2 border-b border-gray-100">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                className="w-full border border-gray-200 rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Cerca..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setStatoFilter("")}
                className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                  statoFilter === ""
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                Tutti
              </button>
              {(Object.keys(STATO_LABELS) as StatoCliente[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatoFilter(s)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                    statoFilter === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {STATO_LABELS[s]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setUrgenteOnly((v) => !v)}
              className={`w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md border transition-colors ${
                urgenteOnly
                  ? "bg-red-600 border-red-600 text-white"
                  : "border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-500"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current" />
              Solo urgenti
            </button>
          </div>

          {selectedIds.size > 0 && (
            <div className="px-3 py-2 flex items-center gap-2 border-b border-gray-100">
              <span className="text-xs text-blue-600 font-medium flex-1">
                {selectedIds.size} selezionat{selectedIds.size === 1 ? "o" : "i"}
              </span>
              <button
                onClick={() => {
                  calculateRoute();
                  setSheetOpen(false);
                }}
                disabled={calculating}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-md"
              >
                <Navigation size={12} />
                {calculating ? "Calcolo..." : "Percorso"}
              </button>
              <button onClick={clearSelection} className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="overflow-y-auto overscroll-contain" style={{ height: "calc(70vh - 180px)" }}>
            {filtered.map((c) => (
              <ClientRow
                key={c.id}
                client={c}
                isSelected={selectedIds.has(c.id)}
                nearestCount={nearestCount}
                onFocus={focusClient}
                onToggleSelect={toggleSelect}
                onNearestRoute={(client) => {
                  setSheetOpen(false);
                  handleNearestRoute(client);
                }}
                compact
              />
            ))}
            {filtered.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-400">Nessun cliente trovato</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
