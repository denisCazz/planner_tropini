"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Search, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Client, StatoCliente } from "@/types/client";
import Drawer from "@/components/Drawer";
import ClientForm from "@/components/ClientForm";
import PageHeader from "@/components/ui/PageHeader";

export default function ClientiPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statoFilter, setStatoFilter] = useState<StatoCliente | "">("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(search), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (debounced) params.set("search", debounced);
    if (statoFilter) params.set("stato", statoFilter);
    params.set("limit", "500");
    try {
      const res = await fetch(`/api/clients?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Impossibile caricare l'anagrafica");
      }
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
      const headerTotal = Number(res.headers.get("X-Total-Count"));
      setTotal(Number.isFinite(headerTotal) && headerTotal > 0 ? headerTotal : Array.isArray(data) ? data.length : 0);
      setLoadError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossibile caricare i clienti";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [debounced, statoFilter]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <PageHeader
        title="Clienti"
        subtitle={
          total > 0
            ? `${total.toLocaleString("it-IT")} in anagrafica${clients.length < total ? ` · primi ${clients.length}` : ""}`
            : "Anagrafica operativa"
        }
        action={
          <button type="button" className="btn btn-primary" onClick={() => setDrawerOpen(true)}>
            <Plus size={16} /> Nuovo
          </button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-56">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="field field-icon"
            placeholder="Nome, telefono, città, codice…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="field w-40"
          value={statoFilter}
          onChange={(e) => setStatoFilter(e.target.value as StatoCliente | "")}
        >
          <option value="">Tutti</option>
          <option value="ATTIVO">Attivi</option>
          <option value="INATTIVO">Inattivi</option>
          <option value="PROSPECT">Prospect</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loadError && clients.length === 0 ? (
          <div className="p-8 text-sm text-slate-600">
            <p>{loadError}</p>
            <button type="button" className="btn btn-ghost mt-3" onClick={() => void load()}>
              Riprova
            </button>
          </div>
        ) : loading && clients.length === 0 ? (
          <p className="p-8 text-sm text-slate-400">Caricamento…</p>
        ) : clients.length === 0 ? (
          <p className="p-8 text-sm text-slate-400">Nessun cliente</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Cliente</th>
                <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Città</th>
                <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Telefono</th>
                <th className="text-left px-4 py-2 font-medium hidden lg:table-cell">Impianto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/clienti/${c.id}`} className="font-medium text-slate-900 hover:text-teal-700">
                      {[c.cognome, c.nome].filter(Boolean).join(" ")}
                      {c.ragioneSociale ? ` · ${c.ragioneSociale}` : ""}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1">
                      {c.lat != null ? <MapPin size={12} className="text-teal-600" /> : <MapPin size={12} className="text-slate-300" />}
                      {c.citta ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    {c.telefono ? (
                      <a href={`tel:${c.telefono}`} className="inline-flex items-center gap-1 text-teal-700">
                        <Phone size={12} /> {c.telefono}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 hidden lg:table-cell">
                    {[c.marcaStufa, c.modelloStufa].filter(Boolean).join(" ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Nuovo cliente">
        <ClientForm
          onSaved={() => {
            setDrawerOpen(false);
            void load();
          }}
          onClose={() => setDrawerOpen(false)}
        />
      </Drawer>
    </div>
  );
}
