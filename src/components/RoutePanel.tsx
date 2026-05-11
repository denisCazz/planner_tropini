import type { RouteResult, StatoCliente } from "@/types/client";
import { Navigation, Clock, Ruler, X } from "lucide-react";

const STATO_COLORS: Record<StatoCliente, string> = {
  ATTIVO: "bg-green-100 text-green-800",
  INATTIVO: "bg-red-100 text-red-800",
  PROSPECT: "bg-yellow-100 text-yellow-800",
};

interface RoutePanelProps {
  result: RouteResult;
  onClose: () => void;
}

export default function RoutePanel({ result, onClose }: RoutePanelProps) {
  return (
    <div className="absolute inset-x-4 top-4 md:inset-x-auto md:right-4 md:w-72 z-[1000] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Navigation size={16} />
          Percorso ottimale
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-blue-500 transition-colors"
        >
          <X size={16} />
        </button>
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
