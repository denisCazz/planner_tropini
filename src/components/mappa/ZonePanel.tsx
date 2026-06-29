"use client";

import { memo } from "react";
import {
  Phone,
  PhoneOff,
  Check,
  X,
  Navigation,
  UserPlus,
  Loader2,
  MapPinned,
  AlertTriangle,
} from "lucide-react";
import type { Client, CallStatus, StatoCliente } from "@/types/client";

function telHref(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (!d) return "#";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("39")) return `tel:+${d}`;
  if (d.length >= 9 && d.length <= 11) return `tel:+39${d}`;
  return `tel:+${d}`;
}

const STATO_DOT: Record<StatoCliente, string> = {
  ATTIVO: "bg-emerald-500",
  INATTIVO: "bg-slate-400",
  PROSPECT: "bg-amber-500",
};

interface ZoneRowProps {
  client: Client;
  status: CallStatus | undefined;
  added: boolean;
  onSetStatus: (id: number, status: CallStatus | null) => void;
  onFocus: (id: number) => void;
}

const ZoneRow = memo(function ZoneRow({
  client: c,
  status,
  added,
  onSetStatus,
  onFocus,
}: ZoneRowProps) {
  const phone = c.telefono || c.telefono2;
  return (
    <div
      className={`px-3 py-2.5 border-b border-slate-100 transition-colors ${
        status === "ok"
          ? "bg-emerald-50/70"
          : status === "ko"
            ? "bg-rose-50/60"
            : "bg-white"
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onFocus(c.id)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATO_DOT[c.stato]}`} />
            <span className="text-sm text-slate-900 truncate">
              <span className="font-medium">{c.cognome}</span>
              {c.cognome && c.nome ? " " : ""}
              {c.nome}
            </span>
            {c.urgente && (
              <AlertTriangle size={12} className="text-red-500 shrink-0" />
            )}
            {added && (
              <span className="text-[9px] font-semibold uppercase tracking-wide text-indigo-600 bg-indigo-100 rounded px-1 py-0.5 shrink-0">
                +1
              </span>
            )}
          </div>
          {(c.indirizzo || c.citta) && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPinned size={10} className="text-slate-300 shrink-0" />
              <span className="text-[11px] text-slate-400 truncate">
                {[c.indirizzo, c.citta].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2 mt-2">
        {phone ? (
          <a
            href={telHref(phone)}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-2.5 py-1.5 min-w-0"
          >
            <Phone size={13} className="shrink-0" />
            <span className="truncate">{phone}</span>
          </a>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 rounded-lg px-2.5 py-1.5">
            <PhoneOff size={13} />
            Nessun numero
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onSetStatus(c.id, status === "ok" ? null : "ok")}
            aria-pressed={status === "ok"}
            className={`flex items-center gap-1 text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-colors ${
              status === "ok"
                ? "bg-emerald-600 border-emerald-600 text-white"
                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            <Check size={13} />
            OK
          </button>
          <button
            type="button"
            onClick={() => onSetStatus(c.id, status === "ko" ? null : "ko")}
            aria-pressed={status === "ko"}
            className={`flex items-center gap-1 text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-colors ${
              status === "ko"
                ? "bg-rose-600 border-rose-600 text-white"
                : "border-rose-200 text-rose-700 hover:bg-rose-50"
            }`}
          >
            <X size={13} />
            KO
          </button>
        </div>
      </div>
    </div>
  );
});

interface ZonePanelProps {
  candidates: Client[];
  statuses: Record<number, CallStatus>;
  addedIds: Set<number>;
  okCount: number;
  target: number;
  calculating: boolean;
  finding: boolean;
  canFindMore: boolean;
  onSetStatus: (id: number, status: CallStatus | null) => void;
  onFocus: (id: number) => void;
  onFindAnother: () => void;
  onPlan: () => void;
  onClose: () => void;
}

export default function ZonePanel({
  candidates,
  statuses,
  addedIds,
  okCount,
  target,
  calculating,
  finding,
  canFindMore,
  onSetStatus,
  onFocus,
  onFindAnother,
  onPlan,
  onClose,
}: ZonePanelProps) {
  const reached = okCount >= target;
  const canPlan = okCount >= 2;
  const showFindAnother = canPlan && !reached;
  const progress = Math.min(100, Math.round((okCount / target) * 100));

  return (
    <div className="fixed inset-x-0 bottom-0 md:absolute md:inset-x-auto md:right-3 md:top-20 md:bottom-auto md:w-80 z-[1000] bg-white border border-slate-200 md:rounded-xl overflow-hidden flex flex-col max-h-[72vh] md:max-h-[calc(100vh-6rem)] shadow-lg">
      <div className="flex items-center justify-between px-3 py-2.5 bg-indigo-600 text-white shrink-0">
        <div className="flex items-center gap-2 font-medium text-sm">
          <MapPinned size={15} />
          Zona selezionata
          <span className="text-indigo-200 font-normal">{candidates.length} clienti</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/20" aria-label="Chiudi">
          <X size={16} />
        </button>
      </div>

      <div className="px-3 py-2.5 border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Hai sentito i clienti? Segna <strong className="text-emerald-700">OK</strong> /{" "}
            <strong className="text-rose-700">KO</strong>.
          </span>
          <span className={`font-semibold ${reached ? "text-emerald-600" : "text-slate-700"}`}>
            {okCount}/{target}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              reached ? "bg-emerald-500" : "bg-indigo-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto panel-scroll min-h-0">
        {candidates.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">
            Nessun cliente con coordinate in questa zona. Prova a disegnarne una più ampia.
          </p>
        ) : (
          candidates.map((c) => (
            <ZoneRow
              key={c.id}
              client={c}
              status={statuses[c.id]}
              added={addedIds.has(c.id)}
              onSetStatus={onSetStatus}
              onFocus={onFocus}
            />
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-slate-100 p-3 space-y-2">
        {!canPlan && (
          <p className="text-[11px] text-slate-400 text-center">
            Segna almeno 2 clienti come <strong>OK</strong> per pianificare il percorso.
          </p>
        )}
        {showFindAnother && (
          <button
            type="button"
            onClick={onFindAnother}
            disabled={finding || !canFindMore}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-indigo-200 text-indigo-700 text-sm font-medium hover:bg-indigo-50 disabled:opacity-40 transition-colors"
          >
            {finding ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            {canFindMore ? "Trova un altro cliente" : "Nessun altro cliente vicino"}
          </button>
        )}
        <button
          type="button"
          onClick={onPlan}
          disabled={!canPlan || calculating}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-40 transition-colors"
        >
          {calculating ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />}
          {reached
            ? `Pianifica percorso (${okCount})`
            : `Pianifica con questi (${okCount})`}
        </button>
      </div>
    </div>
  );
}
