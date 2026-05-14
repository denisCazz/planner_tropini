import type { RouteResult, Settings, StatoCliente } from "@/types/client";
import { Navigation, Clock, Ruler, X, Printer, MessageCircle, Map } from "lucide-react";

const STATO_COLORS: Record<StatoCliente, string> = {
  ATTIVO: "bg-green-100 text-green-800",
  INATTIVO: "bg-gray-100 text-gray-700",
  PROSPECT: "bg-yellow-100 text-yellow-800",
};

interface RoutePanelProps {
  result: RouteResult;
  onClose: () => void;
  sharePhone?: string;
  settings?: Settings | null;
}

export default function RoutePanel({ result, onClose, sharePhone, settings }: RoutePanelProps) {

  /** Build a Google Maps multi-stop directions URL */
  function buildGoogleMapsUrl(): string {
    const stops = result.steps.map((s) => s.client);
    if (stops.length === 0) return "https://maps.google.com";

    // Use lat,lng if available, otherwise fall back to address
    function stopParam(c: (typeof stops)[0]): string {
      if (c.lat && c.lng) return `${c.lat},${c.lng}`;
      const addr = [c.indirizzo, c.citta, c.cap].filter(Boolean).join(", ");
      return encodeURIComponent(addr || `${c.nome} ${c.cognome}`);
    }

    // origin: settings start point or first client
    let originParam: string;
    if (settings?.startLat && settings?.startLng) {
      originParam = `${settings.startLat},${settings.startLng}`;
    } else {
      originParam = stopParam(stops[0]);
    }

    const destination = stopParam(stops[stops.length - 1]);
    const waypoints = stops
      .slice(0, stops.length - 1) // all except last (which is destination)
      .map(stopParam)
      .join("/");

    // Format: /maps/dir/ORIGIN/WP1/WP2/.../DESTINATION
    const base = "https://www.google.com/maps/dir";
    const parts = [originParam, ...(waypoints ? waypoints.split("/") : []), destination];
    return `${base}/${parts.join("/")}`;
  }

  function handleGoogleMaps() {
    window.open(buildGoogleMapsUrl(), "_blank", "noopener,noreferrer");
  }

  function buildWhatsAppText(): string {
    return buildGoogleMapsUrl();
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

  function handlePrint() {
    const win = window.open("", "_blank", "width=760,height=960");
    if (!win) return;
    const today = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
    const mapsUrl = buildGoogleMapsUrl();
    const rows = result.steps
      .map(({ order, client }) => {
        const addr = [client.indirizzo, client.citta, client.cap ? `(${client.cap})` : ""].filter(Boolean).join(", ");
        return `<tr>
          <td class="num">${order}</td>
          <td>
            <strong>${client.nome} ${client.cognome}</strong>
            ${addr ? `<div class="addr">${addr}</div>` : ""}
            ${client.telefono ? `<div class="tel">\uD83D\uDCDE ${client.telefono}</div>` : ""}
          </td>
          <td><span class="stato ${client.stato}">${client.stato === "ATTIVO" ? "Attivo" : client.stato === "INATTIVO" ? "Inattivo" : "N/C"}</span></td>
        </tr>`;
      })
      .join("");
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
  .qr-hint{font-size:10px;color:#64748b;text-align:right;max-width:160px}
  .summary{display:flex;gap:0;background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 20px;margin-bottom:24px;gap:32px}
  .summary-item{display:flex;flex-direction:column;gap:3px}
  .summary-item .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#64748b;font-weight:700}
  .summary-item .val{font-size:18px;font-weight:800;color:#1e3a8a}
  table{width:100%;border-collapse:collapse}
  thead tr{background:#f8fafc}
  th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700;border-bottom:2px solid #e2e8f0;padding:7px 10px}
  td{padding:11px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  td.num{width:36px;font-weight:800;color:#1d4ed8;font-size:15px;text-align:center}
  .addr{color:#555;font-size:11px;margin-top:3px}
  .tel{color:#1d4ed8;font-size:11px;margin-top:2px}
  .stato{display:inline-block;font-size:10px;font-weight:700;padding:3px 8px;border-radius:9999px}
  .ATTIVO{background:#dcfce7;color:#166534}
  .INATTIVO{background:#f3f4f6;color:#374151}
  .PROSPECT{background:#fef9c3;color:#854d0e}
  .maps-link{margin-top:22px;padding:12px 16px;background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;font-size:11px;color:#1e3a8a;word-break:break-all}
  .maps-link strong{display:block;margin-bottom:4px;font-size:12px}
  footer{margin-top:20px;font-size:10px;color:#94a3b8;text-align:right}
  @media print{body{padding:20px}.maps-link{display:none}}
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
  <div class="summary-item"><span class="lbl">Tappe</span><span class="val">${result.steps.length}</span></div>
</div>
<table>
  <thead><tr><th>#</th><th>Cliente</th><th>Stato</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="maps-link"><strong>Apri percorso in Google Maps:</strong>${mapsUrl}</div>
<footer>Generato automaticamente da Planner Tropini</footer>
<script>window.onload=function(){window.print()}</script>
</body></html>`);
    win.document.close();
  }

  return (
    <div className="absolute inset-x-3 top-3 md:inset-x-auto md:right-4 md:w-80 z-[1000] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Navigation size={16} />
          Percorso ottimale
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Stats row */}
      <div className="flex divide-x divide-gray-100 border-b border-gray-100 bg-gray-50">
        <div className="flex-1 flex flex-col items-center py-3 gap-0.5">
          <Ruler size={13} className="text-gray-400" />
          <span className="text-base font-bold text-gray-900">{result.totalDistance} km</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">distanza</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-3 gap-0.5">
          <Clock size={13} className="text-gray-400" />
          <span className="text-base font-bold text-gray-900">~{result.totalDuration} min</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">tempo</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-3 gap-0.5">
          <Navigation size={13} className="text-gray-400" />
          <span className="text-base font-bold text-gray-900">{result.steps.length}</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">tappe</span>
        </div>
      </div>

      {/* Share actions */}
      <div className="px-3 py-3 border-b border-gray-100 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Condividi percorso</p>
        <div className="grid grid-cols-3 gap-2">
          {/* Google Maps */}
          <button
            onClick={handleGoogleMaps}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-100 hover:border-blue-300 transition-colors group"
            title="Apri in Google Maps con tutte le tappe"
          >
            <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-blue-100 flex items-center justify-center group-hover:shadow transition-shadow">
              <Map size={16} className="text-blue-600" />
            </div>
            <span className="text-[10px] font-semibold text-blue-700 leading-tight text-center">Google<br/>Maps</span>
          </button>

          {/* WhatsApp */}
          <button
            onClick={handleWhatsApp}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-green-50 hover:bg-green-100 border border-green-100 hover:border-green-300 transition-colors group"
            title={sharePhone ? `Invia su WhatsApp a ${sharePhone}` : "Condividi su WhatsApp"}
          >
            <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-green-100 flex items-center justify-center group-hover:shadow transition-shadow">
              <MessageCircle size={16} className="text-green-600" />
            </div>
            <span className="text-[10px] font-semibold text-green-700 leading-tight text-center">
              {sharePhone ? "WhatsApp" : "WhatsApp"}<br/>
              {sharePhone ? <span className="font-normal text-green-500">→ contatto</span> : <span className="font-normal text-green-500">condividi</span>}
            </span>
          </button>

          {/* PDF */}
          <button
            onClick={handlePrint}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-100 hover:border-orange-300 transition-colors group"
            title="Stampa itinerario PDF"
          >
            <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-orange-100 flex items-center justify-center group-hover:shadow transition-shadow">
              <Printer size={16} className="text-orange-600" />
            </div>
            <span className="text-[10px] font-semibold text-orange-700 leading-tight text-center">Stampa<br/>PDF</span>
          </button>
        </div>
      </div>

      {/* Steps list */}
      <ol className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
        {result.steps.map(({ client, order }) => {
          const addr = [client.indirizzo, client.citta].filter(Boolean).join(", ");
          return (
            <li key={client.id} className="flex items-start gap-3 px-4 py-2.5">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {order}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-gray-900 truncate">
                  {client.nome} {client.cognome}
                </div>
                {addr && (
                  <div className="text-xs text-gray-500 truncate mt-0.5">{addr}</div>
                )}
                {client.telefono && (
                  <div className="text-xs text-blue-600 mt-0.5">{client.telefono}</div>
                )}
              </div>
              <span className={`shrink-0 mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATO_COLORS[client.stato]}`}>
                {client.stato === "ATTIVO" ? "Attivo" : client.stato === "INATTIVO" ? "Inattivo" : "N/C"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

