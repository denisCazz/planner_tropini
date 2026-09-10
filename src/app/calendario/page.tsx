"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { Appointment } from "@/types/client";
import {
  addDaysToDateKey,
  formatItalianDate,
  minutesToHHMM,
  toLocalDateKey,
} from "@/lib/dates";
import { useOrgUsers } from "@/lib/useOrgUsers";
import { technicianDisplayName } from "@/lib/roles";
import PageHeader from "@/components/ui/PageHeader";

const HOUR_START = 7 * 60;
const HOUR_END = 20 * 60;
const SLOT = 30;

export default function CalendarioPage() {
  const [view, setView] = useState<"day" | "week">("week");
  const [cursor, setCursor] = useState(() => toLocalDateKey(new Date()));
  const [tech, setTech] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const { users } = useOrgUsers();

  const weekStart = useMemo(() => {
    const [y, m, d] = cursor.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dow = (date.getDay() + 6) % 7;
    return addDaysToDateKey(cursor, -dow);
  }, [cursor]);

  const days = view === "day" ? [cursor] : Array.from({ length: 7 }, (_, i) => addDaysToDateKey(weekStart, i));
  const from = days[0];
  const to = days[days.length - 1];

  const load = useCallback(() => {
    const p = new URLSearchParams({ from, to });
    if (tech) p.set("technicianId", tech);
    fetch(`/api/appointments?${p}`)
      .then((r) => r.json())
      .then((d) => setAppointments(Array.isArray(d) ? d : []))
      .catch(() => setAppointments([]));
  }, [from, to, tech]);

  useEffect(() => {
    load();
  }, [load]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = HOUR_START; m < HOUR_END; m += SLOT) list.push(m);
    return list;
  }, []);

  async function onDrop(date: string, startMin: number, aptId: number) {
    const res = await fetch(`/api/appointments/${aptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, startMin }),
    });
    if (!res.ok) {
      toast.error("Spostamento non riuscito");
      return;
    }
    toast.success("Appuntamento spostato");
    load();
  }

  async function patchTech(aptId: number, technicianId: string) {
    await fetch(`/api/appointments/${aptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ technicianId: technicianId || null }),
    });
    load();
  }

  async function patchStato(aptId: number, stato: string) {
    await fetch(`/api/appointments/${aptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stato }),
    });
    load();
  }

  return (
    <div className="p-5 max-w-[1400px] mx-auto">
      <PageHeader
        title="Calendario"
        subtitle="Giorno / settimana · trascina per spostare"
        action={
          <div className="flex gap-2">
            <button className={`btn ${view === "day" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("day")}>Giorno</button>
            <button className={`btn ${view === "week" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("week")}>Settimana</button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button className="btn btn-ghost" onClick={() => setCursor(addDaysToDateKey(cursor, view === "day" ? -1 : -7))}>
          <ChevronLeft size={16} />
        </button>
        <button className="btn btn-ghost" onClick={() => setCursor(toLocalDateKey(new Date()))}>Oggi</button>
        <button className="btn btn-ghost" onClick={() => setCursor(addDaysToDateKey(cursor, view === "day" ? 1 : 7))}>
          <ChevronRight size={16} />
        </button>
        <span className="text-sm font-medium px-2">
          {formatItalianDate(from)}{view === "week" ? ` – ${formatItalianDate(to)}` : ""}
        </span>
        <select className="field w-48 ml-auto" value={tech} onChange={(e) => setTech(e.target.value)}>
          <option value="">Tutti i tecnici</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{technicianDisplayName(u)}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-auto">
        <div className="min-w-[720px]" style={{ display: "grid", gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}>
          <div className="sticky top-0 bg-slate-50 z-10" />
          {days.map((d) => (
            <div key={d} className="sticky top-0 bg-slate-50 z-10 px-2 py-2 text-xs font-semibold border-b border-slate-200">
              {formatItalianDate(d)}
            </div>
          ))}
          {hours.map((min) => (
            <HourRow
              key={min}
              min={min}
              days={days}
              appointments={appointments}
              onDrop={onDrop}
              onStato={patchStato}
              onTech={patchTech}
              users={users}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HourRow({
  min,
  days,
  appointments,
  onDrop,
  onStato,
  onTech,
  users,
}: {
  min: number;
  days: string[];
  appointments: Appointment[];
  onDrop: (date: string, startMin: number, id: number) => void;
  onStato: (id: number, stato: string) => void;
  onTech: (id: number, tech: string) => void;
  users: { id: string; username: string; nome?: string | null; cognome?: string | null }[];
}) {
  return (
    <>
      <div className="text-[10px] text-slate-400 px-1 py-1 border-t border-slate-100 tabular-nums">
        {minutesToHHMM(min)}
      </div>
      {days.map((d) => {
        const here = appointments.filter((a) => a.date === d && a.startMin >= min && a.startMin < min + SLOT);
        return (
          <div
            key={d + min}
            className="border-t border-l border-slate-100 min-h-[36px] p-0.5"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = Number(e.dataTransfer.getData("apt"));
              if (id) onDrop(d, min, id);
            }}
          >
            {here.map((a) => (
              <div
                key={a.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("apt", String(a.id))}
                className="cal-block rounded-md bg-teal-700 text-white px-1.5 py-1 text-[11px] mb-0.5"
              >
                <div className="font-semibold truncate">
                  {a.client.cognome} {a.client.nome}
                </div>
                <div className="opacity-80 truncate">
                  {minutesToHHMM(a.startMin)} · {a.durationMin}m · {a.technicianName ?? "—"}
                </div>
                <div className="flex gap-1 mt-1">
                  <select
                    className="bg-teal-800 rounded text-[10px]"
                    value={a.stato}
                    onChange={(e) => onStato(a.id, e.target.value)}
                  >
                    <option value="PIANIFICATO">Pianificato</option>
                    <option value="CONFERMATO">Confermato</option>
                    <option value="COMPLETATO">Completato</option>
                    <option value="ANNULLATO">Annullato</option>
                  </select>
                  <select
                    className="bg-teal-800 rounded text-[10px] max-w-[90px]"
                    value={a.technicianId ?? ""}
                    onChange={(e) => onTech(a.id, e.target.value)}
                  >
                    <option value="">—</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{technicianDisplayName(u)}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
