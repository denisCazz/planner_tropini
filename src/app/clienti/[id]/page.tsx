"use client";

import { useState, useEffect, useRef } from "react";
import { use } from "react";
import { ArrowLeft, Pencil, Trash2, MapPin, MapPinned } from "lucide-react";
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
  PROSPECT: "Non categorizzato",
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
  const [geocodeBusy, setGeocodeBusy] = useState(false);
  const [coordsBusy, setCoordsBusy] = useState(false);
  const latInputRef = useRef<HTMLInputElement>(null);
  const lngInputRef = useRef<HTMLInputElement>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  function scheduleDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);

    const toastId = toast("Eliminazione programmata", {
      description: "Tornerai alla lista tra pochi secondi.",
      duration: 5000,
      action: {
        label: "Annulla",
        onClick: () => {
          if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
          deleteTimerRef.current = null;
          toast.dismiss(toastId);
        },
      },
    });

    deleteTimerRef.current = setTimeout(() => {
      deleteTimerRef.current = null;
      toast.dismiss(toastId);
      void (async () => {
        try {
          await fetch(`/api/clients/${id}`, { method: "DELETE" });
          toast.success("Cliente eliminato");
          router.push("/clienti");
        } catch {
          toast.error("Errore durante l'eliminazione");
        }
      })();
    }, 5000);
  }

  async function retryGeocode() {
    setGeocodeBusy(true);
    try {
      const res = await fetch(`/api/clients/${id}/geocode`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Geocoding fallito");
      setClient(data as Client);
      toast.success("Coordinate aggiornate");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setGeocodeBusy(false);
    }
  }

  async function saveManualCoords() {
    const lat = parseFloat((latInputRef.current?.value ?? "").replace(",", "."));
    const lng = parseFloat((lngInputRef.current?.value ?? "").replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("Latitudine e longitudine devono essere numeri validi");
      return;
    }
    setCoordsBusy(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Salvataggio fallito");
      setClient(data as Client);
      toast.success("Posizione salvata");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setCoordsBusy(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Caricamento...</div>;
  if (!client)
    return (
      <div className="p-8 text-gray-400">Cliente non trovato</div>
    );

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Link
          href="/clienti"
          className="p-2 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">
            <span className="font-extrabold">{client.cognome}</span>
            {client.cognome && client.nome ? " " : ""}
            {client.nome}
          </h1>
        </div>
        <span
          className={`inline-flex px-2.5 py-1 rounded-full text-sm font-medium ${STATO_COLORS[client.stato]}`}
        >
          {STATO_LABELS[client.stato]}
        </span>
        {client.urgente && (
          <span className="inline-flex px-2.5 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
            Urgente
          </span>
        )}
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          title="Modifica"
        >
          <Pencil size={17} />
        </button>
        <button
          onClick={scheduleDelete}
          className="p-2 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"
          title="Elimina"
        >
          <Trash2 size={17} />
        </button>
      </div>

      <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <MapPinned size={16} className="text-blue-600" />
          Posizione sulla mappa
        </h2>
        {client.indirizzo ? (
          <button
            type="button"
            onClick={() => void retryGeocode()}
            disabled={geocodeBusy}
            className="text-sm px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50"
          >
            {geocodeBusy ? "Geocoding..." : "Ricalcola coordinate dall'indirizzo"}
          </button>
        ) : (
          <p className="text-xs text-gray-500">Aggiungi un indirizzo nella scheda per poter geocodificare.</p>
        )}
        <div
          key={`coords-${client.updatedAt}`}
          className="grid grid-cols-2 gap-3 max-w-md"
        >
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Latitudine</label>
            <input
              ref={latInputRef}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm font-mono"
              defaultValue={client.lat != null ? String(client.lat) : ""}
              placeholder="es. 44.7089"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Longitudine</label>
            <input
              ref={lngInputRef}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm font-mono"
              defaultValue={client.lng != null ? String(client.lng) : ""}
              placeholder="es. 7.6617"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void saveManualCoords()}
          disabled={coordsBusy}
          className="text-sm px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {coordsBusy ? "Salvataggio..." : "Salva coordinate manuali"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {[
          { label: "Email", value: client.email },
          { label: "Telefono", value: client.telefono },
          { label: "Telefono 2", value: client.telefono2 },
          {
            label: "Indirizzo",
            value: client.indirizzo,
            extra:
              client.lat != null && client.lng != null ? (
                <span className="flex items-center gap-1 text-xs text-green-600 mt-0.5">
                  <MapPin size={11} />
                  {client.lat.toFixed(5)}, {client.lng.toFixed(5)}
                </span>
              ) : null,
          },
          { label: "CAP", value: client.cap },
          { label: "Città", value: client.citta },
          { label: "Provincia", value: client.provincia },
          { label: "Marca Stufa", value: client.marcaStufa },
          { label: "Modello Stufa", value: client.modelloStufa },
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
