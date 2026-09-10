"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function AvailabilityForm({
  clientId,
  interventoId,
  onSaved,
}: {
  clientId: number;
  interventoId?: number;
  onSaved?: () => void;
}) {
  const [mode, setMode] = useState<"fascia" | "giorno" | "no" | "richiama">("fascia");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("18:00");
  const [weekday, setWeekday] = useState("2");
  const [periodo, setPeriodo] = useState("POMERIGGIO");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const tipo =
      mode === "fascia"
        ? "DISPONIBILE_FASCIA"
        : mode === "giorno"
          ? "DISPONIBILE_GIORNO"
          : mode === "no"
            ? "NON_DISPONIBILE"
            : "RICHIAMARE";

    const toMin = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };

    const body: Record<string, unknown> = {
      clientId,
      interventoId: interventoId ?? null,
      tipo,
    };
    if (mode === "fascia") {
      body.date = date;
      body.startMin = toMin(start);
      body.endMin = toMin(end);
    } else if (mode === "giorno") {
      body.weekday = parseInt(weekday, 10);
      body.periodo = periodo;
    } else {
      body.date = date;
    }

    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error((err as { error?: string }).error ?? "Errore salvataggio");
      return;
    }
    toast.success(mode === "richiama" ? "Richiamo salvato" : "Disponibilità salvata");
    onSaved?.();
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["fascia", "Fascia oraria"],
            ["giorno", "Giorno fisso"],
            ["no", "Non disponibile"],
            ["richiama", "Richiamare"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            className={`px-2 py-1 rounded-md text-xs font-medium ${
              mode === k ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {mode === "fascia" && (
        <div className="flex gap-2">
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
          <input type="time" className="field" value={start} onChange={(e) => setStart(e.target.value)} />
          <input type="time" className="field" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      )}
      {mode === "giorno" && (
        <div className="flex gap-2">
          <select className="field" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
            <option value="1">Lunedì</option>
            <option value="2">Martedì</option>
            <option value="3">Mercoledì</option>
            <option value="4">Giovedì</option>
            <option value="5">Venerdì</option>
            <option value="6">Sabato</option>
            <option value="7">Domenica</option>
          </select>
          <select className="field" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="MATTINA">Mattina</option>
            <option value="POMERIGGIO">Pomeriggio</option>
            <option value="SERA">Sera</option>
            <option value="TUTTO_IL_GIORNO">Tutto il giorno</option>
          </select>
        </div>
      )}
      {(mode === "no" || mode === "richiama") && (
        <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
      )}
      <button type="button" className="btn btn-primary text-xs" disabled={saving} onClick={() => void save()}>
        {saving ? "Salvo…" : "Salva disponibilità"}
      </button>
    </div>
  );
}
