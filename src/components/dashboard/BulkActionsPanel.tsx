"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapPinned,
  CheckCircle2,
  UserX,
  Users,
  Loader2,
  Search,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import type { Client, StatoCliente } from "@/types/client";

const STATO_LABELS: Record<StatoCliente, string> = {
  ATTIVO: "Attivo",
  INATTIVO: "Inattivo",
  PROSPECT: "Non categorizzato",
};

interface BulkActionsPanelProps {
  missingGeoCount: number;
  onRefresh: () => void;
}

type GeoStatus = { pending: number; noAddress: number };

export default function BulkActionsPanel({
  missingGeoCount,
  onRefresh,
}: BulkActionsPanelProps) {
  const [geoStatus, setGeoStatus] = useState<GeoStatus | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geoProgress, setGeoProgress] = useState({ done: 0, failed: 0 });
  const [statoBusy, setStatoBusy] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [filterStato, setFilterStato] = useState<"non-attivi" | StatoCliente>(
    "non-attivi"
  );

  const loadGeoStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/clients/bulk-geocode");
      if (res.ok) setGeoStatus(await res.json());
    } catch {
      /* opzionale */
    }
  }, []);

  useEffect(() => {
    void loadGeoStatus();
  }, [loadGeoStatus, missingGeoCount]);

  async function geocodeAll() {
    const pending = geoStatus?.pending ?? missingGeoCount;
    if (pending === 0) {
      toast.info("Tutti i clienti con indirizzo sono già geocodificati");
      return;
    }

    if (
      !window.confirm(
        `Geocodificare fino a ${pending} clienti?\n\nL'operazione richiede qualche minuto (1 richiesta al secondo verso OpenStreetMap).`
      )
    ) {
      return;
    }

    setGeocoding(true);
    setGeoProgress({ done: 0, failed: 0 });

    let totalDone = 0;
    let totalFailed = 0;
    const excludeIds: number[] = [];

    try {
      let remaining = pending;
      while (remaining > 0) {
        const res = await fetch("/api/clients/bulk-geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchSize: 5, excludeIds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Errore geocoding");

        totalDone += data.geocoded ?? 0;
        totalFailed += data.failed ?? 0;
        if (Array.isArray(data.failedIds)) {
          excludeIds.push(...data.failedIds);
        }
        setGeoProgress({ done: totalDone, failed: totalFailed });

        remaining = data.remaining ?? 0;
        if ((data.processed ?? 0) === 0) break;
      }

      toast.success(
        `Geocoding completato: ${totalDone} ok` +
          (totalFailed ? `, ${totalFailed} falliti` : "")
      );
      onRefresh();
      void loadGeoStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore geocoding");
    } finally {
      setGeocoding(false);
    }
  }

  async function bulkStato(scope: "all", stato: StatoCliente, label: string) {
    if (
      !window.confirm(
        `${label}?\n\nL'operazione aggiorna tutti i clienti dell'organizzazione.`
      )
    ) {
      return;
    }

    setStatoBusy(true);
    try {
      const res = await fetch("/api/clients/bulk-stato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, stato }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore aggiornamento");

      toast.success(`${data.updated} clienti aggiornati`);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore aggiornamento stati");
    } finally {
      setStatoBusy(false);
    }
  }

  async function openSelection() {
    setSelectOpen(true);
    setSelected(new Set());
    setSearch("");
    setFilterStato("non-attivi");
    setClientsLoading(true);
    try {
      const res = await fetch("/api/clients?slim=1&limit=5000");
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];
      setClients(items);
    } catch {
      toast.error("Errore caricamento clienti");
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  }

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (filterStato === "non-attivi" && c.stato === "ATTIVO") return false;
      if (filterStato !== "non-attivi" && c.stato !== filterStato) return false;
      if (!q) return true;
      return `${c.cognome} ${c.nome} ${c.citta ?? ""}`.toLowerCase().includes(q);
    });
  }, [clients, search, filterStato]);

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const ids = filteredClients.map((c) => c.id);
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function activateSelected() {
    if (selected.size === 0) {
      toast.info("Seleziona almeno un cliente");
      return;
    }

    setStatoBusy(true);
    try {
      const res = await fetch("/api/clients/bulk-stato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "selected",
          stato: "ATTIVO",
          clientIds: [...selected],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore aggiornamento");

      toast.success(`${data.updated} clienti attivati`);
      setSelectOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore attivazione");
    } finally {
      setStatoBusy(false);
    }
  }

  const pendingGeo = geoStatus?.pending ?? missingGeoCount;
  const allVisibleSelected =
    filteredClients.length > 0 &&
    filteredClients.every((c) => selected.has(c.id));

  return (
    <>
      <div className="glass glass-hi rounded-2xl p-4 dash-enter dash-enter-2">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
            <Users size={14} className="text-violet-600" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Azioni rapide</span>
        </div>

        <div className="space-y-4">
          {/* Geocoding */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void geocodeAll()}
                disabled={geocoding || pendingGeo === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {geocoding ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <MapPinned size={16} />
                )}
                Geocalizza tutti
                {pendingGeo > 0 && (
                  <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs tabular-nums">
                    {pendingGeo}
                  </span>
                )}
              </button>
              {geoStatus && geoStatus.noAddress > 0 && (
                <span className="text-xs text-gray-400">
                  {geoStatus.noAddress} senza indirizzo
                </span>
              )}
            </div>
            {geocoding && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Geocoding in corso…</span>
                  <span className="tabular-nums">
                    {geoProgress.done} ok
                    {geoProgress.failed > 0 ? ` · ${geoProgress.failed} err` : ""}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full animate-pulse w-full origin-left" />
                </div>
              </div>
            )}
          </div>

          {/* Stati */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Stati clienti</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={statoBusy}
                onClick={() =>
                  void bulkStato("all", "ATTIVO", "Attivare tutti i clienti")
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 disabled:opacity-50 transition-colors border border-emerald-100"
              >
                <CheckCircle2 size={15} />
                Attiva tutti
              </button>
              <button
                type="button"
                disabled={statoBusy}
                onClick={() =>
                  void bulkStato("all", "INATTIVO", "Disattivare tutti i clienti")
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors border border-gray-200"
              >
                <UserX size={15} />
                Disattiva tutti
              </button>
              <button
                type="button"
                disabled={statoBusy}
                onClick={() => void openSelection()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 disabled:opacity-50 transition-colors border border-amber-100"
              >
                <CheckSquare size={15} />
                Seleziona e attiva
              </button>
            </div>
          </div>
        </div>
      </div>

      <Drawer
        title="Seleziona clienti da attivare"
        open={selectOpen}
        onClose={() => setSelectOpen(false)}
      >
        <div className="space-y-4">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              placeholder="Cerca nome o città..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input w-full pl-9 pr-3 py-2 rounded-xl text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["non-attivi", "Non attivi"],
                ["PROSPECT", STATO_LABELS.PROSPECT],
                ["INATTIVO", STATO_LABELS.INATTIVO],
                ["ATTIVO", STATO_LABELS.ATTIVO],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilterStato(value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filterStato === value
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={toggleAllVisible}
            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
          >
            {allVisibleSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            {allVisibleSelected ? "Deseleziona tutti" : "Seleziona tutti visibili"}
            <span className="text-gray-400">({filteredClients.length})</span>
          </button>

          <div className="border border-gray-100 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto panel-scroll">
            {clientsLoading ? (
              <div className="p-8 flex justify-center">
                <Loader2 size={22} className="animate-spin text-indigo-500" />
              </div>
            ) : filteredClients.length === 0 ? (
              <p className="p-6 text-sm text-gray-400 text-center">
                Nessun cliente trovato
              </p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {filteredClients.map((c) => {
                  const checked = selected.has(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => toggleOne(c.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                          checked ? "bg-indigo-50/60" : ""
                        }`}
                      >
                        <span
                          className={`shrink-0 ${checked ? "text-indigo-600" : "text-gray-300"}`}
                        >
                          {checked ? <CheckSquare size={18} /> : <Square size={18} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-gray-900 truncate">
                            {c.cognome} {c.nome}
                          </span>
                          <span className="block text-xs text-gray-400 truncate">
                            {c.citta ?? "—"} · {STATO_LABELS[c.stato]}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button
            type="button"
            disabled={statoBusy || selected.size === 0}
            onClick={() => void activateSelected()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {statoBusy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Attiva selezionati ({selected.size})
          </button>
        </div>
      </Drawer>
    </>
  );
}
