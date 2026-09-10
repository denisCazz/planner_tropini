"use client";

import { useState, useEffect } from "react";
import { StickyNote, Send, User, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ClientNote } from "@/types/client";

interface ClientNotesPanelProps {
  clientId: number;
  compact?: boolean;
}

export default function ClientNotesPanel({ clientId, compact = false }: ClientNotesPanelProps) {
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [postingNote, setPostingNote] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/clients/${clientId}/notes`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ClientNote[]) => setNotes(Array.isArray(data) ? data : []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    const text = noteText.trim();
    if (!text) return;
    setPostingNote(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      setNotes((prev) => [data as ClientNote, ...prev]);
      setNoteText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore salvataggio nota");
    } finally {
      setPostingNote(false);
    }
  }

  async function deleteNote(noteId: number) {
    const prev = notes;
    setNotes((n) => n.filter((x) => x.id !== noteId));
    try {
      const res = await fetch(`/api/clients/${clientId}/notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setNotes(prev);
      toast.error("Impossibile eliminare la nota");
    }
  }

  return (
    <div className={compact ? "" : "glass rounded-2xl p-4 md:p-5"}>
      <h2
        className={`font-semibold text-gray-800 flex items-center gap-2 ${
          compact ? "text-xs mb-2" : "text-sm mb-3"
        }`}
      >
        <StickyNote size={compact ? 14 : 16} className="text-indigo-600" />
        Note e storico
        {notes.length > 0 && (
          <span className="text-xs font-normal text-gray-400">({notes.length})</span>
        )}
      </h2>

      <form onSubmit={addNote} className={`flex flex-col gap-2 ${compact ? "mb-3" : "mb-4"}`}>
        <textarea
          rows={compact ? 2 : 2}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Aggiungi una nota operativa per il team…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={postingNote || !noteText.trim()}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
          >
            {postingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Aggiungi nota
          </button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin text-indigo-400" />
        </div>
      ) : notes.length === 0 ? (
        <p className={`text-gray-400 text-center py-4 ${compact ? "text-xs" : "text-sm"}`}>
          Nessuna nota. Le note aggiunte qui sono condivise con tutto il team.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="group rounded-xl bg-white/60 border border-white/50 px-3 py-2.5"
            >
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                <User size={12} className="text-indigo-500" />
                <span className="font-medium text-gray-700">{n.authorName}</span>
                <span>·</span>
                <span>
                  {new Date(n.createdAt).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => void deleteNote(n.id)}
                  className="ml-auto p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Elimina nota"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
