"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Phone,
  CheckCircle2,
  CircleDashed,
  Wrench,
  Hammer,
  Eye,
  Siren,
  Navigation,
  UserX,
  Loader2,
  CalendarOff,
} from "lucide-react";
import type {
  Appointment,
  OrgUser,
  StatoAppuntamento,
  TipoAppuntamento,
} from "@/types/client";
import {
  minutesToHHMM,
  toLocalDateKey,
  addDaysToDateKey,
  formatItalianDateLong,
  TIPO_APPUNTAMENTO_LABEL,
} from "@/types/client";

export type AgendaTechFilter = "" | "none" | string;

interface AgendaPanelProps {
  date: string;
  onDateChange: (d: string) => void;
  appointments: Appointment[];
  loading: boolean;
  orgUsers: OrgUser[];
  techFilter: AgendaTechFilter;
  onTechFilterChange: (f: AgendaTechFilter) => void;
  onNewAppointment: (defaults: {
    startMin: number;
    technicianId: string | null;
  }) => void;
  onEditAppointment: (apt: Appointment) => void;
  onSetStato: (apt: Appointment, stato: StatoAppuntamento) => void;
  /** Chiamato al posto di onSetStato quando si segna "completato" (per registrare il ricavo) */
  onComplete?: (apt: Appointment) => void;
  onFocusAppointment: (apt: Appointment) => void;
  onOptimizeDay: () => void;
  optimizing: boolean;
}

const TIPO_ICONS: Record<TipoAppuntamento, typeof Wrench> = {
  MANUTENZIONE: Wrench,
  INSTALLAZIONE: Hammer,
  SOPRALLUOGO: Eye,
  PRONTO_INTERVENTO: Siren,
};

const STATO_STYLE: Record<
  StatoAppuntamento,
  { border: string; bg: string; badge: string; label: string }
> = {
  PIANIFICATO: {
    border: "border-l-sky-400",
    bg: "bg-sky-500/10 hover:bg-sky-500/20",
    badge: "bg-sky-100 text-sky-700",
    label: "Pianificato",
  },
  CONFERMATO: {
    border: "border-l-indigo-500",
    bg: "bg-indigo-500/10 hover:bg-indigo-500/20",
    badge: "bg-indigo-100 text-indigo-700",
    label: "Confermato",
  },
  COMPLETATO: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/10 hover:bg-emerald-500/20",
    badge: "bg-emerald-100 text-emerald-700",
    label: "Completato",
  },
  ANNULLATO: {
    border: "border-l-slate-300",
    bg: "bg-slate-400/10 hover:bg-slate-400/15 opacity-60",
    badge: "bg-slate-200 text-slate-600",
    label: "Annullato",
  },
};

const HOUR_START = 6 * 60;
const HOUR_END = 20 * 60;
const SLOT_STEP = 30;

