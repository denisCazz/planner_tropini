"use client";

import {
  Search,
  Navigation,
  X,
  AlertTriangle,
  PanelLeftClose,
  PanelLeft,
  Loader2,
  History,
  SlidersHorizontal,
} from "lucide-react";
import type { StatoCliente } from "@/types/client";

const STATO_LABELS: Record<StatoCliente, string> = {
  ATTIVO: "Attivo",
  INATTIVO: "Inattivo",
  PROSPECT: "Altro",
};

interface MapTopBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  statoFilter: StatoCliente | "";
  onStatoFilterChange: (v: StatoCliente | "") => void;
  urgenteOnly: boolean;
  onUrgenteOnlyChange: (v: boolean) => void;
  selectedCount: number;
  filteredCount: number;
  mapFocusMode?: boolean;
  calculating: boolean;
  onCalculateRoute: () => void;
  onClearSelection: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenHistory: () => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
}

export default function MapTopBar({
  search,
  onSearchChange,
  statoFilter,
  onStatoFilterChange,
  urgenteOnly,
  onUrgenteOnlyChange,
  selectedCount,
  filteredCount,
  mapFocusMode,
  calculating,
  onCalculateRoute,
  onClearSelection,
  sidebarOpen,
  onToggleSidebar,
  onOpenHistory,
  filtersOpen,
  onToggleFilters,
}: MapTopBarProps) {
  const filterActive = statoFilter !== "" || urgenteOnly;

  return (
    <header className="shrink-0 z-30 bg-white border-b border-slate-200">
      <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100"
          title={sidebarOpen ? "Nascondi elenco" : "Mostra elenco"}
        >
          {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeft size={17} />}
        </button>

        <div className="flex-1 relative min-w-0">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-2 text-sm focus:outline-none focus:border-indigo-400"
            placeholder="Cerca..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={onToggleFilters}
          className={`md:hidden flex items-center justify-center w-9 h-9 rounded-lg border shrink-0 ${
            filterActive || filtersOpen
              ? "bg-indigo-50 border-indigo-200 text-indigo-600"
              : "border-slate-200 text-slate-500"
          }`}
          aria-label="Filtri"
        >
          <SlidersHorizontal size={16} />
        </button>

        <div className="hidden md:flex items-center gap-1 shrink-0">
          <FilterPills
            statoFilter={statoFilter}
            onStatoFilterChange={onStatoFilterChange}
            urgenteOnly={urgenteOnly}
            onUrgenteOnlyChange={onUrgenteOnlyChange}
          />
        </div>

        <button
          type="button"
          onClick={onOpenHistory}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0"
          title="Storico percorsi"
        >
          <History size={16} />
        </button>

        {selectedCount > 0 && (
          <button
            type="button"
            onClick={onClearSelection}
            className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100"
            title="Cancella selezione"
          >
            <X size={16} />
          </button>
        )}

        <button
          type="button"
          onClick={onCalculateRoute}
          disabled={calculating || selectedCount < 2}
          className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium px-3 py-2 rounded-lg shrink-0"
        >
          {calculating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
          <span className="hidden sm:inline">{selectedCount > 0 ? selectedCount : "Percorso"}</span>
        </button>
      </div>

      {/* Mobile: filtri espandibili */}
      {filtersOpen && (
        <div className="md:hidden px-3 pb-2.5 border-t border-slate-100 pt-2">
          <FilterPills
            statoFilter={statoFilter}
            onStatoFilterChange={onStatoFilterChange}
            urgenteOnly={urgenteOnly}
            onUrgenteOnlyChange={onUrgenteOnlyChange}
          />
        </div>
      )}

      <div className="hidden md:flex items-center justify-between px-4 py-1 border-t border-slate-100 text-[11px] text-slate-500">
        <span>
          {mapFocusMode
            ? `Mappa: ${selectedCount} tappe del percorso`
            : `${filteredCount} clienti`}
        </span>
        {selectedCount > 0 && !mapFocusMode && (
          <span className="text-indigo-600 font-medium">
            {selectedCount} selezionat{selectedCount === 1 ? "o" : "i"}
          </span>
        )}
      </div>
    </header>
  );
}

function FilterPills({
  statoFilter,
  onStatoFilterChange,
  urgenteOnly,
  onUrgenteOnlyChange,
}: {
  statoFilter: StatoCliente | "";
  onStatoFilterChange: (v: StatoCliente | "") => void;
  urgenteOnly: boolean;
  onUrgenteOnlyChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <FilterBtn active={statoFilter === ""} onClick={() => onStatoFilterChange("")}>
        Tutti
      </FilterBtn>
      {(Object.keys(STATO_LABELS) as StatoCliente[]).map((s) => (
        <FilterBtn key={s} active={statoFilter === s} onClick={() => onStatoFilterChange(s)}>
          {STATO_LABELS[s]}
        </FilterBtn>
      ))}
      <FilterBtn active={urgenteOnly} onClick={() => onUrgenteOnlyChange(!urgenteOnly)} warn>
        <AlertTriangle size={11} className="inline mr-0.5" />
        Urgenti
      </FilterBtn>
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
  warn,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs font-medium ${
        active
          ? warn
            ? "bg-red-500 text-white"
            : "bg-indigo-600 text-white"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}
