"use client";

import { useState } from "react";
import type { Client, ClientFormData, StatoCliente } from "@/types/client";
import { toast } from "sonner";

interface ClientFormProps {
  initial?: Client;
  onSaved: (client: Client) => void;
  onClose: () => void;
}

const EMPTY: ClientFormData = {
  nome: "",
  cognome: "",
  email: "",
  telefono: "",
  telefono2: "",
  indirizzo: "",
  cap: "",
  citta: "",
  provincia: "",
  marcaStufa: "",
  modelloStufa: "",
  note: "",
  stato: "PROSPECT",
  urgente: false,
  ultimaVisita: "",
};

export default function ClientForm({
  initial,
  onSaved,
  onClose,
}: ClientFormProps) {
  const [form, setForm] = useState<ClientFormData>(() =>
    initial
      ? {
          nome: initial.nome,
          cognome: initial.cognome,
          email: initial.email ?? "",
          telefono: initial.telefono ?? "",
          telefono2: initial.telefono2 ?? "",
          indirizzo: initial.indirizzo ?? "",
          cap: initial.cap ?? "",
          citta: initial.citta ?? "",
          provincia: initial.provincia ?? "",
          marcaStufa: initial.marcaStufa ?? "",
          modelloStufa: initial.modelloStufa ?? "",
          note: initial.note ?? "",
          stato: initial.stato,
          urgente: initial.urgente,
          ultimaVisita: initial.ultimaVisita
            ? initial.ultimaVisita.substring(0, 10)
            : "",
        }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);

  const set = (field: keyof ClientFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Il nome è obbligatorio");
      return;
    }
    setSaving(true);
    try {
      const url = initial ? `/api/clients/${initial.id}` : "/api/clients";
      const method = initial ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Errore salvataggio");
      }

      const saved: Client = await res.json();
      toast.success(initial ? "Cliente aggiornato" : "Cliente creato");
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.nome}
            onChange={(e) => set("nome", e.target.value)}
            placeholder="Mario"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cognome
          </label>
          <input
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.cognome}
            onChange={(e) => set("cognome", e.target.value)}
            placeholder="Rossi"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="mario.rossi@email.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Telefono
          </label>
          <input
            type="tel"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.telefono}
            onChange={(e) => set("telefono", e.target.value)}
            placeholder="+39 333 1234567"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Telefono 2
          </label>
          <input
            type="tel"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.telefono2}
            onChange={(e) => set("telefono2", e.target.value)}
            placeholder="+39 347 7654321"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Indirizzo
        </label>
        <input
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.indirizzo}
          onChange={(e) => set("indirizzo", e.target.value)}
          placeholder="Via Roma 1"
        />
        <p className="text-xs text-gray-400 mt-1">
          Le coordinate vengono calcolate automaticamente dall&apos;indirizzo
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Città
          </label>
          <input
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.citta}
            onChange={(e) => set("citta", e.target.value)}
            placeholder="Torino"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CAP
          </label>
          <input
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.cap}
            onChange={(e) => set("cap", e.target.value)}
            placeholder="10100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Provincia
          </label>
          <input
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.provincia}
            onChange={(e) => set("provincia", e.target.value)}
            placeholder="TO"
            maxLength={2}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Marca Stufa
          </label>
          <input
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.marcaStufa}
            onChange={(e) => set("marcaStufa", e.target.value)}
            placeholder="MCZ"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Modello Stufa
          </label>
          <input
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.modelloStufa}
            onChange={(e) => set("modelloStufa", e.target.value)}
            placeholder="Star 3.0"
          />
        </div>
      </div>

      {/* ── Icona / Stato + Urgente ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Icona mappa
        </label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "PROSPECT", color: "#d97706", label: "Non categorizzato" },
              { value: "ATTIVO",   color: "#16a34a", label: "Attivo" },
              { value: "INATTIVO", color: "#6b7280", label: "Inattivo" },
            ] as { value: StatoCliente; color: string; label: string }[]
          ).map(({ value, color, label }) => {
            const active = form.stato === value && !form.urgente;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, stato: value, urgente: false }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  active
                    ? "border-gray-400 bg-gray-50 shadow-sm"
                    : "border-transparent bg-gray-100 hover:bg-gray-200"
                }`}
              >
                <svg width="18" height="22" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill={color} stroke="white" strokeWidth="2"/>
                  <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
                </svg>
                <span style={{ color }}>{label}</span>
              </button>
            );
          })}
          {/* Urgente (rosso con !) */}
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, urgente: !p.urgente }))}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
              form.urgente
                ? "border-red-400 bg-red-50 shadow-sm"
                : "border-transparent bg-gray-100 hover:bg-gray-200"
            }`}
          >
            <svg width="18" height="22" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="#dc2626" stroke="white" strokeWidth="2"/>
              <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
              <text x="14" y="18" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#dc2626">!</text>
            </svg>
            <span className="text-red-600">Urgente</span>
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          {form.urgente
            ? "Pin rosso con ! — cliente da visitare con priorità"
            : form.stato === "ATTIVO"
            ? "Pin verde — cliente attivo"
            : form.stato === "INATTIVO"
            ? "Pin grigio — cliente inattivo"
            : "Pin arancione — non categorizzato"}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ultima Visita
        </label>
        <input
          type="date"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.ultimaVisita}
          onChange={(e) => set("ultimaVisita", e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Note
        </label>
        <textarea
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="Note aggiuntive..."
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md text-sm transition-colors"
        >
          {saving ? "Salvataggio..." : initial ? "Aggiorna" : "Crea cliente"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-md text-sm transition-colors"
        >
          Annulla
        </button>
      </div>
    </form>
  );
}
