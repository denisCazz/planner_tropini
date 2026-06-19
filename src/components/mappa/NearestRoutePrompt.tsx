"use client";

import { Target, X, Navigation } from "lucide-react";
import type { Client } from "@/types/client";

interface NearestRoutePromptProps {
  client: Client;
  nearestCount: number;
  onConfirm: () => void;
  onDismiss: () => void;
}

export default function NearestRoutePrompt({
  client,
  nearestCount,
  onConfirm,
  onDismiss,
}: NearestRoutePromptProps) {
  const name = [client.cognome, client.nome].filter(Boolean).join(" ");

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onDismiss} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nearest-route-title"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="px-5 pt-5 pb-4">
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>

          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center mb-4">
            <Target size={22} className="text-amber-600" />
          </div>

          <h2 id="nearest-route-title" className="text-lg font-semibold text-slate-900 pr-8">
            Percorso automatico?
          </h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Hai selezionato <strong className="text-slate-900">{name}</strong>. Vuoi calcolare subito
            il percorso con i <strong>{nearestCount} clienti più vicini</strong>?
          </p>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            No, seleziono manualmente
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            <Navigation size={15} />
            Sì, calcola
          </button>
        </div>
      </div>
    </div>
  );
}
