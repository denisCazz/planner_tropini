"use client";

import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Settings } from "@/types/client";
import ImportForm from "@/components/ImportForm";

export default function ImpostazioniPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [label, setLabel] = useState("");
  const [nearestNeighbours, setNearestNeighbours] = useState(4);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Settings) => {
        setSettings(data);
        setLabel(data.startLabel);
        setNearestNeighbours(
          typeof data.nearestNeighbours === "number" ? data.nearestNeighbours : 4
        );
        setLoading(false);
      });
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startLabel: label, nearestNeighbours }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data);
      setNearestNeighbours(
        typeof data.nearestNeighbours === "number" ? data.nearestNeighbours : nearestNeighbours
      );
      toast.success("Impostazioni salvate");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Impostazioni</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configura il punto di partenza e importa dati da Google Earth Pro
        </p>
      </div>

      {/* Punto di partenza */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Punto di partenza percorso
        </h2>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          {loading ? (
            <div className="text-sm text-gray-400">Caricamento...</div>
          ) : (
            <form onSubmit={saveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Indirizzo
                </label>
                <input
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Via San Giorgio 14, Cavallermaggiore"
                />
                <p className="text-xs text-gray-400 mt-1">
                  L&apos;indirizzo viene geocodificato automaticamente
                </p>
              </div>

              {settings && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2">
                  Coordinate attuali:{" "}
                  <span className="font-mono">
                    {settings.startLat.toFixed(5)}, {settings.startLng.toFixed(5)}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Clienti &quot;più vicini&quot; sulla mappa
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={nearestNeighbours}
                  onChange={(e) =>
                    setNearestNeighbours(
                      Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1))
                    )
                  }
                />
                <p className="text-xs text-gray-400 mt-1">
                  Quanti clienti vicini includere con il pulsante arancione (1–20). Default 4.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {saving ? "Salvataggio..." : "Salva"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Import KML/KMZ */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-1">
          Importa da Google Earth Pro
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          Carica un file <strong>.kml</strong> o <strong>.kmz</strong> esportato
          da Google Earth Pro. I clienti esistenti con le stesse coordinate
          vengono aggiornati (upsert), non duplicati.
        </p>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <ImportForm />
        </div>
      </section>
    </div>
  );
}
