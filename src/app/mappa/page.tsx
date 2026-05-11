"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Search, Navigation, X, MapPin, ChevronUp, Users } from "lucide-react";
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
  PROSPECT: "Prospect",
};

const STATO_DOT: Record<StatoCliente, string> = {
  ATTIVO: "bg-green-500",
  INATTIVO: "bg-red-500",
  PROSPECT: "bg-yellow-500",
};

export default function MappaPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [search, setSearch] = useState("");
  const [statoFilter, setStatoFilter] = useState<StatoCliente | "">("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([clientsData, settingsData]) => {
      setClients(clientsData);
      setFiltered(clientsData);
      setSettings(settingsData);
    });
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      let result = clients;
      if (statoFilter) result = result.filter((c) => c.stato === statoFilter);
      if (search) {
        const q = search.toLowerCase();
        result = result.filter(
          (c) =>
            c.nome.toLowerCase().includes(q) ||
            c.cognome.toLowerCase().includes(q) ||
            (c.indirizzo ?? "").toLowerCase().includes(q)
        );
      }
      setFiltered(result);
    }, 200);
  }, [search, statoFilter, clients]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setRouteResult(null);
  }, []);

  async function calculateRoute() {
    if (selectedIds.size < 2) {
      toast.error("Seleziona almeno 2 clienti");
      return;
    }
    setCalculating(true);
    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientIds: Array.from(selectedIds) }),
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

  function clearSelection() {
    setSelectedIds(new Set());
    setRouteResult(null);
  }

  const clientsWithCoords = clients.filter(
    (c) => c.lat !== null && c.lng !== null
  );

  const panelInner = (
    <>
      <div className="p-3 border-b border-gray-100 space-y-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            className="w-full border border-gray-200 rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Cerca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={statoFilter}
          onChange={(e) => setStatoFilter(e.target.value as StatoCliente | "")}
        >
          <option value="">Tutti gli stati</option>
          {(Object.keys(STATO_LABELS) as StatoCliente[]).map((s) => (
            <option key={s} value={s}>
              {STATO_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Route controls */}
      <div className="p-3 border-b border-gray-100 space-y-2">
        {selectedIds.size > 0 ? (
          <>
            <div className="text-xs text-blue-600 font-medium">
              {selectedIds.size} cliente{selectedIds.size !== 1 ? "i" : ""} selezionat{selectedIds.size !== 1 ? "i" : "o"}
            </div>
            <div className="flex gap-2">
              <button
                onClick={calculateRoute}
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
            Seleziona clienti per calcolare il percorso
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="px-3 py-2 border-b border-gray-100 flex gap-3 text-xs text-gray-500">
        <span>{clientsWithCoords.length} su mappa</span>
        <span>•</span>
        <span>{filtered.length} in lista</span>
      </div>

      {/* Clients list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((c) => {
          const isSelected = selectedIds.has(c.id);
          return (
            <div
              key={c.id}
              onClick={() => toggleSelect(c.id)}
              className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer border-b border-gray-50 transition-colors ${
                isSelected ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <div
                className={`w-4 h-4 mt-0.5 rounded shrink-0 border-2 flex items-center justify-center transition-colors ${
                  isSelected
                    ? "bg-blue-600 border-blue-600"
                    : "border-gray-300"
                }`}
              >
                {isSelected && (
                  <svg
                    viewBox="0 0 10 8"
                    fill="none"
                    className="w-2.5 h-2.5"
                  >
                    <path
                      d="M1 4l2.5 2.5L9 1"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${STATO_DOT[c.stato]}`}
                  />
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {c.nome} {c.cognome}
                  </span>
                </div>
                {c.indirizzo && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {c.lat && c.lng ? (
                      <MapPin size={10} className="text-gray-400 shrink-0" />
                    ) : (
                      <MapPin size={10} className="text-red-300 shrink-0" />
                    )}
                    <span className="text-xs text-gray-400 truncate">
                      {c.indirizzo}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-6 text-center text-xs text-gray-400">
            Nessun cliente trovato
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-full">
      {/* Desktop left panel */}
      <div className="hidden md:flex w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
        {panelInner}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <ClientMap
          clients={clients}
          settings={settings}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          routeResult={routeResult}
        />

        {/* Mobile: toggle button above bottom nav */}
        <button
          className="md:hidden absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-white shadow-lg border border-gray-200 rounded-full px-4 py-2.5 text-sm font-medium text-gray-700"
          onClick={() => setSheetOpen((v) => !v)}
        >
          <Users size={14} />
          Clienti ({filtered.length})
          <ChevronUp
            size={14}
            className={`transition-transform ${sheetOpen ? "" : "rotate-180"}`}
          />
        </button>

        {routeResult && (
          <RoutePanel
            result={routeResult}
            onClose={() => setRouteResult(null)}
          />
        )}
      </div>

      {/* Mobile bottom sheet backdrop */}
      {sheetOpen && (
        <div
          className="md:hidden fixed inset-0 z-[490] bg-black/30"
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* Mobile bottom sheet */}
      <div
        className={`md:hidden fixed inset-x-0 bottom-14 z-[500] bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-in-out max-h-[65vh] ${
          sheetOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        {/* Sheet header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
          <span className="font-semibold text-gray-900 text-sm">
            Clienti ({filtered.length})
          </span>
          <button
            onClick={() => setSheetOpen(false)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>
        {/* Sheet content */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {panelInner}
        </div>
      </div>
    </div>
  );
}
