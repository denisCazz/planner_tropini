"use client";

import { memo, useState } from "react";
import { MapPin, Route, CheckCircle2, Plus, Eraser, AlertTriangle, UserCog } from "lucide-react";
import { toast } from "sonner";
import type { Client, OrgUser, StatoCliente } from "@/types/client";
import { MAP_ICON_PRESETS } from "@/lib/mapIcons";

const STATO_LABELS: Record<StatoCliente, string> = {
  ATTIVO: "Attivo",
  INATTIVO: "Inattivo",
  PROSPECT: "Altro",
};

const STATO_DOT: Record<StatoCliente, string> = {
  ATTIVO: "bg-emerald-500",
  INATTIVO: "bg-slate-400",
  PROSPECT: "bg-amber-500",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface ClientRowProps {
  client: Client;
  onMap: boolean;
  inRoute: boolean;
  onFocus: (id: number) => void;
  onToggleMap: (id: number) => void | Promise<void>;
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
  const hasCoords = c.lat != null && c.lng != null;

  return (
    <div
      className={`relative border-b border-white/40 transition-colors ${
        onMap ? "bg-indigo-500/10" : "hover:bg-white/40"
      }`}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <button
          type="button"
          onClick={() => void onToggleMap(c.id)}
          className={`w-5 h-5 rounded-md shrink-0 border-2 flex items-center justify-center transition-colors cursor-pointer ${
            onMap
              ? "bg-indigo-600 border-indigo-600"
              : hasCoords
                ? "border-slate-300 bg-white/60 hover:border-indigo-400"
                : "border-dashed border-amber-400 bg-amber-50/80 hover:border-amber-500"
          }`}
          aria-label={onMap ? "Togli dalla mappa" : "Mostra sulla mappa"}
          title={
            !hasCoords
              ? "Senza coordinate: clicca per geocodificare e mostrare sulla mappa"
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
            {c.assignedUserName && (
              <span
                className="shrink-0 text-[9px] font-semibold leading-none px-1.5 py-1 rounded-full bg-indigo-100 text-indigo-700"
                title={`Tecnico: ${c.assignedUserName}`}
              >
                {initials(c.assignedUserName)}
              </span>
            )}
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
  total: number;
  loading?: boolean;
  statoFilter: StatoCliente | "";
  onStatoFilterChange: (v: StatoCliente | "") => void;
  urgenteOnly: boolean;
  onUrgenteOnlyChange: (v: boolean) => void;
  orgUsers: OrgUser[];
  tecnicoFilter: string;
  onTecnicoFilterChange: (v: string) => void;
  mapIds: Set<number>;
  selectedIds: Set<number>;
  onFocus: (id: number) => void;
  onToggleMap: (id: number) => void | Promise<void>;
  onSetIcon: (id: number, icona: string | null) => void;
  onAddAll: () => void;
  onClearMap: () => void;
  onReloadClients: () => void;
}

export default function ClientListPanel({
  filtered,
  total,
  loading = false,
  statoFilter,
  onStatoFilterChange,
  urgenteOnly,
  onUrgenteOnlyChange,
  orgUsers,
  tecnicoFilter,
  onTecnicoFilterChange,
  mapIds,
  selectedIds,
  onFocus,
  onToggleMap,
  onSetIcon,
  onAddAll,
  onClearMap,
  onReloadClients,
}: ClientListPanelProps) {
  const mapCount = mapIds.size;
  const routeCount = selectedIds.size;
  const truncated = total > filtered.length;
  const filterActive = statoFilter !== "" || urgenteOnly || tecnicoFilter !== "";
  // "Vista per tecnico": mostrata quando l'organizzazione ha più di un utente.
  const showTecnico = orgUsers.length > 1;
  // "Gestione tratte per tecnico": assegnazione in blocco quando ci sono >2 tecnici.
  const showBulkAssign = orgUsers.length > 2;
  const [assigning, setAssigning] = useState(false);

  async function bulkAssign(userId: string) {
    const ids = routeCount > 0 ? [...selectedIds] : [...mapIds];
    if (ids.length === 0) {
      toast.error("Nessun cliente selezionato sulla mappa o nel percorso");
      return;
    }
    const assignedUserId = userId && userId !== "none" ? userId : null;
    setAssigning(true);
    try {
      const res = await fetch("/api/clients/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "selected", assignedUserId, clientIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      const who = assignedUserId ? orgUsers.find((u) => u.id === assignedUserId)?.username ?? "tecnico" : "nessuno";
      toast.success(`${data.updated} clienti assegnati a ${who}`);
      onReloadClients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore assegnazione");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-3 py-2 border-b border-white/40 space-y-2">
        <div className="flex flex-wrap gap-1">
          <FilterBtn active={statoFilter === "" && !urgenteOnly} onClick={() => { onStatoFilterChange(""); onUrgenteOnlyChange(false); }}>
            Tutti
          </FilterBtn>
          {(Object.keys(STATO_LABELS) as StatoCliente[]).map((s) => (
            <FilterBtn
              key={s}
              active={statoFilter === s && !urgenteOnly}
              onClick={() => { onStatoFilterChange(s); onUrgenteOnlyChange(false); }}
            >
              {STATO_LABELS[s]}
            </FilterBtn>
          ))}
          <FilterBtn active={urgenteOnly} warn onClick={() => onUrgenteOnlyChange(!urgenteOnly)}>
            <AlertTriangle size={10} className="inline mr-0.5" />
            Urgenti
          </FilterBtn>
        </div>

        {showTecnico && (
          <select
            value={tecnicoFilter}
            onChange={(e) => onTecnicoFilterChange(e.target.value)}
            className="w-full text-[11px] rounded-md border border-white/50 bg-white/70 px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            title="Vista per tecnico"
          >
            <option value="">Tutti i tecnici</option>
            {orgUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
                {u.role === "ADMIN" ? " (admin)" : ""}
              </option>
            ))}
            <option value="none">Non assegnati</option>
          </select>
        )}

        {showBulkAssign && (mapCount > 0 || routeCount > 0) && (
          <div className="flex items-center gap-1.5">
            <UserCog size={12} className="text-indigo-500 shrink-0" />
            <select
              defaultValue=""
              disabled={assigning}
              onChange={(e) => {
                const v = e.target.value;
                e.target.value = "";
                void bulkAssign(v);
              }}
              className="flex-1 text-[11px] rounded-md border border-white/50 bg-white/70 px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              title={`Assegna i ${routeCount > 0 ? routeCount + " del percorso" : mapCount + " sulla mappa"} a un tecnico`}
            >
              <option value="" disabled>
                {assigning ? "Assegnazione…" : `Assegna ${routeCount > 0 ? routeCount + " del percorso" : mapCount + " sulla mappa"} a…`}
              </option>
              <option value="none">— Nessun tecnico</option>
              {orgUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                  {u.role === "ADMIN" ? " (admin)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {filterActive && (
          <p className="text-[10px] text-slate-500">
            Filtro attivo · {total.toLocaleString("it-IT")} risultati
          </p>
        )}
      </div>

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

      {truncated && (
        <p className="shrink-0 px-3 py-1.5 text-[10px] text-slate-500 border-b border-white/30 bg-white/30">
          Mostrati {filtered.length} di {total} — affina la ricerca per trovare altri clienti
        </p>
      )}

      <div className="flex-1 overflow-y-auto panel-scroll">
        {loading ? (
          <p className="p-6 text-sm text-slate-400 text-center">Ricerca…</p>
        ) : filtered.length === 0 ? (
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
      className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
        active
          ? warn
            ? "bg-red-500 text-white"
            : "bg-indigo-600 text-white"
          : "bg-white/60 text-slate-600 hover:bg-white border border-white/50"
      }`}
    >
      {children}
    </button>
  );
}
