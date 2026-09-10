"use client";

import { useState } from "react";
import type { Client, ClientFormData, StatoCliente } from "@/types/client";
import { useOrgUsers } from "@/lib/useOrgUsers";
import { technicianDisplayName } from "@/lib/roles";
import { toast } from "sonner";

interface ClientFormProps {
  initial?: Client;
  onSaved: (client: Client) => void;
  onClose: () => void;
}

const EMPTY: ClientFormData = {
  nome: "",
  cognome: "",
  ragioneSociale: "",
  email: "",
  telefono: "",
  telefono2: "",
  codiceFiscale: "",
  partitaIva: "",
  codiceCliente: "",
  indirizzo: "",
  civico: "",
  cap: "",
  citta: "",
  provincia: "",
  marcaStufa: "",
  modelloStufa: "",
  note: "",
  stato: "ATTIVO",
  urgente: false,
  ultimaVisita: "",
  assignedUserId: "",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-slate-600 font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}

export default function ClientForm({ initial, onSaved, onClose }: ClientFormProps) {
  const [form, setForm] = useState<ClientFormData>(() =>
    initial
      ? {
          nome: initial.nome,
          cognome: initial.cognome,
          ragioneSociale: initial.ragioneSociale ?? "",
          email: initial.email ?? "",
          telefono: initial.telefono ?? "",
          telefono2: initial.telefono2 ?? "",
          codiceFiscale: initial.codiceFiscale ?? "",
          partitaIva: initial.partitaIva ?? "",
          codiceCliente: initial.codiceCliente ?? "",
          indirizzo: initial.indirizzo ?? "",
          civico: initial.civico ?? "",
          cap: initial.cap ?? "",
          citta: initial.citta ?? "",
          provincia: initial.provincia ?? "",
          marcaStufa: initial.marcaStufa ?? "",
          modelloStufa: initial.modelloStufa ?? "",
          note: initial.note ?? "",
          stato: initial.stato,
          urgente: initial.urgente,
          ultimaVisita: initial.ultimaVisita ? initial.ultimaVisita.substring(0, 10) : "",
          assignedUserId: initial.assignedUserId ?? "",
        }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const { users } = useOrgUsers();

  const set = (field: keyof ClientFormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() && !form.ragioneSociale.trim()) {
      toast.error("Nome o ragione sociale obbligatori");
      return;
    }
    setSaving(true);
    try {
      const url = initial ? `/api/clients/${initial.id}` : "/api/clients";
      const method = initial ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, nome: form.nome || form.ragioneSociale }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Errore salvataggio");
      }
      const saved: Client = await res.json();
      toast.success(initial ? "Cliente aggiornato" : "Cliente creato");
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome *">
          <input className="field" value={form.nome} onChange={(e) => set("nome", e.target.value)} />
        </Field>
        <Field label="Cognome">
          <input className="field" value={form.cognome} onChange={(e) => set("cognome", e.target.value)} />
        </Field>
        <Field label="Ragione sociale">
          <input className="field" value={form.ragioneSociale} onChange={(e) => set("ragioneSociale", e.target.value)} />
        </Field>
        <Field label="Codice cliente">
          <input className="field" value={form.codiceCliente} onChange={(e) => set("codiceCliente", e.target.value)} />
        </Field>
        <Field label="Telefono">
          <input className="field" type="tel" value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
        </Field>
        <Field label="Telefono 2">
          <input className="field" type="tel" value={form.telefono2} onChange={(e) => set("telefono2", e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="field" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Codice fiscale">
          <input className="field" value={form.codiceFiscale} onChange={(e) => set("codiceFiscale", e.target.value)} />
        </Field>
        <Field label="P. IVA">
          <input className="field" value={form.partitaIva} onChange={(e) => set("partitaIva", e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-4">
          <Field label="Indirizzo">
            <input className="field" value={form.indirizzo} onChange={(e) => set("indirizzo", e.target.value)} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Civico">
            <input className="field" value={form.civico} onChange={(e) => set("civico", e.target.value)} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="CAP">
            <input className="field" value={form.cap} onChange={(e) => set("cap", e.target.value)} />
          </Field>
        </div>
        <div className="col-span-3">
          <Field label="Città">
            <input className="field" value={form.citta} onChange={(e) => set("citta", e.target.value)} />
          </Field>
        </div>
        <div className="col-span-1">
          <Field label="Prov.">
            <input className="field" value={form.provincia} onChange={(e) => set("provincia", e.target.value)} maxLength={2} />
          </Field>
        </div>
      </div>
      <p className="text-xs text-slate-400 -mt-2">Il geocoding non blocca il salvataggio se l’indirizzo non viene trovato.</p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Marca impianto principale">
          <input className="field" value={form.marcaStufa} onChange={(e) => set("marcaStufa", e.target.value)} />
        </Field>
        <Field label="Modello">
          <input className="field" value={form.modelloStufa} onChange={(e) => set("modelloStufa", e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Stato anagrafica">
          <select
            className="field"
            value={form.stato}
            onChange={(e) => set("stato", e.target.value as StatoCliente)}
          >
            <option value="ATTIVO">Attivo</option>
            <option value="INATTIVO">Inattivo</option>
            <option value="PROSPECT">Prospect</option>
          </select>
        </Field>
        <Field label="Tecnico di riferimento">
          <select className="field" value={form.assignedUserId} onChange={(e) => set("assignedUserId", e.target.value)}>
            <option value="">Nessuno</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {technicianDisplayName(u)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.urgente} onChange={(e) => set("urgente", e.target.checked)} />
        Segna come urgente
      </label>

      <Field label="Note">
        <textarea className="field" rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} />
      </Field>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="btn btn-primary flex-1">
          {saving ? "Salvataggio…" : initial ? "Salva" : "Crea cliente"}
        </button>
        <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
          Annulla
        </button>
      </div>
    </form>
  );
}
