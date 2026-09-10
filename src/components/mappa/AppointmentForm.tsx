"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, Search, CalendarDays, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type {
  Appointment,
  OrgUser,
  StatoAppuntamento,
  TipoAppuntamento,
} from "@/types/client";
import {
  TIPO_APPUNTAMENTO_LABEL,
  STATO_APPUNTAMENTO_LABEL,
  minutesToHHMM,
  hhmmToMinutes,
  toLocalDateKey,
} from "@/types/client";

interface ClientOption {
  id: number;
  nome: string;
  cognome: string;
  citta: string | null;
  indirizzo: string | null;
}

interface AppointmentFormProps {
  open: boolean;
  appointment: Appointment | null;
  defaults?: {
    clientId?: number;
    clientName?: string;
    date?: string;
    startMin?: number;
    technicianId?: string | null;
  };
  orgUsers: OrgUser[];
  onClose: () => void;
  onSaved: (apt: Appointment, isNew: boolean) => void;
  onDeleted?: (id: number) => void;
}

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

export default function AppointmentForm({
  open,
  appointment,
  defaults,
  orgUsers,
  onClose,
  onSaved,
  onDeleted,
}: AppointmentFormProps) {
  const isEdit = appointment != null;

  const [clientId, setClientId] = useState<number | null>(null);
  const [clientLabel, setClientLabel] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [showClientSearch, setShowClientSearch] = useState(false);

  const [technicianId, setTechnicianId] = useState<string>("");
  const [date, setDate] = useState(toLocalDateKey(new Date()));
  const [start, setStart] = useState("09:00");
  const [durationMin, setDurationMin] = useState(60);
  const [tipo, setTipo] = useState<TipoAppuntamento>("MANUTENZIONE");
  const [stato, setStato] = useState<StatoAppuntamento>("PIANIFICATO");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      setClientId(appointment.clientId);
      setClientLabel(
        [appointment.client.cognome, appointment.client.nome].filter(Boolean).join(" ")
      );
      setTechnicianId(appointment.technicianId ?? "");
      setDate(appointment.date);
      setStart(minutesToHHMM(appointment.startMin));
      setDurationMin(appointment.durationMin);
      setTipo(appointment.tipo);
      setStato(appointment.stato);
      setNote(appointment.note ?? "");
    } else {
      setClientId(defaults?.clientId ?? null);
      setClientLabel(defaults?.clientName ?? "");
      setTechnicianId(defaults?.technicianId ?? "");
      setDate(defaults?.date ?? toLocalDateKey(new Date()));
      setStart(minutesToHHMM(defaults?.startMin ?? 540));
      setDurationMin(60);
      setTipo("MANUTENZIONE");
      setStato("PIANIFICATO");
      setNote("");
    }
    setClientQuery("");
    setClientOptions([]);
    setShowClientSearch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || isEdit || clientId != null) return;
    if (!clientQuery.trim()) {
      setClientOptions([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchingClients(true);
      try {
        const res = await fetch(
          `/api/clients?slim=1&limit=8&search=${encodeURIComponent(clientQuery.trim())}`
        );
        const data = await res.json();
        setClientOptions(Array.isArray(data.items) ? data.items : []);
        setShowClientSearch(true);
      } catch {
        setClientOptions([]);
      } finally {
        setSearchingClients(false);
      }
    }, 250);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [clientQuery, open, isEdit, clientId]);

  if (!open) return null;

  async function handleSave() {
    if (clientId == null) {
      toast.error("Seleziona un cliente");
      return;
    }
    const startMin = hhmmToMinutes(start);
    if (startMin == null) {
      toast.error("Ora non valida");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error("Data non valida");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        clientId,
        technicianId: technicianId || null,
        date,
        startMin,
        durationMin,
        tipo,
        stato,
        note: note.trim() || null,
      };
      const res = await fetch(
        isEdit ? `/api/appointments/${appointment!.id}` : "/api/appointments",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore salvataggio");
      toast.success(isEdit ? "Appuntamento aggiornato" : "Appuntamento creato");
      onSaved(data, !isEdit);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!appointment) return;
    if (!confirm("Eliminare questo appuntamento?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Errore eliminazione");
      }
      toast.success("Appuntamento eliminato");
      onDeleted?.(appointment.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore eliminazione");
    } finally {
      setDeleting(false);
    }
  }

  const inputCls =
    "w-full rounded-xl glass-input px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400";
  const labelCls =
    "block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5";

  return (
    <div className="fixed inset-0 z-[850] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto panel-scroll glass-strong rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/30">
              <CalendarDays size={17} className="text-white" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {isEdit ? "Modifica appuntamento" : "Nuovo appuntamento"}
              </h2>
              <p className="text-[11px] text-slate-500">
                {isEdit ? `#${appointment.id}` : "Aggiungi una visita al calendario"}
              </p>
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

        <div className="px-5 pb-5 space-y-4">
          <div>
            <label className={labelCls}>Cliente</label>
            {isEdit || clientId != null ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-indigo-500/10 border border-indigo-200/60 px-3 py-2.5">
                <span className="text-sm font-semibold text-slate-800 truncate">
                  {clientLabel || "Cliente"}
                </span>
                {!isEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setClientId(null);
                      setClientLabel("");
                      setClientQuery("");
                    }}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 shrink-0"
                  >
                    Cambia
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className={`${inputCls} pl-9`}
                  placeholder="Cerca per nome, città, telefono…"
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  autoFocus
                />
                {searchingClients && (
                  <Loader2
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin"
                  />
                )}
                {showClientSearch && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl glass-strong shadow-xl border border-white/60 overflow-hidden max-h-56 overflow-y-auto panel-scroll">
                    {clientOptions.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-slate-500">
                        Nessun cliente trovato
                      </div>
                    ) : (
                      clientOptions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setClientId(c.id);
                            setClientLabel(
                              [c.cognome, c.nome].filter(Boolean).join(" ")
                            );
                            setShowClientSearch(false);
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-indigo-500/10 transition-colors border-b border-white/40 last:border-b-0"
                        >
                          <span className="block text-sm font-semibold text-slate-800">
                            {[c.cognome, c.nome].filter(Boolean).join(" ")}
                          </span>
                          <span className="block text-[11px] text-slate-500 truncate">
                            {[c.indirizzo, c.citta].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data</label>
              <input
                type="date"
                className={inputCls}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Ora inizio</label>
              <input
                type="time"
                className={inputCls}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Durata</label>
              <select
                className={inputCls}
                value={durationMin}
                onChange={(e) => setDurationMin(parseInt(e.target.value, 10))}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d >= 60 ? `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60} min` : ""}` : `${d} min`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tecnico</label>
              <select
                className={inputCls}
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
              >
                <option value="">Non assegnato</option>
                {orgUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo</label>
              <select
                className={inputCls}
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoAppuntamento)}
              >
                {(Object.keys(TIPO_APPUNTAMENTO_LABEL) as TipoAppuntamento[]).map((t) => (
                  <option key={t} value={t}>
                    {TIPO_APPUNTAMENTO_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Stato</label>
              <select
                className={inputCls}
                value={stato}
                onChange={(e) => setStato(e.target.value as StatoAppuntamento)}
              >
                {(Object.keys(STATO_APPUNTAMENTO_LABEL) as StatoAppuntamento[]).map((s) => (
                  <option key={s} value={s}>
                    {STATO_APPUNTAMENTO_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Note</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Es. portare ricambio, chiedere accesso…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {isEdit && stato !== "ANNULLATO" && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
              <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-800 leading-snug">
                Per annullare usa lo stato &quot;Annullato&quot;: resta nello storico
                dell&apos;agenda.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center justify-center w-11 h-11 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 shrink-0"
                title="Elimina appuntamento"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-slate-200/80 bg-white/60 text-sm font-semibold text-slate-600 hover:bg-white transition-colors"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || clientId == null}
              className="flex-1 h-11 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-900/25 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {isEdit ? "Salva" : "Crea appuntamento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
