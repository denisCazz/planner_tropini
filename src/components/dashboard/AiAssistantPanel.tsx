"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  Loader2,
  Phone,
  CalendarPlus,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { toLocalDateKey, addDaysToDateKey } from "@/types/client";

interface SuggestedClient {
  id: number;
  nome: string;
  citta: string | null;
  provincia: string | null;
  urgente: boolean;
  telefono: string | null;
  mesiDaUltimaVisita: number;
  score: number;
}

interface SuggestData {
  giorni: number;
  visitePerGiorno: number;
  capacita: number;
  arretratoTotale: number;
  appuntamentiGiaPianificati: number;
  suggeriti: SuggestedClient[];
  nota: string | null;
}

interface ForecastData {
  cicloMesi: number;
  ricavoMedio: number;
  ricavoPotenziale: number;
  totaleClienti: number;
  analisi: string | null;
}

function formatEuro(v: number): string {
  return v.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default function AiAssistantPanel() {
  const [tab, setTab] = useState<"brief" | "suggerimenti" | "previsione">("brief");
  const [brief, setBrief] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [suggest, setSuggest] = useState<SuggestData | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [giorni, setGiorni] = useState(5);
  const [planningIds, setPlanningIds] = useState<Set<number>>(new Set());
  const [plannedIds, setPlannedIds] = useState<Set<number>>(new Set());

  const loadBrief = useCallback(() => {
    setBriefLoading(true);
    setBriefError(null);
    fetch("/api/ai/brief")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setBrief(null);
          setBriefError(data.error ?? "Errore AI");
          return;
        }
        setBrief(data.text);
      })
      .catch(() => setBriefError("Errore di rete"))
      .finally(() => setBriefLoading(false));
  }, []);

  const loadSuggest = useCallback(() => {
    setSuggestLoading(true);
    fetch(`/api/ai/suggest?giorni=${giorni}&perGiorno=4`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SuggestData | null) => setSuggest(d))
      .catch(() => setSuggest(null))
      .finally(() => setSuggestLoading(false));
  }, [giorni]);

  const loadForecast = useCallback(() => {
    setForecastLoading(true);
    fetch("/api/ai/forecast")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ForecastData | null) => setForecast(d))
      .catch(() => setForecast(null))
      .finally(() => setForecastLoading(false));
  }, []);

  useEffect(() => {
    loadBrief();
    loadSuggest();
    loadForecast();
  }, [loadBrief, loadSuggest, loadForecast]);

  async function planClient(c: SuggestedClient) {
    setPlanningIds((prev) => new Set(prev).add(c.id));
    try {
      // Primo giorno feriale dopo oggi (salta weekend)
      let target = toLocalDateKey(new Date());
      for (let i = 1; i <= 7; i++) {
        const candidate = addDaysToDateKey(toLocalDateKey(new Date()), i);
        const [y, m, d] = candidate.split("-").map((p) => parseInt(p, 10));
        const day = new Date(y, m - 1, d).getDay();
        if (day !== 0 && day !== 6) {
          target = candidate;
          break;
        }
      }
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: c.id,
          date: target,
          startMin: 540 + (planningIds.size % 4) * 60,
          durationMin: 60,
          tipo: "MANUTENZIONE",
          stato: "PIANIFICATO",
          note: "Suggerito dall'assistente AI",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore pianificazione");
      setPlannedIds((prev) => new Set(prev).add(c.id));
      toast.success(`${c.nome} pianificato`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore pianificazione");
    } finally {
      setPlanningIds((prev) => {
        const next = new Set(prev);
        next.delete(c.id);
        return next;
      });
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl glass glass-hi p-4 md:p-5 dash-enter dash-enter-1">
      <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/25">
            <Sparkles size={17} className="text-white" />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              Assistente AI
            </h2>
            <p className="text-[11px] text-slate-500">
              Suggerisce, stima e pianifica al posto tuo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-white/50 border border-white/60 p-0.5">
          {(
            [
              ["brief", "Brief"],
              ["suggerimenti", "Da visitare"],
              ["previsione", "Previsione"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === key
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "brief" && (
        <div className="rounded-2xl bg-white/60 border border-white/60 p-4 min-h-[110px]">
          {briefLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin text-violet-500" />
              L&apos;assistente sta analizzando la giornata…
            </div>
          ) : briefError ? (
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm text-slate-600">
                <p>{briefError}</p>
                <button
                  type="button"
                  onClick={loadBrief}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800"
                >
                  <RefreshCw size={12} />
                  Riprova
                </button>
              </div>
            </div>
          ) : brief ? (
            <div className="flex items-start gap-2.5">
              <Lightbulb size={16} className="text-violet-500 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {brief}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Nessun dato disponibile.</p>
          )}
        </div>
      )}

      {tab === "suggerimenti" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-500">Pianifica le prossime visite nei prossimi</span>
            {[3, 5, 10].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGiorni(g)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  giorni === g
                    ? "bg-violet-600 text-white"
                    : "bg-white/60 text-slate-600 hover:bg-white"
                }`}
              >
                {g} giorni
              </button>
            ))}
            {suggest && (
              <span className="ml-auto text-slate-400 tabular-nums">
                arretrato {suggest.arretratoTotale} · già in agenda{" "}
                {suggest.appuntamentiGiaPianificati}
              </span>
            )}
          </div>

          {suggestLoading ? (
            <div className="flex items-center gap-2 py-6 justify-center text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin text-violet-500" />
              Calcolo suggerimenti…
            </div>
          ) : !suggest || suggest.suggeriti.length === 0 ? (
            <div className="rounded-2xl bg-white/60 border border-white/60 p-6 text-center">
              <CheckCircle2 size={24} className="mx-auto text-emerald-400 mb-1.5" />
              <p className="text-sm text-slate-500">
                Nessuna visita arretrata: tutti i clienti attivi sono coperti.
              </p>
            </div>
          ) : (
            <>
              {suggest.nota && (
                <div className="rounded-2xl bg-violet-500/10 border border-violet-200/60 px-3.5 py-2.5 flex items-start gap-2">
                  <Sparkles size={13} className="text-violet-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-violet-900 leading-relaxed whitespace-pre-line">
                    {suggest.nota}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {suggest.suggeriti.slice(0, 12).map((c) => {
                  const planned = plannedIds.has(c.id);
                  const planning = planningIds.has(c.id);
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl bg-white/70 border border-white/60 px-3 py-2.5 flex items-center gap-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {c.nome}
                          </span>
                          {c.urgente && (
                            <span className="px-1 py-0.5 rounded bg-red-100 text-red-700 text-[9px] font-bold uppercase shrink-0">
                              Urgente
                            </span>
                          )}
                        </div>
                        <span className="block text-[10px] text-slate-500 truncate">
                          {c.citta ?? "—"} ·{" "}
                          {c.mesiDaUltimaVisita >= 18
                            ? "mai visitato"
                            : `${c.mesiDaUltimaVisita} mesi fa`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {c.telefono && !planned && (
                          <a
                            href={`tel:${c.telefono.replace(/\s/g, "")}`}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                            title="Chiama"
                          >
                            <Phone size={12} />
                          </a>
                        )}
                        {planned ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                            <CheckCircle2 size={13} />
                            In agenda
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void planClient(c)}
                            disabled={planning}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-violet-600 text-white text-[10px] font-bold hover:bg-violet-700 transition-colors disabled:opacity-50"
                            title="Aggiungi appuntamento"
                          >
                            {planning ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <CalendarPlus size={11} />
                            )}
                            Pianifica
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-right">
                <Link
                  href="/agenda"
                  className="text-xs font-semibold text-violet-600 hover:text-violet-800"
                >
                  Apri agenda →
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "previsione" && (
        <div className="space-y-3">
          {forecastLoading ? (
            <div className="flex items-center gap-2 py-6 justify-center text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin text-violet-500" />
              Stima in corso…
            </div>
          ) : !forecast ? (
            <p className="text-sm text-slate-400">Nessun dato disponibile.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/60 border border-white/60 px-3 py-3 text-center">
                  <div className="text-xl font-bold text-slate-900 tabular-nums">
                    {forecast.totaleClienti}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Manutenzioni dovute
                  </div>
                </div>
                <div className="rounded-xl bg-white/60 border border-white/60 px-3 py-3 text-center">
                  <div className="text-xl font-bold text-slate-900 tabular-nums">
                    {formatEuro(forecast.ricavoMedio)}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Ricavo medio storico
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-200/60 px-3 py-3 text-center">
                  <div className="text-xl font-bold text-emerald-700 tabular-nums">
                    {formatEuro(forecast.ricavoPotenziale)}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                    Ricavo potenziale
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white/60 border border-white/60 px-4 py-3 flex items-start gap-2.5">
                <TrendingUp size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-600 leading-relaxed">
                  {forecast.analisi ? (
                    <p className="whitespace-pre-line">{forecast.analisi}</p>
                  ) : (
                    <p>
                      Con un ciclo di manutenzione di {forecast.cicloMesi} mesi,{" "}
                      {forecast.totaleClienti} clienti attivi sono oltre la soglia:
                      completarli varrebbe circa{" "}
                      <strong>{formatEuro(forecast.ricavoPotenziale)}</strong>.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
