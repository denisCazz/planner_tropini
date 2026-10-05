"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/ui/PageHeader";
import { useOrgUsers } from "@/lib/useOrgUsers";
import { technicianDisplayName } from "@/lib/roles";
import type { SessionRole } from "@/lib/roles";

const CATEGORIE = [
  ["CARBURANTE", "Carburante"],
  ["PEDAGGI", "Pedaggi"],
  ["RICAMBI", "Ricambi"],
  ["ATTREZZATURA", "Attrezzatura"],
  ["ALLOGGIO", "Alloggio"],
  ["MARKETING", "Marketing"],
  ["VARIE", "Varie"],
] as const;

interface Movimento {
  id: number;
  data: string;
  technician: string;
  zona: string;
  tappe: number;
  km: number;
  minuti: number | null;
  carburante: number;
}

interface SpesaRow {
  id: number;
  data: string;
  categoria: string;
  importo: number;
  descrizione: string | null;
}

interface Summary {
  movimenti: Movimento[];
  spese: SpesaRow[];
  fuel: { consumoL100: number; fuel: string; price: number | null; at: string | null; source: string };
  totali: { km: number; carburante: number; spese: number; totale: number };
}

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function euro(n: number) {
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export default function CostiPage() {
  const { users } = useOrgUsers();
  const [month, setMonth] = useState(thisMonth);
  const [technicianId, setTechnicianId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<SessionRole | null>(null);
  const [fuelType, setFuelType] = useState("Gasolio");
  const [consumo, setConsumo] = useState("7");
  const [manualPrice, setManualPrice] = useState("");
  const [spesa, setSpesa] = useState({ data: new Date().toISOString().slice(0, 10), categoria: "CARBURANTE", importo: "", descrizione: "" });

  function applySummary(data: Summary) {
    setSummary(data);
    setFuelType(data.fuel.fuel || "Gasolio");
    setConsumo(String(data.fuel.consumoL100 ?? 7));
    if (data.fuel.price != null) setManualPrice(String(data.fuel.price));
    setLoading(false);
  }

  async function fetchSummary(refresh = false) {
    try {
      const p = new URLSearchParams({ month });
      if (technicianId) p.set("technicianId", technicianId);
      if (refresh) p.set("refresh", "1");
      const res = await fetch(`/api/costi?${p}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      applySummary(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
      setLoading(false);
    }
  }

  useEffect(() => {
    const p = new URLSearchParams({ month });
    if (technicianId) p.set("technicianId", technicianId);
    let cancelled = false;
    fetch(`/api/costi?${p}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Errore");
        return data as Summary;
      })
      .then((data) => {
        if (!cancelled) applySummary(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Errore");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, technicianId]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRole(d?.role ?? null))
      .catch(() => setRole(null));
  }, []);

  async function saveFuel(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fuelType,
        consumoL100: Number(consumo),
        ...(manualPrice.trim() ? { fuelPrice: Number(manualPrice) } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Solo un admin può salvare il calcolo");
      return;
    }
    toast.success("Calcolo aggiornato");
    void fetchSummary();
  }

  async function addSpesa(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/spese", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...spesa, importo: Number(spesa.importo) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Spesa non salvata");
      return;
    }
    setSpesa((s) => ({ ...s, importo: "", descrizione: "" }));
    void fetchSummary();
  }

  async function removeSpesa(id: number) {
    const res = await fetch(`/api/spese/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Spesa non eliminata");
      return;
    }
    void fetchSummary();
  }

  function exportCsv() {
    if (!summary) return;
    const lines = ["tipo;data;tecnico;dettaglio;km;euro"];
    for (const m of summary.movimenti) {
      lines.push(["giro", m.data, m.technician, `${m.zona} (${m.tappe} tappe)`, String(m.km), m.carburante.toFixed(2)].join(";"));
    }
    for (const s of summary.spese) {
      lines.push(["spesa", s.data, "", `${s.categoria} ${s.descrizione ?? ""}`.trim(), "", s.importo.toFixed(2)].join(";"));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `costi-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const priceLabel = summary?.fuel.price != null
    ? `${summary.fuel.price.toFixed(3)} €/L · ${summary.fuel.source === "mimit" ? "MIMIT" : "ultimo prezzo"}`
    : "prezzo non disponibile";

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <PageHeader title="Movimenti e costi" subtitle="Km dei giri confermati e spese. Il carburante usa il prezzo self-service MIMIT." />

      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <label className="text-xs text-slate-500">
          Mese
          <input type="month" className="field mt-1" value={month} onChange={(e) => { setLoading(true); setMonth(e.target.value); }} />
        </label>
        <label className="text-xs text-slate-500">
          Tecnico
          <select className="field mt-1" value={technicianId} onChange={(e) => { setLoading(true); setTechnicianId(e.target.value); }}>
            <option value="">Tutti</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{technicianDisplayName(u)}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={() => { setLoading(true); void fetchSummary(true); }}>Aggiorna prezzo</button>
        <button type="button" className="btn" onClick={exportCsv} disabled={!summary}>Esporta CSV</button>
      </div>

      {loading && !summary ? (
        <div className="text-slate-400 flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Caricamento…</div>
      ) : summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              ["Km", `${summary.totali.km}`],
              ["Carburante stimato", euro(summary.totali.carburante)],
              ["Spese", euro(summary.totali.spese)],
              ["Totale", euro(summary.totali.totale)],
            ].map(([label, value]) => (
              <div key={label} className="card p-3">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-lg font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mb-4">
            {summary.fuel.fuel}, {summary.fuel.consumoL100} L/100 km, {priceLabel}
            {summary.fuel.at ? ` · aggiornato ${new Date(summary.fuel.at).toLocaleString("it-IT")}` : ""}
          </p>

          <h2 className="font-semibold mb-2">Giri</h2>
          <div className="card overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Tecnico</th>
                  <th className="text-left px-3 py-2">Zona</th>
                  <th className="text-right px-3 py-2">Tappe</th>
                  <th className="text-right px-3 py-2">Km</th>
                  <th className="text-right px-3 py-2">Min</th>
                  <th className="text-right px-3 py-2">Carburante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.movimenti.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2">{m.data}</td>
                    <td className="px-3 py-2">{m.technician}</td>
                    <td className="px-3 py-2">{m.zona}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.tappe}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.km}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.minuti ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{euro(m.carburante)}</td>
                  </tr>
                ))}
                {summary.movimenti.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-4 text-slate-400">Nessun giro confermato in questo mese.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="font-semibold mb-2">Spese</h2>
          <form onSubmit={addSpesa} className="card p-3 grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
            <input type="date" className="field" value={spesa.data} onChange={(e) => setSpesa({ ...spesa, data: e.target.value })} required />
            <select className="field" value={spesa.categoria} onChange={(e) => setSpesa({ ...spesa, categoria: e.target.value })}>
              {CATEGORIE.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input className="field" inputMode="decimal" placeholder="Importo €" value={spesa.importo} onChange={(e) => setSpesa({ ...spesa, importo: e.target.value })} required />
            <input className="field" placeholder="Descrizione" value={spesa.descrizione} onChange={(e) => setSpesa({ ...spesa, descrizione: e.target.value })} />
            <button className="btn btn-primary" type="submit">Aggiungi</button>
          </form>
          <div className="card overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Categoria</th>
                  <th className="text-left px-3 py-2">Descrizione</th>
                  <th className="text-right px-3 py-2">Importo</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.spese.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2">{s.data}</td>
                    <td className="px-3 py-2">{CATEGORIE.find((c) => c[0] === s.categoria)?.[1] ?? s.categoria}</td>
                    <td className="px-3 py-2">{s.descrizione ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{euro(s.importo)}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" className="text-xs text-rose-600" onClick={() => void removeSpesa(s.id)}>Elimina</button>
                    </td>
                  </tr>
                ))}
                {summary.spese.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-slate-400">Nessuna spesa in questo mese.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {role === "ADMIN" && (
            <form onSubmit={saveFuel} className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-2 max-w-3xl">
              <h2 className="col-span-full font-semibold text-sm">Calcolo carburante</h2>
              <label className="text-xs text-slate-500">
                Carburante
                <select className="field mt-1" value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
                  <option>Gasolio</option>
                  <option>Benzina</option>
                  <option>GPL</option>
                </select>
              </label>
              <label className="text-xs text-slate-500">
                L/100 km
                <input className="field mt-1" value={consumo} onChange={(e) => setConsumo(e.target.value)} />
              </label>
              <label className="text-xs text-slate-500">
                Prezzo manuale €/L
                <input className="field mt-1" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} />
              </label>
              <button className="btn btn-primary self-end" type="submit">Salva</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
