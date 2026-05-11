"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ImportResult } from "@/types/client";

export default function ImportForm() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".kml") && !name.endsWith(".kmz")) {
      toast.error("Formato non supportato. Usa .kml o .kmz");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResult(data);
      toast.success(
        `Import completato: ${data.created} creati, ${data.updated} aggiornati`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore import");
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".kml,.kmz"
          className="hidden"
          onChange={onInputChange}
        />
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-blue-600">
            <Loader2 size={32} className="animate-spin" />
            <span className="text-sm font-medium">Importazione in corso...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <Upload size={32} className="text-gray-400" />
            <span className="text-sm font-medium">
              Trascina qui un file .kml o .kmz
            </span>
            <span className="text-xs text-gray-400">
              oppure clicca per selezionare
            </span>
          </div>
        )}
      </div>

      {result && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-700">
            Risultato import
          </div>
          <div className="divide-y divide-gray-100">
            <div className="flex items-center gap-3 px-4 py-3">
              <CheckCircle size={16} className="text-green-500" />
              <span className="text-sm text-gray-700">
                <strong>{result.created}</strong> clienti creati
              </span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <CheckCircle size={16} className="text-blue-500" />
              <span className="text-sm text-gray-700">
                <strong>{result.updated}</strong> clienti aggiornati
              </span>
            </div>
            {result.skipped > 0 && (
              <div className="flex items-center gap-3 px-4 py-3">
                <AlertCircle size={16} className="text-yellow-500" />
                <span className="text-sm text-gray-700">
                  <strong>{result.skipped}</strong> saltati
                </span>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="px-4 py-3">
                <div className="text-xs text-red-500 space-y-0.5">
                  {result.errors.map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
