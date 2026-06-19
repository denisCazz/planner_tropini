"use client";

import { memo } from "react";
import { MapPin, X } from "lucide-react";
import type { Client, StatoCliente } from "@/types/client";

const STATO_DOT: Record<StatoCliente, string> = {
  ATTIVO: "bg-emerald-500",
  INATTIVO: "bg-slate-400",
  PROSPECT: "bg-amber-500",
};

interface ClientRowProps {
  client: Client;
  isSelected: boolean;
  onFocus: (id: number) => void;
  onToggleSelect: (id: number) => void;
}

export const ClientRow = memo(function ClientRow({
  client: c,
  isSelected,
  onFocus,
  onToggleSelect,
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
              ? "bg-indigo-600 border-indigo-600"
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
            <span className={`w-2 h-2 rounded-full shrink-0 ${STATO_DOT[c.stato]}`} />
            <span className="text-sm font-medium text-slate-900 truncate">
              <span className="font-semibold">{c.cognome}</span>
              {c.cognome && c.nome ? " " : ""}
              {c.nome}
            </span>
            <span className="text-[10px] text-slate-400 shrink-0">#{c.id}</span>
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
      </div>
    </div>
  );
});

interface ClientListPanelProps {
  filtered: Client[];
  clients: Client[];
  selectedIds: Set<number>;
  filteredIdSet: Set<number>;
  onFocus: (id: number) => void;
  onToggleSelect: (id: number) => void;
}

export default function ClientListPanel({
  filtered,
  clients,
  selectedIds,
  filteredIdSet,
  onFocus,
  onToggleSelect,
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
              <div
                key={c.id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg bg-indigo-100/80 text-xs font-medium text-indigo-900 max-w-full"
              >
                <button
                  type="button"
                  onClick={() => onFocus(c.id)}
                  className="inline-flex items-center gap-1 min-w-0 hover:opacity-80"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATO_DOT[c.stato]}`} />
                  <span className="truncate">
                    {c.cognome} {c.nome}
                  </span>
                  {!filteredIdSet.has(c.id) && (
                    <span className="text-[9px] text-indigo-400 shrink-0">· filtro</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSelect(c.id)}
                  className="p-0.5 rounded hover:bg-indigo-300/50 text-indigo-400 hover:text-red-500"
                  aria-label="Rimuovi"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-3 py-2 shrink-0 border-b border-slate-100">
        <p className="text-[11px] text-slate-500">
          <span className="font-medium text-slate-600">Casella</span> = seleziona ·{" "}
          <span className="font-medium text-slate-600">Nome</span> = centra sulla mappa
        </p>
      </div>

      <div className="flex-1 overflow-y-auto panel-scroll pb-2">
        {filtered.length === 0 ? (
          <div className="mx-3 mt-4 p-6 text-center rounded-xl bg-white border border-dashed border-slate-200">
            <p className="text-sm text-slate-500">Nessun cliente trovato</p>
            <p className="text-xs text-slate-400 mt-1">Modifica ricerca o filtri nella barra in alto</p>
          </div>
        ) : (
          filtered.map((c) => (
            <ClientRow
              key={c.id}
              client={c}
              isSelected={selectedIds.has(c.id)}
              onFocus={onFocus}
              onToggleSelect={onToggleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
