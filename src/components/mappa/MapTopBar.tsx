"use client";

import {
  Search,
  Navigation,
  X,
  MapPin,
  AlertTriangle,
  PanelLeftClose,
  PanelLeft,
  Loader2,
  Route,
} from "lucide-react";
import type { StatoCliente } from "@/types/client";

const STATO_LABELS: Record<StatoCliente, string> = {
  ATTIVO: "Attivo",
  INATTIVO: "Inattivo",
  PROSPECT: "Non categorizzato",
};

interface MapTopBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  statoFilter: StatoCliente | "";
  onStatoFilterChange: (v: StatoCliente | "") => void;
  urgenteOnly: boolean;
  onUrgenteOnlyChange: (v: boolean) => void;
  selectedCount: number;
  clientsOnMap: number;
  totalUrgenti: number;
  filteredCount: number;
  calculating: boolean;
  onCalculateRoute: () => void;
  onClearSelection: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function MapTopBar({
  search,
  onSearchChange,
  statoFilter,
  onStatoFilterChange,
  urgenteOnly,
  onUrgenteOnlyChange,
  selectedCount,
  clientsOnMap,
  totalUrgenti,
  filteredCount,
  calculating,
  onCalculateRoute,
  onClearSelection,
  sidebarOpen,
  onToggleSidebar,
}: MapTopBarProps) {
  return (
    <header className="shrink-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
      <div className="flex items-center gap-3 px-4 h-14">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title={sidebarOpen ? "Nascondi elenco" : "Mostra elenco"}
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="hidden sm:flex w-8 h-8 rounded-lg bg-indigo-600 items-center justify-center shrink-0">
            <Route size={16} className="text-white" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <h1 className="text-sm font-semibold text-slate-900 leading-tight">Mappa & Percorsi</h1>
            <p className="text-[11px] text-slate-500 leading-tight truncate">
              {filteredCount} clienti in elenco
            </p>
          </div>
        </div>

        <div className="flex-1 max-w-md relative hidden md:block">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-shadow"
            placeholder="Cerca cliente, indirizzo, telefono..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="hidden lg:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onStatoFilterChange("")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              statoFilter === ""
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tutti
          </button>
          {(Object.keys(STATO_LABELS) as StatoCliente[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatoFilterChange(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                statoFilter === s
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {STATO_LABELS[s]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onUrgenteOnlyChange(!urgenteOnly)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              urgenteOnly
                ? "bg-red-500 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600"
            }`}
          >
            <AlertTriangle size={12} />
            Urgenti
          </button>
        </div>

        <div className="hidden xl:flex items-center gap-2 ml-auto">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-xs text-slate-600">
            <MapPin size={11} className="text-indigo-500" />
            {clientsOnMap} su mappa
          </span>
          {totalUrgenti > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-xs text-red-600 font-medium">
              <AlertTriangle size={11} />
              {totalUrgenti}
            </span>
          )}
        </div>

        {selectedCount > 0 ? (
          <div className="flex items-center gap-2 ml-auto md:ml-0">
            <span className="hidden sm:inline text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
              {selectedCount} selezionat{selectedCount === 1 ? "o" : "i"}
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Cancella selezione"
            >
              <X size={16} />
            </button>
            <button
              type="button"
              onClick={onCalculateRoute}
              disabled={calculating || selectedCount < 2}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm transition-colors"
            >
              {calculating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Navigation size={14} />
              )}
              Percorso
            </button>
          </div>
        ) : (
          <p className="hidden md:block text-xs text-slate-400 ml-auto">
            Seleziona 2+ clienti per il percorso
          </p>
        )}
      </div>

      {/* Mobile / tablet: search + filters row */}
      <div className="md:hidden px-3 pb-3 space-y-2 border-t border-slate-100 pt-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            placeholder="Cerca..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            type="button"
            onClick={() => onStatoFilterChange("")}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${
              statoFilter === "" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            Tutti
          </button>
          {(Object.keys(STATO_LABELS) as StatoCliente[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatoFilterChange(s)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${
                statoFilter === s ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {STATO_LABELS[s]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onUrgenteOnlyChange(!urgenteOnly)}
            className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
              urgenteOnly ? "bg-red-500 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            <AlertTriangle size={11} />
            Urgenti
          </button>
        </div>
      </div>
    </header>
  );
}
