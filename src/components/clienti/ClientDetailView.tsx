"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Phone,
  MapPin,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import type { Client } from "@/types/client";
import Drawer from "@/components/Drawer";
import ClientForm from "@/components/ClientForm";
import ClientNotesPanel from "@/components/ClientNotesPanel";
import { StatusBadge, PriorityBadge } from "@/components/ui/StatusBadge";
import { TIPO_LABEL } from "@/lib/status";
import { minutesToHHMM, WEEKDAY_LABEL } from "@/lib/dates";
import AvailabilityForm from "@/components/planning/AvailabilityForm";
import ClientDocumentsPanel, { type ClientDoc } from "@/components/clienti/ClientDocumentsPanel";

type Avail = {
  id: number;
  tipo: string;
  date: string | null;
  startMin: number | null;
  endMin: number | null;
  weekday: number | null;
  periodo: string | null;
  note: string | null;
};

type Intv = {
  id: number;
  stato: string;
  tipo: string;
  priorita: string;
  descrizione: string | null;
  durataStimata: number;
  plant: { marca: string | null; modello: string | null } | null;
};

type Detail = Client & {
  availabilities?: Avail[];
  interventi?: Intv[];
  appointments?: { id: number; date: string; startMin: number; stato: string }[];
  documents?: ClientDoc[];
};

export function ClientDetailSkeleton() {
  return (
    <div className="p-8 text-sm text-slate-400 animate-pulse">Caricamento scheda cliente…</div>
  );
}

export default function ClientDetailView({
  client,
  onClientChange,
  onDelete,
}: {
  client: Detail;
  onClientChange: (c: Client) => void;
  onDelete: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [intOpen, setIntOpen] = useState(false);
  const name = [client.cognome, client.nome].filter(Boolean).join(" ") || client.ragioneSociale || "Cliente";

  async function reload() {
    const res = await fetch(`/api/clients/${client.id}`);
    if (res.ok) onClientChange(await res.json());
  }

  return (
    <div className="p-5 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/clienti" className="btn btn-ghost py-1.5">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{name}</h1>
          <p className="text-sm text-slate-500">
            {[client.indirizzo, client.civico, client.cap, client.citta, client.provincia].filter(Boolean).join(" ") || "Indirizzo mancante"}
            {client.geoStatus && client.geoStatus !== "ok" ? ` · geo: ${client.geoStatus}` : ""}
          </p>
        </div>
        {client.telefono && (
          <a href={`tel:${client.telefono}`} className="btn btn-primary">
            <Phone size={15} /> Chiama
          </a>
        )}
        <Link href={`/mappa?client=${client.id}`} className="btn btn-ghost">
          <MapPin size={15} /> Mappa
        </Link>
        <button type="button" className="btn btn-ghost" onClick={() => setEdit(true)}>
          <Pencil size={15} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Info label="Telefono" value={client.telefono} />
        <Info label="Telefono 2" value={client.telefono2} />
        <Info label="Email" value={client.email} />
        <Info label="CF / P.IVA" value={[client.codiceFiscale, client.partitaIva].filter(Boolean).join(" · ")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-4">
          <h2 className="font-semibold text-sm mb-3">Documenti</h2>
          <ClientDocumentsPanel
            clientId={client.id}
            documents={client.documents ?? []}
            onChanged={() => void reload()}
          />
        </section>

        <section className="card p-4">
          <h2 className="font-semibold text-sm mb-3">Disponibilità</h2>
          <AvailabilityForm
            clientId={client.id}
            interventoId={(client.interventi ?? []).find((i) => !["COMPLETATO", "ANNULLATO"].includes(i.stato))?.id}
            onSaved={() => void reload()}
          />
          <ul className="mt-3 space-y-1.5 text-sm">
            {(client.availabilities ?? []).map((a) => (
              <li key={a.id} className="text-slate-600">
                {formatAvail(a)}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Interventi</h2>
          <button type="button" className="btn btn-primary text-xs py-1" onClick={() => setIntOpen(true)}>
            <Plus size={14} /> Nuovo intervento
          </button>
        </div>
        {(client.interventi ?? []).length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Nessun intervento</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {(client.interventi ?? []).map((i) => (
              <Link key={i.id} href={`/interventi?focus=${i.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{TIPO_LABEL[i.tipo as keyof typeof TIPO_LABEL] ?? i.tipo}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {i.descrizione || `${i.durataStimata} min`}
                  </div>
                </div>
                <PriorityBadge priorita={i.priorita as never} />
                <StatusBadge stato={i.stato as never} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-semibold text-sm mb-3">Note</h2>
        <ClientNotesPanel clientId={client.id} />
      </section>

      <button type="button" className="text-xs text-red-600 hover:underline" onClick={onDelete}>
        Elimina cliente
      </button>

      <Drawer open={edit} onClose={() => setEdit(false)} title="Modifica cliente">
        <ClientForm
          initial={client}
          onSaved={(c) => {
            onClientChange(c);
            setEdit(false);
          }}
          onClose={() => setEdit(false)}
        />
      </Drawer>

      <Drawer open={intOpen} onClose={() => setIntOpen(false)} title="Nuovo intervento">
        <InterventoQuickForm
          clientId={client.id}
          onSaved={async () => {
            setIntOpen(false);
            await reload();
          }}
          onClose={() => setIntOpen(false)}
        />
      </Drawer>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</div>
      <div className="text-sm mt-0.5">{value || "—"}</div>
    </div>
  );
}

function formatAvail(a: Avail): string {
  if (a.tipo === "DISPONIBILE_FASCIA" && a.date) {
    return `Disponibile ${a.date}${a.startMin != null ? ` ${minutesToHHMM(a.startMin)}–${minutesToHHMM(a.endMin ?? 0)}` : ""}`;
  }
  if (a.tipo === "DISPONIBILE_GIORNO") {
    return `Disponibile ${a.weekday ? WEEKDAY_LABEL[a.weekday] : ""} ${a.periodo?.toLowerCase() ?? ""}`.trim();
  }
  if (a.tipo === "NON_DISPONIBILE") return `Non disponibile ${a.date ?? ""}`;
  if (a.tipo === "RICHIAMARE") return `Richiamare ${a.date ?? ""}`;
  return a.tipo;
}

function InterventoQuickForm({
  clientId,
  onSaved,
  onClose,
}: {
  clientId: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [tipo, setTipo] = useState("MANUTENZIONE");
  const [stato, setStato] = useState("DA_CONTATTARE");
  const [descrizione, setDescrizione] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/interventi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, tipo, stato, descrizione }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Errore creazione intervento");
      return;
    }
    toast.success("Intervento creato");
    onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <select className="field" value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="MANUTENZIONE">Manutenzione</option>
        <option value="ASSISTENZA">Assistenza</option>
        <option value="INSTALLAZIONE">Installazione</option>
        <option value="SOPRALLUOGO">Sopralluogo</option>
        <option value="PRONTO_INTERVENTO">Pronto intervento</option>
      </select>
      <select className="field" value={stato} onChange={(e) => setStato(e.target.value)}>
        <option value="DA_CONTATTARE">Da contattare</option>
        <option value="DA_PIANIFICARE">Da pianificare</option>
        <option value="DA_RICONTATTARE">Da richiamare</option>
      </select>
      <textarea className="field" rows={3} placeholder="Descrizione" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" disabled={saving}>Crea</button>
        <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Annulla</button>
      </div>
    </form>
  );
}
