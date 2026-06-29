"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { RouteResult, RouteStep, Settings, StatoCliente } from "@/types/client";
import {
  Navigation,
  Clock,
  X,
  Printer,
  MessageCircle,
  Map,
  Calendar,
  ChevronUp,
  ChevronDown,
  Home,
} from "lucide-react";
import { toast } from "sonner";

const STATO_COLORS: Record<StatoCliente, string> = {
  ATTIVO: "bg-green-100 text-green-800",
  INATTIVO: "bg-gray-100 text-gray-700",
  PROSPECT: "bg-yellow-100 text-yellow-800",
};

function telHrefIt(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (!d) return "#";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("39")) return `tel:+${d}`;
  if (d.length >= 9 && d.length <= 11) return `tel:+39${d}`;
  return `tel:+${d}`;
}

interface RoutePanelProps {
  result: RouteResult;
  onClose: () => void;
  sharePhone?: string;
  settings?: Settings | null;
  onVisitsLogged?: () => void;
  /** Ricalcola geometria mappa con ordine tappe manuale */
  onVisitOrderChange: (visitOrder: number[]) => void | Promise<void>;
}

export default function RoutePanel({
  result,
  onClose,
  sharePhone,
  settings,
  onVisitsLogged,
  onVisitOrderChange,
}: RoutePanelProps) {
  const [visitBusy, setVisitBusy] = useState(false);
  const [stepsOrdered, setStepsOrdered] = useState<RouteStep[]>([]);
  const [timesById, setTimesById] = useState<Record<number, string>>({});
  const reorderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortedIdsKeyRef = useRef<string>("");

  const sortedIdsKey = useMemo(
    () =>
      [...result.steps.map((s) => s.client.id)]
        .sort((a, b) => a - b)
        .join(","),
    [result.steps]
  );

  useEffect(() => {
    setStepsOrdered(result.steps.map((s, i) => ({ ...s, order: i + 1 })));
    if (sortedIdsKeyRef.current !== sortedIdsKey) {
      sortedIdsKeyRef.current = sortedIdsKey;
      setTimesById({});
    }
  }, [result, sortedIdsKey]);

  useEffect(() => {
    return () => {
      if (reorderDebounceRef.current) clearTimeout(reorderDebounceRef.current);
    };
  }, []);

  const steps = stepsOrdered.length > 0 ? stepsOrdered : result.steps;

  const homePoint =
    settings?.startLat != null && settings?.startLng != null
      ? {
          lat: settings.startLat,
          lng: settings.startLng,
          label: settings.startLabel?.trim() || "Casa",
        }
      : null;

  function scheduleApplyVisitOrder(visitOrder: number[]) {
    if (reorderDebounceRef.current) clearTimeout(reorderDebounceRef.current);
    reorderDebounceRef.current = setTimeout(() => {
      reorderDebounceRef.current = null;
      void Promise.resolve(onVisitOrderChange(visitOrder)).catch(() => {
        toast.error("Impossibile aggiornare il percorso sulla mappa");
      });
    }, 420);
  }

  function moveStep(index: number, delta: -1 | 1) {
    const j = index + delta;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[index], next[j]] = [next[j], next[index]];
    const renumbered = next.map((s, i) => ({ ...s, order: i + 1 }));
    setStepsOrdered(renumbered);
    scheduleApplyVisitOrder(renumbered.map((s) => s.client.id));
  }

  /** Build a Google Maps multi-stop directions URL (ordine = tappe correnti).
   *  Se la casa (punto di partenza) è impostata, il percorso parte da casa,
   *  visita tutte le tappe e rientra a casa (ultima tappa → casa). */
  function buildGoogleMapsUrl(): string {
    const stops = steps.map((s) => s.client);
    if (stops.length === 0) return "https://maps.google.com";

    function stopParam(c: (typeof stops)[0]): string {
      if (c.lat != null && c.lng != null) return `${c.lat},${c.lng}`;
      const addr = [c.indirizzo, c.citta, c.cap].filter(Boolean).join(", ");
      return encodeURIComponent(addr || `${c.nome} ${c.cognome}`);
    }

    const stopParams = stops.map(stopParam);

    let parts: string[];
    if (homePoint) {
      const homeParam = `${homePoint.lat},${homePoint.lng}`;
      // casa → tappe → casa (rientro a casa incluso)
      parts = [homeParam, ...stopParams, homeParam];
    } else {
      // senza casa: prima tappa → ... → ultima tappa
      parts = stopParams;
    }

    const base = "https://www.google.com/maps/dir";
    return `${base}/${parts.join("/")}`;
  }

  /** Itinerario testuale con orari (Google Maps nell’URL non supporta orari per tappa) */
  function buildScheduleText(): string {
    const lines: string[] = [];
    if (homePoint) lines.push(`Partenza — ${homePoint.label}`);
    steps.forEach((s, i) => {
      const tm = timesById[s.client.id];
      const nome = `${s.client.cognome} ${s.client.nome}`.trim();
      const addr = [s.client.indirizzo, s.client.citta].filter(Boolean).join(", ");
      const timePart = tm ? `${tm} — ` : "";
      lines.push(`${i + 1}. ${timePart}${nome}${addr ? ` — ${addr}` : ""}`);
    });
    if (homePoint) lines.push(`Rientro a casa — ${homePoint.label}`);
    return lines.join("\n");
  }

  function buildWhatsAppText(): string {
    const url = buildGoogleMapsUrl();
    const sched = buildScheduleText();
    return `${url}\n\nItinerario (ordine e orari):\n${sched}`;
  }

  function handleGoogleMaps() {
    window.open(buildGoogleMapsUrl(), "_blank", "noopener,noreferrer");
  }

  function handleWhatsApp() {
    const text = buildWhatsAppText();
    if (sharePhone) {
      const phone = sharePhone.replace(/\D/g, "");
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    }
  }

  async function handleMarkVisitsToday() {
    const ids = steps.map((s) => s.client.id);
    setVisitBusy(true);
    try {
      const res = await fetch("/api/clients/bulk-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore aggiornamento");
      toast.success(`Ultima visita aggiornata per ${data.updated ?? ids.length} cliente/i`);
      onVisitsLogged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setVisitBusy(false);
    }
  }

  async function handlePrint() {
    const win = window.open("", "_blank", "width=760,height=960");
    if (!win) return;
    const today = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
    const mapsUrl = buildGoogleMapsUrl();
    let qrDataUrl = "";
    try {
      const QRCode = (await import("qrcode")).default;
      qrDataUrl = await QRCode.toDataURL(mapsUrl, { width: 200, margin: 2, errorCorrectionLevel: "M" });
    } catch {
      qrDataUrl = "";
    }

    const rows = steps
      .map(({ order, client }) => {
        const addr = [client.indirizzo, client.citta, client.cap ? `(${client.cap})` : ""].filter(Boolean).join(", ");
        const tel = client.telefono
          ? `<div class="tel"><a href="${telHrefIt(client.telefono)}">\uD83D\uDCDE ${client.telefono}</a></div>`
          : "";
        const tm = timesById[client.id];
        const timeCell = tm ? escapeHtml(tm) : "—";
        return `<tr>
          <td class="num">${order}</td>
          <td class="time">${timeCell}</td>
          <td>
            <strong>${escapeHtml(client.cognome)} ${escapeHtml(client.nome)}</strong>
            ${addr ? `<div class="addr">${escapeHtml(addr)}</div>` : ""}
            ${tel}
          </td>
          <td><span class="stato ${client.stato}">${client.stato === "ATTIVO" ? "Attivo" : client.stato === "INATTIVO" ? "Inattivo" : "N/C"}</span></td>
        </tr>`;
      })
      .join("");

    const homeStartRow = homePoint
      ? `<tr class="home-row"><td class="num">\uD83C\uDFE0</td><td class="time">—</td><td><strong>Partenza</strong><div class="addr">${escapeHtml(homePoint.label)}</div></td><td></td></tr>`
      : "";
    const homeEndRow = homePoint
      ? `<tr class="home-row"><td class="num">\uD83C\uDFE0</td><td class="time">—</td><td><strong>Rientro a casa</strong><div class="addr">${escapeHtml(homePoint.label)}</div></td><td></td></tr>`
      : "";

    const schedBlock = `<div class="sched-block"><strong>Itinerario con orari</strong><pre class="sched-pre">${escapeHtml(buildScheduleText())}</pre></div>`;

    const qrBlock = qrDataUrl
      ? `<div class="qr-row"><img src="${qrDataUrl}" alt="QR Google Maps" width="160" height="160"/><div class="qr-side"><strong>Apri percorso</strong><p class="qr-hint">Inquadra il QR: apre Google Maps con le tappe nell&apos;ordine impostato.</p><div class="maps-url">${escapeHtml(mapsUrl)}</div></div></div>`
      : `<div class="maps-link"><strong>Apri percorso in Google Maps:</strong>${escapeHtml(mapsUrl)}</div>`;

    win.document.write(`<!DOCTYPE html>
<html lang="it"><head>
<meta charset="utf-8">
<title>Itinerario — Planner Tropini</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;padding:36px;color:#111;font-size:13px}
  header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #1d4ed8;padding-bottom:14px;margin-bottom:20px}
  header h1{font-size:20px;font-weight:700;color:#1d4ed8}
  header p{font-size:12px;color:#666;margin-top:4px}
  .summary{display:flex;gap:0;background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 20px;margin-bottom:24px;gap:32px}
  .summary-item{display:flex;flex-direction:column;gap:3px}
  .summary-item .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#64748b;font-weight:700}
  .summary-item .val{font-size:18px;font-weight:800;color:#1e3a8a}
  table{width:100%;border-collapse:collapse}
  thead tr{background:#f8fafc}
  th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700;border-bottom:2px solid #e2e8f0;padding:7px 10px}
  td{padding:11px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  td.num{width:36px;font-weight:800;color:#1d4ed8;font-size:15px;text-align:center}
  tr.home-row{background:#f0f7ff}
  tr.home-row td{color:#1e3a8a}
  td.time{width:52px;font-size:12px;font-weight:600;color:#1e40af;text-align:center}
  .addr{color:#555;font-size:11px;margin-top:3px}
  .tel{color:#1d4ed8;font-size:11px;margin-top:2px}
  .tel a{color:#1d4ed8;text-decoration:none}
  .stato{display:inline-block;font-size:10px;font-weight:700;padding:3px 8px;border-radius:9999px}
  .ATTIVO{background:#dcfce7;color:#166534}
  .INATTIVO{background:#f3f4f6;color:#374151}
  .PROSPECT{background:#fef9c3;color:#854d0e}
  .sched-block{margin-top:18px;padding:12px 14px;background:#fafafa;border:1px solid #e5e7eb;border-radius:8px}
  .sched-pre{font-size:11px;white-space:pre-wrap;margin-top:8px;line-height:1.45;color:#374151;font-family:ui-monospace,monospace}
  .qr-row{display:flex;gap:20px;align-items:flex-start;margin-top:22px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px}
  .qr-side{flex:1;min-width:0}
  .qr-hint{font-size:11px;color:#64748b;margin-top:6px;line-height:1.4}
  .maps-url{font-size:10px;color:#1e3a8a;word-break:break-all;margin-top:10px}
  .maps-link{margin-top:22px;padding:12px 16px;background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;font-size:11px;color:#1e3a8a;word-break:break-all}
  .maps-link strong{display:block;margin-bottom:4px;font-size:12px}
  footer{margin-top:20px;font-size:10px;color:#94a3b8;text-align:right}
  @media print{body{padding:20px}}
</style></head><body>
<header>
  <div>
    <h1>Itinerario di visita</h1>
    <p>Planner Tropini &mdash; ${today}</p>
  </div>
</header>
<div class="summary">
  <div class="summary-item"><span class="lbl">Distanza</span><span class="val">${result.totalDistance} km</span></div>
  <div class="summary-item"><span class="lbl">Tempo stimato</span><span class="val">~${result.totalDuration} min</span></div>
  <div class="summary-item"><span class="lbl">Tappe</span><span class="val">${steps.length}</span></div>
</div>
${schedBlock}
<table>
  <thead><tr><th>#</th><th>Orario</th><th>Cliente</th><th>Stato</th></tr></thead>
  <tbody>${homeStartRow}${rows}${homeEndRow}</tbody>
</table>
${qrBlock}
<footer>Generato automaticamente da Planner Tropini</footer>
<script>window.onload=function(){window.print()}</script>
</body></html>`);
    win.document.close();
  }

  return (
    <div className="fixed inset-0 z-[1500] md:flex md:items-center md:justify-center md:p-8 pointer-events-none">
      <div
        className="hidden md:block absolute inset-0 bg-slate-900/50 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Percorso calcolato"
        className="pointer-events-auto fixed inset-x-0 bottom-0 md:relative md:inset-auto md:w-full md:max-w-4xl bg-white border border-slate-200 rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col max-h-[70vh] md:max-h-[85vh] shadow-2xl"
      >
      <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 bg-indigo-600 text-white shrink-0">
        <div className="flex items-center gap-2 font-semibold text-sm md:text-base">
          <Navigation size={18} />
          Percorso
          <span className="text-indigo-200 font-normal text-sm">
            {result.totalDistance} km · ~{result.totalDuration} min · {steps.length} tappe
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20" aria-label="Chiudi">
          <X size={18} />
        </button>
      </div>

      <div className="flex gap-2 px-4 py-3 md:px-6 border-b border-slate-100 shrink-0">
        <button
          type="button"
          onClick={() => void handleMarkVisitsToday()}
          disabled={visitBusy}
          className="flex-1 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium disabled:opacity-50"
        >
          <Calendar size={12} className="inline mr-1" />
          {visitBusy ? "..." : "Visita oggi"}
        </button>
        <button onClick={handleGoogleMaps} className="p-2 rounded-lg bg-slate-50 border border-slate-200" title="Google Maps">
          <Map size={15} className="text-blue-600" />
        </button>
        <button onClick={handleWhatsApp} className="p-2 rounded-lg bg-slate-50 border border-slate-200" title="WhatsApp">
          <MessageCircle size={15} className="text-green-600" />
        </button>
        <button onClick={() => void handlePrint()} className="p-2 rounded-lg bg-slate-50 border border-slate-200" title="Stampa">
          <Printer size={15} className="text-orange-600" />
        </button>
      </div>

      <ol className="divide-y divide-gray-50 overflow-y-auto flex-1 min-h-0 md:grid md:grid-cols-2 md:divide-y-0 md:gap-px md:bg-slate-100 md:p-1">
        {homePoint && (
          <li className="flex items-center gap-2 px-4 py-3 md:px-5 md:py-4 bg-indigo-50/70 md:bg-white md:rounded-lg">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Home size={11} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-xs text-indigo-900">Partenza · Casa</div>
              <div className="text-[11px] text-indigo-700/70 truncate">{homePoint.label}</div>
            </div>
          </li>
        )}
        {steps.map(({ client, order }, index) => {
          const addr = [client.indirizzo, client.citta].filter(Boolean).join(", ");
          return (
            <li key={client.id} className="flex items-start gap-3 px-4 py-3 md:px-5 md:py-4 md:bg-white md:rounded-lg">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {order}
              </span>
              <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                <button
                  type="button"
                  aria-label="Sposta su"
                  disabled={index === 0}
                  onClick={() => moveStep(index, -1)}
                  className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-25 disabled:pointer-events-none"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Sposta giù"
                  disabled={index === steps.length - 1}
                  onClick={() => moveStep(index, 1)}
                  className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-25 disabled:pointer-events-none"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-gray-900 truncate">
                  <span className="font-bold">{client.cognome}</span>
                  {client.cognome && client.nome ? " " : ""}
                  {client.nome}
                </div>
                {addr && (
                  <div className="text-xs text-gray-500 truncate mt-0.5">{addr}</div>
                )}
                {client.telefono && (
                  <a
                    href={telHrefIt(client.telefono)}
                    className="text-xs text-blue-600 mt-0.5 block hover:underline"
                  >
                    {client.telefono}
                  </a>
                )}
                <label className="flex items-center gap-1.5 mt-1.5 text-[10px] text-gray-500">
                  <Clock size={11} className="shrink-0" />
                  <span className="sr-only">Orario previsto</span>
                  <input
                    type="time"
                    value={timesById[client.id] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTimesById((prev) => {
                        const next = { ...prev };
                        if (v) next[client.id] = v;
                        else delete next[client.id];
                        return next;
                      });
                    }}
                    className="border border-gray-200 rounded px-1 py-0.5 text-xs text-gray-800 bg-white"
                  />
                </label>
              </div>
              <span className={`shrink-0 mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full self-start ${STATO_COLORS[client.stato]}`}>
                {client.stato === "ATTIVO" ? "Attivo" : client.stato === "INATTIVO" ? "Inattivo" : "N/C"}
              </span>
            </li>
          );
        })}
        {homePoint && (
          <li className="flex items-center gap-2 px-4 py-3 md:px-5 md:py-4 bg-indigo-50/70 md:bg-white md:rounded-lg">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Home size={11} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-xs text-indigo-900">Rientro · Casa</div>
              <div className="text-[11px] text-indigo-700/70 truncate">{homePoint.label}</div>
            </div>
          </li>
        )}
      </ol>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
