import type { RouteResult, StatoCliente } from "@/types/client";
import { Navigation, Clock, Ruler, X, Share2, Printer } from "lucide-react";

const STATO_COLORS: Record<StatoCliente, string> = {
  ATTIVO: "bg-green-100 text-green-800",
  INATTIVO: "bg-red-100 text-red-800",
  PROSPECT: "bg-yellow-100 text-yellow-800",
};

interface RoutePanelProps {
  result: RouteResult;
  onClose: () => void;
  sharePhone?: string;
}

export default function RoutePanel({ result, onClose, sharePhone }: RoutePanelProps) {
  function handleShare() {
    const lines = [
      `Percorso ottimale — ${result.totalDistance} km, ${result.totalDuration} min`,
      "",
      ...result.steps.map(
        ({ order, client }) =>
          `${order}. ${client.nome} ${client.cognome}${client.indirizzo ? `\n   ${client.indirizzo}` : ""}`
      ),
    ];
    const text = lines.join("\n");

    if (sharePhone) {
      const phone = sharePhone.replace(/\D/g, "");
      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } else {
      // Fallback: Web Share API o clipboard
      if (navigator.share) {
        navigator.share({ text });
      } else {
        navigator.clipboard.writeText(text).then(() => alert("Percorso copiato negli appunti"));
      }
    }
  }

  function handlePrint() {
    const win = window.open("", "_blank", "width=700,height=900");
    if (!win) return;
    const today = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
    const rows = result.steps
      .map(
        ({ order, client }) => `
        <tr>
          <td class="num">${order}</td>
          <td>
            <strong>${client.nome} ${client.cognome}</strong>
            ${client.indirizzo ? `<div class="addr">${client.indirizzo}</div>` : ""}
          </td>
          <td><span class="stato ${client.stato}">${client.stato.charAt(0) + client.stato.slice(1).toLowerCase()}</span></td>
        </tr>`
      )
      .join("");
    win.document.write(`<!DOCTYPE html>
<html lang="it"><head>
<meta charset="utf-8">
<title>Itinerario — Planner Tropini</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:13px}
  header{border-bottom:2px solid #1d4ed8;padding-bottom:12px;margin-bottom:20px}
  header h1{font-size:18px;font-weight:700;color:#1d4ed8;letter-spacing:.3px}
  header p{font-size:12px;color:#555;margin-top:4px}
  .summary{display:flex;gap:32px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;margin-bottom:24px}
  .summary div{display:flex;flex-direction:column;gap:2px}
  .summary .label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:600}
  .summary .value{font-size:16px;font-weight:700;color:#111}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;padding:6px 8px}
  td{padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  td.num{width:32px;font-weight:700;color:#1d4ed8;font-size:14px;text-align:center}
  .addr{color:#555;font-size:11px;margin-top:3px}
  .stato{display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:9999px;letter-spacing:.2px}
  .ATTIVO{background:#dcfce7;color:#166534}
  .INATTIVO{background:#fee2e2;color:#991b1b}
  .PROSPECT{background:#fef9c3;color:#854d0e}
  footer{margin-top:24px;font-size:10px;color:#94a3b8;text-align:right}
  @media print{body{padding:20px}}
</style></head><body>
<header>
  <h1>Itinerario di visita</h1>
  <p>Planner Tropini &mdash; ${today}</p>
</header>
<div class="summary">
  <div><span class="label">Distanza totale</span><span class="value">${result.totalDistance} km</span></div>
  <div><span class="label">Tempo stimato</span><span class="value">${result.totalDuration} min</span></div>
  <div><span class="label">Clienti</span><span class="value">${result.steps.length}</span></div>
</div>
<table>
  <thead><tr><th>#</th><th>Cliente</th><th>Stato</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<footer>Generato automaticamente da Planner Tropini</footer>
<script>window.onload=function(){window.print()}</script>
</body></html>`);
    win.document.close();
  }

  return (
    <div className="absolute inset-x-4 top-4 md:inset-x-auto md:right-4 md:w-72 z-[1000] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Navigation size={16} />
          Percorso ottimale
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors"
            title="Stampa itinerario"
          >
            <Printer size={13} />
            Stampa
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors"
            title={sharePhone ? "Invia su WhatsApp" : "Condividi"}
          >
            <Share2 size={13} />
            {sharePhone ? "WhatsApp" : "Condividi"}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-blue-500 transition-colors ml-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-100">
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700">
          <Ruler size={14} className="text-gray-400" />
          <span className="font-medium">{result.totalDistance} km</span>
        </div>
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 border-l border-gray-100">
          <Clock size={14} className="text-gray-400" />
          <span className="font-medium">{result.totalDuration} min</span>
        </div>
      </div>

      <ol className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {result.steps.map(({ client, order }) => (
          <li key={client.id} className="flex items-start gap-3 px-4 py-3">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {order}
            </span>
            <div className="min-w-0">
              <div className="font-medium text-sm text-gray-900 truncate">
                {client.nome} {client.cognome}
              </div>
              {client.indirizzo && (
                <div className="text-xs text-gray-500 truncate mt-0.5">
                  {client.indirizzo}
                </div>
              )}
              <span
                className={`inline-flex mt-1 px-1.5 py-0.5 rounded text-xs font-medium ${STATO_COLORS[client.stato]}`}
              >
                {client.stato.charAt(0) + client.stato.slice(1).toLowerCase()}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

