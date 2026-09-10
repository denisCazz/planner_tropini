"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Euro,
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Loader2,
  X,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import type { FinancialSummary, CategoriaSpesa } from "@/types/client";
import { CATEGORIA_SPESA_LABEL, toLocalDateKey } from "@/types/client";
import { useOrgUsers } from "@/lib/useOrgUsers";

function formatEuro(v: number): string {
  return v.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: v % 1 === 0 ? 0 : 2,
  });
}

interface FinancialsPanelProps {
  mesi: number;
  refreshKey: number;
}

type TabMode = "summary" | "nuovo-intervento" | "nuova-spesa";

export default function FinancialsPanel({ mesi, refreshKey }: FinancialsPanelProps) {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabMode>("summary");
  const { users: orgUsers } = useOrgUsers();

  // Form intervento
  const [intClientQuery, setIntClientQuery] = useState("");
  const [intClientOptions, setIntClientOptions] = useState<
    { id: number; nome: string; cognome: string; citta: string | null }[]
  >([]);
  const [intClientId, setIntClientId] = useState<number | null>(null);
  const [intClientLabel, setIntClientLabel] = useState("");
  const [intRicavo, setIntRicavo] = useState("");
  const [intTechnician, setIntTechnician] = useState("");
  const [intData, setIntData] = useState(toLocalDateKey(new Date()));
  const [intDesc, setIntDesc] = useState("");

  // Form spesa
  const [spImporto, setSpImporto] = useState("");
  const [spCategoria, setSpCategoria] = useState<CategoriaSpesa>("CARBURANTE");
  const [spData, setSpData] = useState(toLocalDateKey(new Date()));
  const [spDesc, setSpDesc] = useState("");

  const [saving, setSaving] = useState(false);

  const loadSummary = useCallback(() => {
    setLoading(true);
    fetch(`/api/financials/summary?mesi=${mesi}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSummary(d))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [mesi]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, refreshKey]);

  useEffect(() => {
    if (tab !== "nuovo-intervento" || intClientQuery.trim().length < 2) {
      setIntClientOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/clients?slim=1&limit=6&search=${encodeURIComponent(intClientQuery.trim())}`
        );
        const data = await res.json();
        setIntClientOptions(Array.isArray(data.items) ? data.items : []);
      } catch {
        setIntClientOptions([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [tab, intClientQuery]);

  async function submitIntervento() {
    if (intClientId == null) {
      toast.error("Seleziona un cliente");
      return;
    }
    const ricavo = parseFloat(intRicavo.replace(",", "."));
    if (Number.isNaN(ricavo) || ricavo < 0) {
      toast.error("Ricavo non valido");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/interventi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: intClientId,
          data: intData,
          ricavo,
          technicianId: intTechnician || null,
          descrizione: intDesc.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      toast.success("Intervento registrato");
      setTab("summary");
      setIntClientQuery("");
      setIntClientId(null);
      setIntClientLabel("");
      setIntRicavo("");
      setIntDesc("");
      loadSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  async function submitSpesa() {
    const importo = parseFloat(spImporto.replace(",", "."));
    if (Number.isNaN(importo) || importo <= 0) {
      toast.error("Importo non valido");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/spese", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: spData,
          categoria: spCategoria,
          importo,
          descrizione: spDesc.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      toast.success("Spesa registrata");
      setTab("summary");
      setSpImporto("");
      setSpDesc("");
      loadSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  const maxMonthValue = summary
    ? Math.max(...summary.perMese.map((m) => Math.max(m.ricavi, m.spese)), 1)
    : 1;

  const inputCls =
    "w-full rounded-xl glass-input px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400";
  const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1";

  return (
    <div className="glass glass-hi rounded-2xl overflow-hidden flex flex-col max-h-[460px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Euro size={14} className="text-emerald-600" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Andamento</span>
          <span className="text-xs text-gray-400">ultimi {mesi} mesi</span>
        </div>
        {tab === "summary" && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setTab("nuovo-intervento")}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition-colors"
            >
              <Wrench size={11} />
              Intervento
            </button>
            <button
              type="button"
              onClick={() => setTab("nuova-spesa")}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] font-bold hover:bg-red-100 transition-colors"
            >
              <Plus size={11} />
              Spesa
            </button>
          </div>
        )}
        {tab !== "summary" && (
          <button
            type="button"
            onClick={() => setTab("summary")}
            className="p-1.5 rounded-lg hover:bg-white/70 text-slate-500"
            title="Annulla"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto panel-scroll p-4">
        {tab === "nuovo-intervento" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Cliente</label>
              {intClientId != null ? (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-800 truncate">
                    {intClientLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIntClientId(null);
                      setIntClientLabel("");
                      setIntClientQuery("");
                    }}
                    className="text-[11px] font-semibold text-emerald-700"
                  >
                    Cambia
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    className={inputCls}
                    placeholder="Cerca cliente…"
                    value={intClientQuery}
                    onChange={(e) => setIntClientQuery(e.target.value)}
                  />
                  {intClientOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-xl glass-strong shadow-xl overflow-hidden max-h-44 overflow-y-auto panel-scroll">
                      {intClientOptions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setIntClientId(c.id);
                            setIntClientLabel([c.cognome, c.nome].filter(Boolean).join(" "));
                            setIntClientOptions([]);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-emerald-500/10 transition-colors border-b border-white/40 last:border-b-0"
                        >
                          <span className="block text-xs font-semibold text-slate-800">
                            {[c.cognome, c.nome].filter(Boolean).join(" ")}
                          </span>
                          <span className="block text-[10px] text-slate-500">{c.citta ?? "—"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Ricavo (€)</label>
                <input
                  className={inputCls}
                  inputMode="decimal"
                  placeholder="120"
                  value={intRicavo}
                  onChange={(e) => setIntRicavo(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Data</label>
                <input
                  type="date"
                  className={inputCls}
                  value={intData}
                  onChange={(e) => setIntData(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Tecnico</label>
                <select
                  className={inputCls}
                  value={intTechnician}
                  onChange={(e) => setIntTechnician(e.target.value)}
                >
                  <option value="">—</option>
                  {orgUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Descrizione</label>
                <input
                  className={inputCls}
                  placeholder="Pulizia, ricambio…"
                  value={intDesc}
                  onChange={(e) => setIntDesc(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={submitIntervento}
              disabled={saving || intClientId == null}
              className="w-full h-10 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Registra intervento
            </button>
          </div>
        )}

        {tab === "nuova-spesa" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Importo (€)</label>
                <input
                  className={inputCls}
                  inputMode="decimal"
                  placeholder="45,50"
                  value={spImporto}
                  onChange={(e) => setSpImporto(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Data</label>
                <input
                  type="date"
                  className={inputCls}
                  value={spData}
                  onChange={(e) => setSpData(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Categoria</label>
                <select
                  className={inputCls}
                  value={spCategoria}
                  onChange={(e) => setSpCategoria(e.target.value as CategoriaSpesa)}
                >
                  {(Object.keys(CATEGORIA_SPESA_LABEL) as CategoriaSpesa[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIA_SPESA_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Descrizione</label>
                <input
                  className={inputCls}
                  placeholder="Rifornimento…"
                  value={spDesc}
                  onChange={(e) => setSpDesc(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={submitSpesa}
              disabled={saving}
              className="w-full h-10 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Registra spesa
            </button>
          </div>
        )}

        {tab === "summary" && (
          <>
            {loading || !summary ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={18} className="animate-spin text-emerald-500" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* KPI finanze */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-200/60 px-3 py-2.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      <TrendingUp size={11} />
                      Ricavi
                    </div>
                    <div className="text-lg font-bold text-emerald-800 tabular-nums mt-0.5">
                      {formatEuro(summary.ricavi)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-red-500/10 border border-red-200/60 px-3 py-2.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-600">
                      <TrendingDown size={11} />
                      Spese
                    </div>
                    <div className="text-lg font-bold text-red-700 tabular-nums mt-0.5">
                      {formatEuro(summary.spese)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-indigo-500/10 border border-indigo-200/60 px-3 py-2.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                      <Wallet size={11} />
                      Netto
                    </div>
                    <div
                      className={`text-lg font-bold tabular-nums mt-0.5 ${
                        summary.netto >= 0 ? "text-indigo-800" : "text-red-700"
                      }`}
                    >
                      {formatEuro(summary.netto)}
                    </div>
                  </div>
                </div>

                {/* Grafico mensile */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500 mb-2">
                    <span className="font-semibold">Ricavi vs spese per mese</span>
                    <span className="tabular-nums">{summary.interventi} interventi</span>
                  </div>
                  <div className="flex items-end gap-2 h-24">
                    {summary.perMese.map((m) => (
                      <div key={m.mese} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-end justify-center gap-0.5 h-full">
                          <div
                            className="w-1/2 max-w-[14px] rounded-t-md bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all duration-500 min-h-[3px]"
                            style={{ height: `${Math.max(4, (m.ricavi / maxMonthValue) * 100)}%` }}
                            title={`Ricavi ${formatEuro(m.ricavi)}`}
                          />
                          <div
                            className="w-1/2 max-w-[14px] rounded-t-md bg-gradient-to-t from-red-400 to-red-300 transition-all duration-500 min-h-[3px]"
                            style={{ height: `${Math.max(4, (m.spese / maxMonthValue) * 100)}%` }}
                            title={`Spese ${formatEuro(m.spese)}`}
                          />
                        </div>
                        <span className="text-[9px] text-gray-400 capitalize">{m.mese}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per tecnico */}
                {summary.perTecnico.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-gray-500 mb-2">
                      Ricavi per tecnico
                    </div>
                    <div className="space-y-1.5">
                      {summary.perTecnico.slice(0, 5).map((t) => {
                        const max = summary.perTecnico[0]?.ricavi || 1;
                        return (
                          <div key={t.technicianId ?? "none"} className="flex items-center gap-2 text-xs">
                            <span className="w-20 truncate text-gray-700 font-medium">
                              {t.technicianName}
                            </span>
                            <div className="flex-1 h-2 bg-gray-100/80 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.round((t.ricavi / max) * 100)}%` }}
                              />
                            </div>
                            <span className="w-16 text-right font-semibold text-gray-800 tabular-nums">
                              {formatEuro(t.ricavi)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {summary.ricavi === 0 && summary.spese === 0 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    Registra il primo intervento o spesa con i pulsanti in alto.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
