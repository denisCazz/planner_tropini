"use client";

import { memo, useState } from "react";
import { MapPin, Route, CheckCircle2, Plus, Eraser } from "lucide-react";
import type { Client, StatoCliente } from "@/types/client";
import { MAP_ICON_PRESETS } from "@/lib/mapIcons";

const STATO_DOT: Record<StatoCliente, string> = {
  ATTIVO: "bg-emerald-500",
  INATTIVO: "bg-slate-400",
  PROSPECT: "bg-amber-500",
};

interface ClientRowProps {
  client: Client;
  onMap: boolean;
  inRoute: boolean;
  onFocus: (id: number) => void;
  onToggleMap: (id: number) => void;
  onSetIcon: (id: number, icona: string | null) => void;
}

const ClientRow = memo(function ClientRow({
  client: c,
  onMap,
  inRoute,
  onFocus,
  onToggleMap,
  onSetIcon,
}: ClientRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div
      className={`relative border-b border-white/40 transition-colors ${
        onMap ? "bg-indigo-500/10" : "hover:bg-white/40"
      }`}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <button
          type="button"
          onClick={() => onToggleMap(c.id)}
          disabled={c.lat == null || c.lng == null}
          className={`w-5 h-5 rounded-md shrink-0 border-2 flex items-center justify-center transition-colors disabled:opacity-30 ${
            onMap ? "bg-indigo-600 border-indigo-600" : "border-slate-300 bg-white/60"
          }`}
          aria-label={onMap ? "Togli dalla mappa" : "Mostra sulla mappa"}
          title={
            c.lat == null || c.lng == null
              ? "Cliente senza coordinate"
              : onMap
                ? "Togli dalla mappa"
                : "Mostra sulla mappa"
          }
        >
          {onMap && (
            <svg viewBox="0 0 10 8" fill="none" className="w-3 h-3">
              <path
                d="M1 4l2.5 2.5L9 1"
                stroke="white"
                strokeWidth="1.6"
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
            {inRoute && <Route size={12} className="text-indigo-500 shrink-0" />}
          </div>
          {c.indirizzo && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin size={9} className={c.lat && c.lng ? "text-slate-300" : "text-red-300"} />
              <span className="text-[11px] text-slate-400 truncate">{c.indirizzo}</span>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-base transition-colors ${
            pickerOpen ? "bg-indigo-100 ring-2 ring-indigo-300" : "bg-white/60 hover:bg-white"
          }`}
          title="Scegli icona mappa"
          aria-label="Scegli icona mappa"
        >
          {c.icona ? (
            <span>{c.icona}</span>
          ) : (
            <span className={`w-2.5 h-2.5 rounded-full ${STATO_DOT[c.stato]}`} />
          )}
        </button>
      </div>

      {pickerOpen && (
        <div className="px-3 pb-3 -mt-1">
          <div className="glass rounded-xl p-2 grid grid-cols-5 gap-1.5">
            <button
              type="button"
              onClick={() => {
                onSetIcon(c.id, null);
                setPickerOpen(false);
              }}
              className={`h-9 rounded-lg flex items-center justify-center text-xs text-slate-500 border ${
                !c.icona ? "border-indigo-400 bg-indigo-500/15" : "border-white/50 bg-white/50 hover:bg-white"
              }`}
              title="Predefinita"
            >
              ✕
            </button>
            {MAP_ICON_PRESETS.map((p) => (
              <button
                key={p.emoji}
                type="button"
                onClick={() => {
                  onSetIcon(c.id, p.emoji);
                  setPickerOpen(false);
                }}
                className={`h-9 rounded-lg flex items-center justify-center text-base border ${
                  c.icona === p.emoji
                    ? "border-indigo-400 bg-indigo-500/15"
                    : "border-white/50 bg-white/50 hover:bg-white"
                }`}
                title={p.label}
              >
                {p.emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

interface ClientListPanelProps {
  filtered: Client[];
  mapIds: Set<number>;
  selectedIds: Set<number>;
  onFocus: (id: number) => void;
  onToggleMap: (id: number) => void;
  onSetIcon: (id: number, icona: string | null) => void;
  onAddAll: () => void;
  onClearMap: () => void;
}

export default function ClientListPanel({
  filtered,
  mapIds,
  selectedIds,
  onFocus,
  onToggleMap,
  onSetIcon,
  onAddAll,
  onClearMap,
}: ClientListPanelProps) {
  const mapCount = mapIds.size;
  const routeCount = selectedIds.size;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/40 text-[11px]">
        <span className="flex items-center gap-1 text-indigo-700 font-medium">
          <MapPin size={12} /> {mapCount} sulla mappa
        </span>
        {routeCount > 0 && (
          <span className="flex items-center gap-1 text-emerald-700 font-medium">
            <CheckCircle2 size={12} /> {routeCount} nel percorso
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onAddAll}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-slate-600 hover:bg-white/60"
            title="Mostra tutti i clienti filtrati sulla mappa"
          >
            <Plus size={12} /> Tutti
          </button>
          {mapCount > 0 && (
            <button
              type="button"
              onClick={onClearMap}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-slate-500 hover:bg-white/60"
              title="Svuota la mappa"
            >
              <Eraser size={12} /> Svuota
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto panel-scroll">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">Nessun cliente trovato</p>
        ) : (
          filtered.map((c) => (
            <ClientRow
              key={c.id}
              client={c}
              onMap={mapIds.has(c.id)}
              inRoute={selectedIds.has(c.id)}
              onFocus={onFocus}
              onToggleMap={onToggleMap}
              onSetIcon={onSetIcon}
            />
          ))
        )}
      </div>
    </div>
  );
}
