"use client";

import {
  Search,
  Navigation,
  X,
  PanelLeftClose,
  PanelLeft,
  Loader2,
  History,
  MousePointerClick,
  Users,
  CalendarDays,
} from "lucide-react";
import { formatItalianDate } from "@/types/client";

export type MapViewMode = "clienti" | "agenda";

interface MapTopBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  selectedCount: number;
  mapCount: number;
  filteredCount: number;
  calculating: boolean;
  onCalculateRoute: () => void;
  onClearSelection: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenHistory: () => void;
  planMode: boolean;
  onTogglePlan: () => void;
  viewMode: MapViewMode;
  onViewModeChange: (mode: MapViewMode) => void;
  agendaDate: string;
  agendaCount: number;
}

export default function MapTopBar({
  search,
  onSearchChange,
  selectedCount,
  mapCount,
  filteredCount,
  calculating,
  onCalculateRoute,
  onClearSelection,
  sidebarOpen,
  onToggleSidebar,
  onOpenHistory,
  planMode,
  onTogglePlan,
  viewMode,
  onViewModeChange,
  agendaDate,
  agendaCount,
}: MapTopBarProps) {
  const canRoute = selectedCount >= 2 && !calculating;
  const inClienti = viewMode === "clienti";

  return (
    <header className="shrink-0 z-30 glass-strong glass-hi border-b border-white/40">
      <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-white/60 shrink-0"
          title={sidebarOpen ? "Nascondi elenco" : "Mostra elenco"}
        >
          {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeft size={17} />}
        </button>

        {/* Switch vista: centro operativo */}
        <div className="flex items-center shrink-0 rounded-xl border border-white/50 bg-white/40 p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => onViewModeChange("clienti")}
            className={`flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg text-xs font-semibold transition-colors ${
              inClienti
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-white/80"
            }`}
            title="Vista clienti e percorsi"
          >
            <Users size={14} className={inClienti ? "text-white" : "text-indigo-500"} />
            <span className="hidden sm:inline">Clienti</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("agenda")}
            className={`flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg text-xs font-semibold transition-colors ${
              !inClienti
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-white/80"
            }`}
            title="Agenda appuntamenti del giorno"
          >
            <CalendarDays size={14} className={!inClienti ? "text-white" : "text-indigo-500"} />
            <span className="hidden sm:inline">Agenda</span>
            {agendaCount > 0 && (
              <span
                className={`min-w-[1.25rem] text-center text-[10px] font-bold px-1 rounded-full ${
                  !inClienti ? "bg-white/25" : "bg-indigo-100 text-indigo-700"
                }`}
              >
                {agendaCount}
              </span>
            )}
          </button>
        </div>

        {inClienti ? (
          <div className="flex-1 relative min-w-0">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="glass-input w-full rounded-lg pl-8 pr-2 py-2 text-sm"
              placeholder="Cerca cliente…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-600 capitalize truncate">
              {formatItalianDate(agendaDate)}
            </span>
          </div>
        )}

        {inClienti && (
          <>
            {/* Gruppo percorso: 1. seleziona → 2. calcola viaggio */}
            <div className="flex items-center shrink-0 rounded-lg border border-white/50 bg-white/40 p-0.5 shadow-sm">
              <button
                type="button"
                onClick={onTogglePlan}
                className={`flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-md text-xs font-medium transition-colors ${
                  planMode
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white/80"
                }`}
                title="Seleziona i clienti sulla mappa toccando i marker"
              >
                <MousePointerClick size={15} className={planMode ? "text-white" : "text-indigo-500"} />
                <span className="hidden sm:inline">Pianifica</span>
              </button>

              <div className="w-px h-5 bg-slate-200/80 mx-0.5" aria-hidden />

              <button
                type="button"
                onClick={onCalculateRoute}
                disabled={!canRoute}
                className={`flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-md text-xs font-semibold transition-colors ${
                  canRoute
                    ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
                    : "text-slate-400 cursor-not-allowed"
                }`}
                title={
                  selectedCount < 2
                    ? "Seleziona almeno 2 clienti per calcolare il viaggio"
                    : "Calcola il percorso ottimale"
                }
              >
                {calculating ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Navigation size={15} />
                )}
                <span className="hidden sm:inline">Viaggio</span>
                {selectedCount > 0 && (
                  <span
                    className={`min-w-[1.25rem] text-center text-[10px] font-bold px-1 rounded-full ${
                      canRoute ? "bg-white/25" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {selectedCount}
                  </span>
                )}
              </button>
            </div>

            {selectedCount > 0 && (
              <button
                type="button"
                onClick={onClearSelection}
                className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-white/60 hover:text-slate-600 shrink-0"
                title="Svuota selezione percorso"
              >
                <X size={16} />
              </button>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onOpenHistory}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-white/50 bg-white/50 text-slate-500 hover:bg-white shrink-0"
          title="Storico percorsi"
        >
          <History size={16} />
        </button>
      </div>

      {inClienti && (
        <div className="flex items-center justify-between px-3 md:px-4 py-1 border-t border-white/40 text-[11px] text-slate-500 gap-2">
          <span className="truncate">
            {filteredCount.toLocaleString("it-IT")} clienti
            {mapCount > 0 && ` · ${mapCount} sulla mappa`}
          </span>
          {planMode && (
            <span className="text-indigo-600 font-medium shrink-0">
              Tocca i marker per aggiungere tappe
            </span>
          )}
          {!planMode && selectedCount > 0 && (
            <span className="text-indigo-600 font-medium shrink-0">
              {selectedCount} tappe selezionate
            </span>
          )}
        </div>
      )}
    </header>
  );
}
