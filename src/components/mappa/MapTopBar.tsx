"use client";

import {
  Search,
  Navigation,
  X,
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
    <header className="shrink-0 z-30 bg-white border-b border-slate-200 shadow-sm">
      {/* Riga 1: titolo + azioni percorso */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-slate-100">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title={sidebarOpen ? "Nascondi elenco" : "Mostra elenco"}
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Route size={15} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-900 leading-tight">Mappa & Percorsi</h1>
            <p className="text-[11px] text-slate-500 leading-tight">
              {filteredCount} in elenco · {clientsOnMap} su mappa
              {totalUrgenti > 0 && (
                <span className="text-red-500 font-medium"> · {totalUrgenti} urgenti</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {selectedCount > 0 && (
            <>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
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
            </>
          )}
          <button
            type="button"
            onClick={onCalculateRoute}
            disabled={calculating || selectedCount < 2}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm transition-colors"
          >
            {calculating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Navigation size={14} />
            )}
            <span className="hidden sm:inline">Percorso ottimale</span>
            <span className="sm:hidden">Percorso</span>
          </button>
        </div>
      </div>

      {/* Riga 2: ricerca + filtri — sempre visibile */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-2.5 bg-slate-50/80">
        <div className="flex-1 relative min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400 shadow-sm"
            placeholder="Cerca nome, cognome, indirizzo, telefono..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 pb-0.5 sm:pb-0">
          <button
            type="button"
            onClick={() => onStatoFilterChange("")}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statoFilter === ""
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            Tutti
          </button>
          {(Object.keys(STATO_LABELS) as StatoCliente[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatoFilterChange(s)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statoFilter === s
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {STATO_LABELS[s]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onUrgenteOnlyChange(!urgenteOnly)}
            className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              urgenteOnly
                ? "bg-red-500 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-600"
            }`}
          >
            <AlertTriangle size={12} />
            Urgenti
          </button>
        </div>
      </div>
    </header>
  );
}
