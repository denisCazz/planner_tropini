"use client";

import { History, X, Trash2, RotateCcw, Clock, Ruler, User } from "lucide-react";
import type { OrgUser, RouteHistoryEntry } from "@/types/client";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return `Oggi ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface RouteHistoryPanelProps {
  entries: RouteHistoryEntry[];
  loading: boolean;
  orgUsers: OrgUser[];
  userFilter: string;
  onUserFilterChange: (v: string) => void;
  onClose: () => void;
  onRestore: (entry: RouteHistoryEntry) => void;
  onDelete: (id: number) => void;
}

export default function RouteHistoryPanel({
  entries,
  loading,
  orgUsers,
  userFilter,
  onUserFilterChange,
  onClose,
  onRestore,
  onDelete,
}: RouteHistoryPanelProps) {
  // Gestione tratte per tecnico: filtro visibile solo con più di 2 tecnici.
  const showTecnicoFilter = orgUsers.length > 2;
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/40 shrink-0">
        <div className="flex items-center gap-2">
          <History size={18} className="text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-900">Storico percorsi</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
          aria-label="Chiudi"
        >
          <X size={18} />
        </button>
      </div>

      {showTecnicoFilter && (
        <div className="px-4 py-2 border-b border-white/40 shrink-0">
          <select
            value={userFilter}
            onChange={(e) => onUserFilterChange(e.target.value)}
            className="w-full text-[11px] rounded-md border border-white/50 bg-white/70 px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            title="Filtra tratte per tecnico"
          >
            <option value="">Tutti i tecnici</option>
            {orgUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
                {u.role === "ADMIN" ? " (admin)" : ""}
              </option>
            ))}
            <option value="none">Senza tecnico</option>
          </select>
        </div>
      )}

      <div className="flex-1 overflow-y-auto panel-scroll">
        {loading ? (
          <p className="p-6 text-sm text-slate-400 text-center">Caricamento...</p>
        ) : entries.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">
            Nessun percorso salvato. Calcola un percorso per vederlo qui.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map((e) => (
              <li key={e.id} className="px-4 py-3 hover:bg-white/40">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onRestore(e)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-medium text-slate-900 truncate">{e.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>{formatWhen(e.createdAt)}</span>
                      {e.ownerName && (
                        <span className="inline-flex items-center gap-0.5 text-indigo-600">
                          <User size={10} />
                          {e.ownerName}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Ruler size={11} />
                        {e.totalDistance} km
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        ~{e.totalDuration} min
                      </span>
                      <span>{e.stopCount} tappe</span>
                    </div>
                  </button>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRestore(e)}
                      className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50"
                      title="Ripristina sulla mappa"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(e.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                      title="Elimina"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
