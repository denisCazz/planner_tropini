"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Search, Pencil, Trash2, MapPin, Eye } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Client, StatoCliente } from "@/types/client";
import Drawer from "@/components/Drawer";
import ClientForm from "@/components/ClientForm";

const STATO_COLORS: Record<StatoCliente, string> = {
  ATTIVO: "bg-green-100 text-green-800",
  INATTIVO: "bg-gray-100 text-gray-700",
  PROSPECT: "bg-yellow-100 text-yellow-800",
};

const STATO_LABELS: Record<StatoCliente, string> = {
  ATTIVO: "Attivo",
  INATTIVO: "Inattivo",
  PROSPECT: "Non categorizzato",
};

export default function ClientiPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statoFilter, setStatoFilter] = useState<StatoCliente | "">("");
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Client | undefined>(undefined);
  const [deleting, setDeleting] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search by 350ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statoFilter) params.set("stato", statoFilter);
    const res = await fetch(`/api/clients?${params.toString()}`);
    const data = await res.json();
    setClients(data);
    setLoading(false);
  }, [debouncedSearch, statoFilter]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  function openNew() {
    setEditing(undefined);
    setDrawerOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setDrawerOpen(true);
  }

  function handleSaved(_saved: Client) {
    setDrawerOpen(false);
    fetchClients();
  }

  async function handleDelete(id: number) {
    if (!confirm("Eliminare questo cliente?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/clients/${id}`, { method: "DELETE" });
      toast.success("Cliente eliminato");
      fetchClients();
    } catch {
      toast.error("Errore durante l'eliminazione");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clienti</h1>
          <p className="text-sm text-gray-500 mt-1">
            {clients.length} cliente{clients.length !== 1 ? "i" : ""}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nuovo cliente
        </button>
      </div>

      {/* Filtri */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Cerca per nome, email, telefono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={statoFilter}
          onChange={(e) => setStatoFilter(e.target.value as StatoCliente | "")}
        >
          <option value="">Tutti gli stati</option>
          {(Object.keys(STATO_LABELS) as StatoCliente[]).map((s) => (
            <option key={s} value={s}>
              {STATO_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Tabella — solo desktop */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Caricamento...</div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            Nessun cliente trovato
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Nome
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Contatti
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Indirizzo
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Stato
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Ultima Visita
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {c.nome} {c.cognome}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{c.email}</div>
                    <div className="text-gray-400">{c.telefono}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="flex items-center gap-1">
                      {c.lat && c.lng && (
                        <MapPin size={12} className="text-green-500 shrink-0" />
                      )}
                      <span className="truncate max-w-[200px]">
                        {c.indirizzo ?? "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATO_COLORS[c.stato]}`}
                    >
                      {STATO_LABELS[c.stato]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.ultimaVisita
                      ? new Date(c.ultimaVisita).toLocaleDateString("it-IT")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/clienti/${c.id}`}
                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
                        title="Vedi scheda"
                      >
                        <Eye size={15} />
                      </Link>
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
                        title="Modifica"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deleting === c.id}
                        className="p-1.5 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors disabled:opacity-50"
                        title="Elimina"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Card list — solo mobile */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Caricamento...</div>
        ) : clients.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Nessun cliente trovato</div>
        ) : (
          clients.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-gray-900">
                    {c.nome} {c.cognome}
                  </div>
                  {c.indirizzo && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {c.lat && c.lng ? (
                        <MapPin size={11} className="text-green-500 shrink-0" />
                      ) : (
                        <MapPin size={11} className="text-gray-300 shrink-0" />
                      )}
                      <span className="text-xs text-gray-500 truncate">{c.indirizzo}</span>
                    </div>
                  )}
                </div>
                <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATO_COLORS[c.stato]}`}>
                  {STATO_LABELS[c.stato]}
                </span>
              </div>
              <div className="text-sm text-gray-600 space-y-0.5">
                {c.email && <div>{c.email}</div>}
                {c.telefono && <div className="text-gray-400">{c.telefono}</div>}
                {c.ultimaVisita && (
                  <div className="text-xs text-gray-400">
                    Ultima visita: {new Date(c.ultimaVisita).toLocaleDateString("it-IT")}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <Link
                  href={`/clienti/${c.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-medium transition-colors"
                >
                  <Eye size={13} /> Vedi
                </Link>
                <button
                  onClick={() => openEdit(c)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-medium transition-colors"
                >
                  <Pencil size={13} /> Modifica
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deleting === c.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-500 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 size={13} /> Elimina
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Drawer
        title={editing ? "Modifica cliente" : "Nuovo cliente"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <ClientForm
          initial={editing}
          onSaved={handleSaved}
          onClose={() => setDrawerOpen(false)}
        />
      </Drawer>
    </div>
  );
}
