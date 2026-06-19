"use client";

import { memo } from "react";
import { MapPin } from "lucide-react";
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
      className={`flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 ${
        isSelected ? "bg-indigo-50" : "bg-white"
      }`}
    >
      <button
        type="button"
        onClick={() => onToggleSelect(c.id)}
        className={`w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center ${
          isSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-300"
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

      <button type="button" onClick={() => onFocus(c.id)} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATO_DOT[c.stato]}`} />
          <span className="text-sm text-slate-900 truncate">
            <span className="font-medium">{c.cognome}</span>
            {c.cognome && c.nome ? " " : ""}
            {c.nome}
          </span>
        </div>
        {c.indirizzo && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin size={9} className={c.lat && c.lng ? "text-slate-300" : "text-red-300"} />
            <span className="text-[11px] text-slate-400 truncate">{c.indirizzo}</span>
          </div>
        )}
      </button>
    </div>
  );
});

interface ClientListPanelProps {
  filtered: Client[];
  selectedIds: Set<number>;
  onFocus: (id: number) => void;
  onToggleSelect: (id: number) => void;
}

export default function ClientListPanel({
  filtered,
  selectedIds,
  onFocus,
  onToggleSelect,
}: ClientListPanelProps) {
  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col h-full bg-white">
      {selectedCount > 0 && (
        <div className="shrink-0 px-3 py-2 bg-indigo-50 border-b border-indigo-100 text-xs text-indigo-700">
          {selectedCount} selezionat{selectedCount === 1 ? "o" : "i"}
        </div>
      )}

      <div className="flex-1 overflow-y-auto panel-scroll">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">Nessun cliente trovato</p>
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
