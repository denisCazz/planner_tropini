"use client";

import { useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export type ClientDoc = {
  id: number;
  title: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  url?: string;
};

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClientDocumentsPanel({
  clientId,
  documents = [],
  onChanged,
}: {
  clientId: number;
  documents?: ClientDoc[];
  onChanged?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.set("clientId", String(clientId));
    form.set("file", file);
    form.set("title", file.name.replace(/\.[^.]+$/, ""));
    const res = await fetch("/api/documents", { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error((err as { error?: string }).error ?? "Caricamento non riuscito");
      return;
    }
    toast.success("Documento caricato");
    onChanged?.();
  }

  async function remove(id: number) {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Impossibile eliminare");
      return;
    }
    toast.success("Documento rimosso");
    onChanged?.();
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />
      <button
        type="button"
        className="btn btn-ghost text-xs"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={14} />
        {uploading ? "Caricamento…" : "Carica documento"}
      </button>
      {documents.length === 0 ? (
        <p className="text-sm text-slate-400">Nessun documento</p>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-sm border border-slate-100 rounded-lg px-3 py-2">
              <FileText size={16} className="text-teal-700 shrink-0" />
              <a
                href={d.url ?? `/api/documents/${d.id}/file`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate hover:text-teal-700"
              >
                {d.title || d.filename}
              </a>
              <span className="text-[11px] text-slate-400 shrink-0">{formatSize(d.size)}</span>
              <button
                type="button"
                className="text-slate-400 hover:text-red-600"
                onClick={() => void remove(d.id)}
                title="Elimina"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
