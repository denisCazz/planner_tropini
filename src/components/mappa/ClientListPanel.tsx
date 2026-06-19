"use client";

import { memo } from "react";
import { MapPin, Target, X } from "lucide-react";
import type { Client, StatoCliente } from "@/types/client";

const STATO_DOT: Record<StatoCliente, string> = {
  ATTIVO: "bg-emerald-500",
  INATTIVO: "bg-slate-400",
  PROSPECT: "bg-amber-500",
};

const STATO_RING: Record<StatoCliente, string> = {
  ATTIVO: "ring-emerald-500/20",
  INATTIVO: "ring-slate-400/20",
  PROSPECT: "ring-amber-500/20",
};

interface ClientRowProps {
  client: Client;
  isSelected: boolean;
  nearestCount: number;
  onFocus: (id: number) => void;
  onToggleSelect: (id: number) => void;
  onNearestRoute: (client: Client) => void;
}

export const ClientRow = memo(function ClientRow({
  client: c,
  isSelected,
  nearestCount,
  onFocus,
  onToggleSelect,
  onNearestRoute,
}: ClientRowProps) {
  return (
    <div
      className={`group mx-2 my-1 rounded-xl border transition-all ${
        isSelected
          ? "bg-indigo-50/80 border-indigo-200 shadow-sm ring-1 ring-indigo-500/10"
          : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(c.id);
          }}
          className={`w-[18px] h-[18px] rounded-md shrink-0 border-2 flex items-center justify-center transition-all ${
            isSelected
              ? "bg-indigo-600 border-indigo-600 scale-100"
              : "border-slate-300 hover:border-indigo-400 group-hover:border-slate-400"
          }`}
          aria-label={isSelected ? "Deseleziona" : "Seleziona"}
        >
          {isSelected && (
            <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2.5">
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
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ring-2 ${STATO_DOT[c.stato]} ${STATO_RING[c.stato]}`}
            />
            <span className="text-sm font-medium text-slate-900 truncate">
              <span className="font-semibold">{c.cognome}</span>
              {c.cognome && c.nome ? " " : ""}
              {c.nome}
            </span>
          </div>
          {c.indirizzo && (
            <div className="flex items-center gap-1 mt-0.5 pl-4">
              <MapPin
                size={10}
                className={c.lat && c.lng ? "text-slate-400" : "text-red-300"}
              />
              <span className="text-[11px] text-slate-400 truncate">{c.indirizzo}</span>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNearestRoute(c);
          }}
          className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-amber-700 transition-colors opacity-80 group-hover:opacity-100"
          title={`${nearestCount} clienti più vicini`}
        >
          <Target size={12} />
          <span className="text-[10px] font-bold">{nearestCount}</span>
        </button>
      </div>
    </div>
  );
});

interface ClientListPanelProps {
  filtered: Client[];
  clients: Client[];
  selectedIds: Set<number>;
  filteredIdSet: Set<number>;
  nearestCount: number;
  onFocus: (id: number) => void;
  onToggleSelect: (id: number) => void;
  onNearestRoute: (client: Client) => void;
}

export default function ClientListPanel({
  filtered,
  clients,
  selectedIds,
  filteredIdSet,
  nearestCount,
  onFocus,
  onToggleSelect,
  onNearestRoute,
}: ClientListPanelProps) {
  const selectedClients = clients.filter((c) => selectedIds.has(c.id));

  return (
    <div className="flex flex-col h-full bg-slate-50/80">
      {selectedClients.length > 0 && (
        <div className="shrink-0 p-3 border-b border-slate-200/80 bg-white/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
              Selezionati
            </span>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
              {selectedClients.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto panel-scroll">
            {selectedClients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onFocus(c.id)}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg bg-indigo-100/80 hover:bg-indigo-200/80 text-xs font-medium text-indigo-900 transition-colors max-w-full"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATO_DOT[c.stato]}`} />
                <span className="truncate">
                  {c.cognome} {c.nome}
                </span>
                {!filteredIdSet.has(c.id) && (
                  <span className="text-[9px] text-indigo-400 shrink-0">· filtro</span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(c.id);
                  }}
                  className="ml-0.5 p-0.5 rounded hover:bg-indigo-300/50 text-indigo-400 hover:text-red-500"
                  aria-label="Rimuovi"
                >
                  <X size={11} />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-3 py-2 shrink-0">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          <span className="font-medium text-slate-600">Casella</span> = seleziona ·{" "}
          <span className="font-medium text-slate-600">Nome</span> = centra mappa ·{" "}
          <Target size={10} className="inline text-amber-600" /> = percorso vicini
        </p>
      </div>

      <div className="flex-1 overflow-y-auto panel-scroll pb-2">
        {filtered.length === 0 ? (
          <div className="mx-3 mt-4 p-6 text-center rounded-xl bg-white border border-dashed border-slate-200">
            <p className="text-sm text-slate-500">Nessun cliente trovato</p>
            <p className="text-xs text-slate-400 mt-1">Prova a modificare i filtri</p>
          </div>
        ) : (
          filtered.map((c) => (
            <ClientRow
              key={c.id}
              client={c}
              isSelected={selectedIds.has(c.id)}
              nearestCount={nearestCount}
              onFocus={onFocus}
              onToggleSelect={onToggleSelect}
              onNearestRoute={onNearestRoute}
            />
          ))
        )}
      </div>
    </div>
  );
}
