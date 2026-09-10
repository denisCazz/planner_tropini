"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Euro } from "lucide-react";
import { toast } from "sonner";
import type { Appointment } from "@/types/client";
import { toLocalDateKey } from "@/types/client";

interface InterventoFormProps {
  open: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function InterventoForm({ open, appointment, onClose, onSaved }: InterventoFormProps) {
  const [ricavo, setRicavo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [data, setData] = useState(toLocalDateKey(new Date()));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
      setRicavo("");
      setDescrizione("");
      setData(appointment?.date ?? toLocalDateKey(new Date()));
    }
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, appointment, onClose]);

  if (!open || !appointment) return null;

  async function handleSave() {
    const value = parseFloat(ricavo.replace(",", "."));
    if (Number.isNaN(value) || value < 0) {
      toast.error("Ricavo non valido");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/interventi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: appointment!.clientId,
          appointmentId: appointment!.id,
          technicianId: appointment!.technicianId,
          data,
          ricavo: value,
          descrizione: descrizione.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Errore salvataggio");
      toast.success(`Ricavo registrato: € ${value.toLocaleString("it-IT")}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  const clientName = [appointment.client.cognome, appointment.client.nome]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="fixed inset-0 z-[860] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm glass-strong rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/30">
              <Euro size={17} className="text-white" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Registra intervento</h2>
              <p className="text-[11px] text-slate-500 truncate max-w-[200px]">{clientName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/70 text-slate-500 transition-colors"
            title="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Ricavo (€)
              </label>
              <input
                className="w-full rounded-xl glass-input px-3 py-2.5 text-sm"
                inputMode="decimal"
                placeholder="120"
                value={ricavo}
                onChange={(e) => setRicavo(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Data
              </label>
              <input
                type="date"
                className="w-full rounded-xl glass-input px-3 py-2.5 text-sm"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Descrizione
            </label>
            <input
              className="w-full rounded-xl glass-input px-3 py-2.5 text-sm"
              placeholder="Pulizia completa, ricambio guarnizione…"
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-11 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-lg shadow-emerald-900/25 hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Registra ricavo
          </button>
        </div>
      </div>
    </div>
  );
}
