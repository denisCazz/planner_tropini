"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Search, Navigation, X, MapPin, Users, Target, Route } from "lucide-react";
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

  function clearSelection() {
    setSelectedIds(new Set());
    setRouteResult(null);
  }

  async function findNearestAndRoute(pivot: Client) {
    if (!pivot.lat || !pivot.lng) {
      toast.error(`${pivot.nome} non ha coordinate — aggiungi un indirizzo geocodificato`);
      return;
    }
    const others = clients.filter(
      (c) => c.id !== pivot.id && c.lat !== null && c.lng !== null
    );
    if (others.length === 0) {
      toast.error("Nessun altro cliente con coordinate");
      return;
    }
    const sorted = [...others].sort(
      (a, b) =>
        haversineKm(pivot.lat!, pivot.lng!, a.lat!, a.lng!) -
        haversineKm(pivot.lat!, pivot.lng!, b.lat!, b.lng!)
    );
    const nearest = sorted.slice(0, 4);
    const ids = new Set([pivot.id, ...nearest.map((c) => c.id)]);
    setSelectedIds(ids);
    setRouteResult(null);
    setSheetOpen(false);
    toast.info(`Calcolo percorso con ${pivot.nome} + ${nearest.length} clienti vicini...`);
    await calculateRoute(ids);
  }

  const clientsWithCoords = clients.filter(
    (c) => c.lat !== null && c.lng !== null
  );

  const sharePhone = process.env.NEXT_PUBLIC_SHARE_PHONE;

  const panelInner = (
    <>
      <div className="p-3 border-b border-gray-100 space-y-2 shrink-0">
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
      <div className="p-3 border-b border-gray-100 space-y-2 shrink-0">
        {selectedIds.size > 0 ? (
          <>
            <div className="text-xs text-blue-600 font-medium">
              {selectedIds.size} cliente{selectedIds.size !== 1 ? "i" : ""} selezionat{selectedIds.size !== 1 ? "i" : "o"}
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
            Seleziona clienti per calcolare il percorso
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="px-3 py-2 border-b border-gray-100 flex gap-3 text-xs text-gray-500 shrink-0">
        <span>{clientsWithCoords.length} su mappa</span>
        <span>•</span>
        <span>{filtered.length} in lista</span>
      </div>

      {/* Clients list */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
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
              {/* 4 nearest button */}
              <button
                onClick={(e) => { e.stopPropagation(); findNearestAndRoute(c); }}
                className="shrink-0 p-1 rounded hover:bg-orange-50 text-gray-300 hover:text-orange-500 transition-colors"
                title={`Percorso: ${c.nome} + 4 clienti più vicini`}
              >
                <Target size={13} />
              </button>
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
      {/* ── Loading overlay ── */}
      {calculating && (
        <div className="fixed inset-0 z-[2000] bg-black/50 flex flex-col items-center justify-center gap-4">
          <div className="bg-white rounded-2xl px-8 py-7 flex flex-col items-center gap-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
            <div className="flex items-center gap-2 text-gray-800 font-semibold text-sm">
              <Route size={16} className="text-blue-600" />
              Calcolo percorso ottimale...
            </div>
            <p className="text-xs text-gray-400 text-center max-w-[180px]">
              Sto ottimizzando l&apos;ordine di visita
            </p>
          </div>
        </div>
      )}
      {/* ── Desktop left panel ── */}
      <div className="hidden md:flex w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
        {panelInner}
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative">
        <ClientMap
          clients={clients}
          settings={settings}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          routeResult={routeResult}
        />

        {/* ── Mobile FAB ── */}
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
          />
        )}
      </div>

      {/* ── Mobile sheet backdrop ── */}
      {sheetOpen && (
        <div
          className="md:hidden fixed inset-0 z-[700] bg-black/40"
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* ── Mobile bottom sheet — completamente separato dal panelInner desktop ── */}
      {sheetOpen && (
        <div className="md:hidden fixed inset-x-0 bottom-14 z-[800] bg-white rounded-t-2xl shadow-2xl"
          style={{ height: "70vh" }}
        >
          {/* drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>

          {/* header */}
          <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-900">
              Clienti ({filtered.length})
            </span>
            <button onClick={() => setSheetOpen(false)} className="p-1 rounded-md hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>

          {/* search + filter */}
          <div className="px-3 pt-2 pb-2 space-y-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
                <option key={s} value={s}>{STATO_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* route controls */}
          {selectedIds.size > 0 && (
            <div className="px-3 py-2 flex items-center gap-2 border-b border-gray-100">
              <span className="text-xs text-blue-600 font-medium flex-1">
                {selectedIds.size} selezionat{selectedIds.size === 1 ? "o" : "i"}
              </span>
              <button
                onClick={() => { calculateRoute(); setSheetOpen(false); }}
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

          {/* scrollable client list — altezza esplicita calcolata */}
          <div className="overflow-y-auto overscroll-contain"
            style={{ height: "calc(70vh - 180px)" }}
          >
            {filtered.map((c) => {
              const isSelected = selectedIds.has(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => toggleSelect(c.id)}
                  className={`flex items-center gap-2.5 px-3 py-3 border-b border-gray-50 active:bg-gray-100 ${
                    isSelected ? "bg-blue-50" : ""
                  }`}
                >
                  <div className={`w-5 h-5 rounded shrink-0 border-2 flex items-center justify-center ${
                    isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                  }`}>
                    {isSelected && (
                      <svg viewBox="0 0 10 8" fill="none" className="w-3 h-3">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATO_DOT[c.stato]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {c.nome} {c.cognome}
                    </div>
                    {c.indirizzo && (
                      <div className="text-xs text-gray-400 truncate">{c.indirizzo}</div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSheetOpen(false); findNearestAndRoute(c); }}
                    className="shrink-0 p-1.5 rounded-lg bg-gray-50 active:bg-orange-50 text-gray-400 active:text-orange-500"
                    title="Percorso 4 più vicini"
                  >
                    <Target size={14} />
                  </button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-400">Nessun cliente trovato</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