function AppointmentCard({
  apt,
  onEdit,
  onSetStato,
  onComplete,
  onFocus,
}: {
  apt: Appointment;
  onEdit: () => void;
  onSetStato: (s: StatoAppuntamento) => void;
  onComplete?: () => void;
  onFocus: () => void;
}) {
  const style = STATO_STYLE[apt.stato];
  const TipoIcon = TIPO_ICONS[apt.tipo];
  const endMin = apt.startMin + apt.durationMin;
  const hasCoords = apt.client.lat != null && apt.client.lng != null;

  return (
    <div
      className={`group rounded-xl border border-white/50 border-l-4 ${style.border} ${style.bg} px-3 py-2.5 transition-colors cursor-pointer`}
      onClick={onEdit}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-800 tabular-nums">
          {minutesToHHMM(apt.startMin)} – {minutesToHHMM(endMin)}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${style.badge}`}
        >
          {style.label}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <TipoIcon size={13} className="text-slate-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-900 truncate">
          {[apt.client.cognome, apt.client.nome].filter(Boolean).join(" ")}
        </span>
        {apt.client.urgente && (
          <span className="px-1 py-0.5 rounded bg-red-100 text-red-700 text-[9px] font-bold uppercase">
            Urgente
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <span className="text-[11px] text-slate-500 truncate">
          {TIPO_APPUNTAMENTO_LABEL[apt.tipo]}
          {apt.client.citta ? ` · ${apt.client.citta}` : ""}
        </span>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasCoords && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFocus();
              }}
              className="p-1 rounded-md hover:bg-white/70 text-slate-500"
              title="Mostra sulla mappa"
            >
              <MapPin size={12} />
            </button>
          )}
          {apt.client.telefono && (
            <a
              href={`tel:${apt.client.telefono.replace(/\s/g, "")}`}
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded-md hover:bg-white/70 text-slate-500"
              title="Chiama"
            >
              <Phone size={12} />
            </a>
          )}
          {apt.stato === "PIANIFICATO" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetStato("CONFERMATO");
              }}
              className="p-1 rounded-md hover:bg-white/70 text-indigo-600"
              title="Conferma"
            >
              <CircleDashed size={12} />
            </button>
          )}
          {(apt.stato === "PIANIFICATO" || apt.stato === "CONFERMATO") && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onComplete) onComplete();
                else onSetStato("COMPLETATO");
              }}
              className="p-1 rounded-md hover:bg-white/70 text-emerald-600"
              title="Segna completato (registra ricavo)"
            >
              <CheckCircle2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgendaPanel({
  date,
  onDateChange,
  appointments,
  loading,
  orgUsers,
  techFilter,
  onTechFilterChange,
  onNewAppointment,
  onEditAppointment,
  onSetStato,
  onComplete,
  onFocusAppointment,
  onOptimizeDay,
  optimizing,
}: AgendaPanelProps) {
  const [addingSlot, setAddingSlot] = useState<{
    techId: string | null;
    startMin: number;
  } | null>(null);

  const todayKey = toLocalDateKey(new Date());
  const isToday = date === todayKey;

  const byTech = useMemo(() => {
    const map = new globalThis.Map<string | null, Appointment[]>();
    map.set(null, []);
    for (const u of orgUsers) map.set(u.id, []);
    for (const apt of appointments) {
      const key = apt.technicianId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(apt);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startMin - b.startMin);
    }
    return map;
  }, [appointments, orgUsers]);

  const lanes: { techId: string | null; name: string }[] = useMemo(() => {
    const lanesList: { techId: string | null; name: string }[] = [];
    if (techFilter === "") {
      for (const u of orgUsers) lanesList.push({ techId: u.id, name: u.username });
      lanesList.push({ techId: null, name: "Non assegnati" });
    } else if (techFilter === "none") {
      lanesList.push({ techId: null, name: "Non assegnati" });
    } else {
      const u = orgUsers.find((x) => x.id === techFilter);
      lanesList.push({ techId: techFilter, name: u?.username ?? "Tecnico" });
    }
    return lanesList;
  }, [orgUsers, techFilter]);

  const slots = useMemo(() => {
    const arr: number[] = [];
    for (let m = HOUR_START; m < HOUR_END; m += SLOT_STEP) arr.push(m);
    return arr;
  }, []);

  const aptAtSlot = (list: Appointment[], slotStart: number) =>
    list.filter(
      (a) =>
        a.startMin >= slotStart &&
        a.startMin < slotStart + SLOT_STEP &&
        a.stato !== "ANNULLATO"
    );

  const actionable = appointments.filter(
    (a) => a.stato !== "ANNULLATO" && a.stato !== "COMPLETATO"
  ).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Navigazione data */}
      <div className="px-3 pt-3 pb-2 shrink-0 border-b border-white/40">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onDateChange(addDaysToDateKey(date, -1))}
            className="p-1.5 rounded-lg hover:bg-white/60 text-slate-500 transition-colors"
            title="Giorno precedente"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 text-center">
            <span className="block text-sm font-bold text-slate-900 capitalize">
              {formatItalianDateLong(date)}
            </span>
            {isToday && (
              <span className="inline-block px-1.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wide">
                Oggi
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDateChange(addDaysToDateKey(date, 1))}
            className="p-1.5 rounded-lg hover:bg-white/60 text-slate-500 transition-colors"
            title="Giorno successivo"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 mt-2">
          <button
            type="button"
            onClick={() => onTechFilterChange("")}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
              techFilter === ""
                ? "bg-slate-800 text-white"
                : "bg-white/60 text-slate-600 hover:bg-white"
            }`}
          >
            Tutti
          </button>
          {orgUsers.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onTechFilterChange(u.id)}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors truncate max-w-20 ${
                techFilter === u.id
                  ? "bg-indigo-600 text-white"
                  : "bg-white/60 text-slate-600 hover:bg-white"
              }`}
              title={u.username}
            >
              {u.username}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onTechFilterChange("none")}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
              techFilter === "none"
                ? "bg-amber-500 text-white"
                : "bg-white/60 text-slate-600 hover:bg-white"
            }`}
            title="Solo non assegnati"
          >
            <UserX size={11} />
            Liberi
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 min-h-0 overflow-y-auto panel-scroll">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-indigo-500" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <span className="w-12 h-12 rounded-2xl bg-white/60 flex items-center justify-center mb-3">
              <CalendarOff size={20} className="text-slate-400" />
            </span>
            <p className="text-sm font-semibold text-slate-700">Nessun appuntamento</p>
            <p className="text-xs text-slate-500 mt-1">
              Tocca uno slot orario o usa &quot;+&quot; per pianificare una visita.
            </p>
          </div>
        ) : (
          lanes.map((lane) => {
            const list = byTech.get(lane.techId) ?? [];
            const visible = list;
            return (
              <div key={lane.techId ?? "none"} className="border-b border-white/40 last:border-b-0">
                <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-1.5 glass-strong">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        lane.techId === null ? "bg-amber-400" : "bg-indigo-500"
                      }`}
                    />
                    {lane.name}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {visible.filter((a) => a.stato !== "ANNULLATO").length} visite
                  </span>
                </div>

                <div className="px-3 py-1.5 space-y-0.5">
                  {slots.map((slot) => {
                    const items = aptAtSlot(visible, slot);
                    const isHour = slot % 60 === 0;
                    const key = `${lane.techId ?? "none"}-${slot}`;
                    const isAddingHere =
                      addingSlot?.techId === lane.techId &&
                      addingSlot.startMin === slot;
                    return (
                      <div key={key}>
                        <div
                          className={`flex items-center gap-2 group/slot ${
                            isHour ? "pt-1.5" : ""
                          }`}
                        >
                          <span
                            className={`w-10 text-right text-[10px] tabular-nums shrink-0 ${
                              isHour
                                ? "text-slate-500 font-semibold"
                                : "text-slate-300 font-medium"
                            }`}
                          >
                            {isHour ? minutesToHHMM(slot) : "·"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setAddingSlot(
                                isAddingHere ? null : { techId: lane.techId, startMin: slot }
                              )
                            }
                            className={`flex-1 h-2 rounded-full transition-colors ${
                              isAddingHere
                                ? "bg-indigo-400"
                                : items.length > 0
                                  ? "bg-indigo-500/30"
                                  : "bg-slate-200/70 group-hover/slot:bg-indigo-300"
                            }`}
                            title={`Aggiungi alle ${minutesToHHMM(slot)}`}
                          />
                        </div>
                        {items.map((apt) => (
                          <div key={apt.id} className="ml-12 mt-1 mb-1.5">
                            <AppointmentCard
                              apt={apt}
                              onEdit={() => onEditAppointment(apt)}
                              onSetStato={(s) => onSetStato(apt, s)}
                              onComplete={onComplete ? () => onComplete(apt) : undefined}
                              onFocus={() => onFocusAppointment(apt)}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer azioni */}
      <div className="shrink-0 border-t border-white/40 p-3 space-y-2">
        {addingSlot && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-indigo-500/10 border border-indigo-200/70 px-3 py-2">
            <span className="text-xs font-semibold text-indigo-800">
              Nuovo alle {minutesToHHMM(addingSlot.startMin)}
              {addingSlot.techId
                ? ` · ${orgUsers.find((u) => u.id === addingSlot.techId)?.username ?? ""}`
                : " · non assegnato"}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setAddingSlot(null)}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-500 hover:bg-white/70"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  onNewAppointment({
                    startMin: addingSlot.startMin,
                    technicianId: addingSlot.techId,
                  });
                  setAddingSlot(null);
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold"
              >
                Continua
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => onNewAppointment({ startMin: 540, technicianId: null })}
          className="w-full h-10 rounded-xl bg-white/60 border border-white/60 text-sm font-semibold text-indigo-700 hover:bg-white transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Nuovo appuntamento
        </button>

        {actionable > 1 && (
          <button
            type="button"
            onClick={onOptimizeDay}
            disabled={optimizing}
            className="w-full h-10 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-900/25 hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {optimizing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Navigation size={15} />
            )}
            Ottimizza giro di oggi ({actionable} tappe)
          </button>
        )}
      </div>
    </div>
  );
}
