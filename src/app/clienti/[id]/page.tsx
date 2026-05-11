"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { ArrowLeft, Pencil, Trash2, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Client, StatoCliente } from "@/types/client";
import Drawer from "@/components/Drawer";
import ClientForm from "@/components/ClientForm";

const STATO_COLORS: Record<StatoCliente, string> = {
  ATTIVO: "bg-green-100 text-green-800",
  INATTIVO: "bg-red-100 text-red-800",
  PROSPECT: "bg-yellow-100 text-yellow-800",
};

const STATO_LABELS: Record<StatoCliente, string> = {
  ATTIVO: "Attivo",
  INATTIVO: "Inattivo",
  PROSPECT: "Prospect",
};

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!confirm("Eliminare questo cliente?")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    toast.success("Cliente eliminato");
    router.push("/clienti");
  }

  if (loading) return <div className="p-8 text-gray-400">Caricamento...</div>;
  if (!client)
    return (
      <div className="p-8 text-gray-400">Cliente non trovato</div>
    );

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/clienti"
          className="p-2 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {client.nome} {client.cognome}
          </h1>
        </div>
        <span
          className={`inline-flex px-2.5 py-1 rounded-full text-sm font-medium ${STATO_COLORS[client.stato]}`}
        >
          {STATO_LABELS[client.stato]}
        </span>
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          title="Modifica"
        >
          <Pencil size={17} />
        </button>
        <button
          onClick={handleDelete}
          className="p-2 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"
          title="Elimina"
        >
          <Trash2 size={17} />
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {[
          { label: "Email", value: client.email },
          { label: "Telefono", value: client.telefono },
          {
            label: "Indirizzo",
            value: client.indirizzo,
            extra:
              client.lat && client.lng ? (
                <span className="flex items-center gap-1 text-xs text-green-600 mt-0.5">
                  <MapPin size={11} />
                  {client.lat.toFixed(5)}, {client.lng.toFixed(5)}
                </span>
              ) : null,
          },
          {
            label: "Ultima visita",
            value: client.ultimaVisita
              ? new Date(client.ultimaVisita).toLocaleDateString("it-IT")
              : null,
          },
          { label: "Note", value: client.note },
          {
            label: "Creato il",
            value: new Date(client.createdAt).toLocaleDateString("it-IT"),
          },
        ].map(({ label, value, extra }) => (
          <div key={label} className="px-5 py-4">
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              {label}
            </dt>
            <dd className="text-sm text-gray-900">{value ?? "—"}</dd>
            {extra}
          </div>
        ))}
      </div>

      <Drawer
        title="Modifica cliente"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <ClientForm
          initial={client}
          onSaved={(saved) => {
            setClient(saved);
            setDrawerOpen(false);
            toast.success("Cliente aggiornato");
          }}
          onClose={() => setDrawerOpen(false)}
        />
      </Drawer>
    </div>
  );
}
