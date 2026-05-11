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
      `🗺 Percorso ottimale — ${result.totalDistance} km, ${result.totalDuration} min`,
      "",
      ...result.steps.map(
        ({ order, client }) =>
          `${order}. ${client.nome} ${client.cognome}${client.indirizzo ? `\n   📍 ${client.indirizzo}` : ""}`
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
    const win = window.open("", "_blank", "width=640,height=800");
    if (!win) return;
    const rows = result.steps
      .map(
        ({ order, client }) => `
        <li>
          <strong>${order}. ${client.nome} ${client.cognome}</strong>
          ${client.indirizzo ? `<div class="addr">${client.indirizzo}</div>` : ""}
          <span class="stato ${client.stato}">${client.stato.charAt(0) + client.stato.slice(1).toLowerCase()}</span>
        </li>`
      )
      .join("");
    win.document.write(`<!DOCTYPE html>
<html lang="it"><head>
<meta charset="utf-8">
<title>Itinerario — Planner Tropini</title>
<style>
  body{font-family:Arial,sans-serif;padding:28px;color:#111;max-width:560px}
  h1{font-size:20px;margin-bottom:4px}
  .meta{color:#555;font-size:14px;margin-bottom:20px}
  ol{padding-left:20px;line-height:1.8}
  li{margin-bottom:14px}
  .addr{color:#555;font-size:13px}
  .stato{display:inline-block;font-size:11px;padding:2px 7px;border-radius:9999px;margin-top:3px}
  .ATTIVO{background:#dcfce7;color:#166534}
  .INATTIVO{background:#fee2e2;color:#991b1b}
  .PROSPECT{background:#fef9c3;color:#854d0e}
  @media print{button{display:none}}
</style></head><body>
<h1>🗺 Itinerario di viaggio</h1>
<div class="meta">${result.totalDistance} km &bull; ${result.totalDuration} min</div>
<ol>${rows}</ol>
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
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrint}
            className="p-1 rounded hover:bg-blue-500 transition-colors"
            title="Stampa itinerario"
          >
            <Printer size={15} />
          </button>
          <button
            onClick={handleShare}
            className="p-1 rounded hover:bg-blue-500 transition-colors"
            title={sharePhone ? "Invia su WhatsApp" : "Condividi"}
          >
            <Share2 size={15} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-blue-500 transition-colors"
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

