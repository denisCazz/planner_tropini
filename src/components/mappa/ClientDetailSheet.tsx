"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { X, Phone, MapPin, User, ChevronRight, CalendarPlus, CalendarDays } from "lucide-react";
import type { Client, StatoCliente, Appointment } from "@/types/client";
import {
  minutesToHHMM,
  formatItalianDate,
  STATO_APPUNTAMENTO_LABEL,
} from "@/types/client";
import ClientNotesPanel from "@/components/ClientNotesPanel";

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

interface ClientDetailSheetProps {
  client: Client | null;
  open: boolean;
  onClose: () => void;
  onNewAppointment?: (clientId: number, clientName: string) => void;
}

export default function ClientDetailSheet({
  client,
  open,
  onClose,
  onNewAppointment,
}: ClientDetailSheetProps) {
  const [nextAppointments, setNextAppointments] = useState<Appointment[]>([]);

  const loadAppointments = useCallback((clientId: number) => {
    fetch(`/api/appointments?clientId=${clientId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Appointment[]) => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        const todayKey = `${y}-${m}-${d}`;
        const upcoming = (Array.isArray(data) ? data : [])
          .filter((a) => a.date >= todayKey && a.stato !== "ANNULLATO")
          .sort((a, b) => (a.date === b.date ? a.startMin - b.startMin : a.date < b.date ? -1 : 1));
        setNextAppointments(upcoming.slice(0, 3));
      })
      .catch(() => setNextAppointments([]));
  }, []);

  useEffect(() => {
    if (open && client) loadAppointments(client.id);
    else setNextAppointments([]);
  }, [open, client, loadAppointments]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || !client) return null;

  const displayName = [client.cognome, client.nome].filter(Boolean).join(" ") || "Cliente";

  return (
    <div className="fixed inset-0 z-[800] flex justify-end pointer-events-none">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] pointer-events-auto"
        onClick={onClose}
      />
      <aside className="relative w-full max-w-[420px] h-full glass-strong shadow-2xl flex flex-col pointer-events-auto">
        <div className="flex items-start gap-3 px-4 py-4 border-b border-white/40 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-lg font-bold text-slate-900 truncate">{displayName}</h2>
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATO_COLORS[client.stato]}`}
              >
                {STATO_LABELS[client.stato]}
              </span>
              {client.urgente && (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  Urgente
                </span>
              )}
            </div>
            <Link
              href={`/clienti/${client.id}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              Scheda completa
              <ChevronRight size={14} />
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/60 text-slate-500 transition-colors shrink-0"
            title="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto panel-scroll px-4 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {client.telefono && (
              <a
                href={`tel:${client.telefono.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors"
              >
                <Phone size={14} />
                Chiama
              </a>
            )}
            {onNewAppointment && (
              <button
                type="button"
                onClick={() => onNewAppointment(client.id, displayName)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <CalendarPlus size={14} />
                Dai appuntamento
              </button>
            )}
            {client.indirizzo && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/60 text-slate-700 text-sm">
                <MapPin size={14} className="text-slate-400 shrink-0" />
                <span className="truncate max-w-[240px]">{client.indirizzo}</span>
              </span>
            )}
            {client.assignedUserName && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/60 text-slate-700 text-sm">
                <User size={14} className="text-indigo-500 shrink-0" />
                {client.assignedUserName}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <CalendarDays size={14} className="text-indigo-500" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Prossimi appuntamenti
              </h3>
            </div>
            {nextAppointments.length === 0 ? (
              <p className="text-xs text-slate-400 px-1">Nessuna visita pianificata.</p>
            ) : (
              <div className="space-y-1.5">
                {nextAppointments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white/60 border border-white/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-800 capitalize">
                        {formatItalianDate(a.date)} · {minutesToHHMM(a.startMin)}
                      </span>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {a.technicianName ?? "Non assegnato"}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-semibold shrink-0">
                      {STATO_APPUNTAMENTO_LABEL[a.stato]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ClientNotesPanel clientId={client.id} compact />
        </div>
      </aside>
    </div>
  );
}
