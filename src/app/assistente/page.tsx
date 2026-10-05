"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUp, Loader2, Mic, Phone, Sparkles } from "lucide-react";
import { toast } from "sonner";

const EXAMPLES = [
  "Pianificami le giornate di Gianfranco e Simone domani. Gianfranco 4 clienti zona Revello, Simone 6 zona Carmagnola.",
  "Dammi il numero di Cinzia Paduano di Grugliasco",
  "Settimana di Marco: lunedì Saluzzo, martedì Savigliano, mercoledì Fossano. 5 clienti al giorno.",
];

interface AnswerClient {
  id: number;
  nome: string;
  cognome: string;
  ragioneSociale: string | null;
  citta: string | null;
  telefono: string | null;
  telefono2: string | null;
  indirizzo: string | null;
}

interface Bubble {
  id: number;
  question: string;
  answer: string;
  clienti: AnswerClient[];
}

interface SpeechRec {
  lang: string;
  start: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

export default function AssistentePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  function dictate() {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec })
      .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Dettatura solo su Chrome.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "it-IT";
    rec.onresult = (ev) => setText(ev.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }

  async function submit() {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: q }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.replace("/login?from=/assistente");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Errore");
      if (data.kind === "domanda") {
        setBubbles((prev) => [
          ...prev,
          { id: Date.now(), question: q, answer: data.messaggio || "Nessun dato.", clienti: data.clienti ?? [] },
        ]);
        setText("");
        return;
      }
      if (!data.batchId) {
        toast.message(data.messaggio || "Non ho capito la richiesta. I tecnici devono esistere in anagrafica.");
        return;
      }
      sessionStorage.setItem("planFlash", JSON.stringify({ messaggio: data.messaggio, warnings: data.warnings ?? [] }));
      router.push(`/piani?batch=${data.batchId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 text-teal-700 font-semibold text-sm mb-2">
        <Sparkles size={16} /> Assistente
      </div>
      <h1 className="text-3xl font-bold text-slate-900">Chi mandiamo, dove, e quanti.</h1>
      <p className="mt-2 text-slate-500">
        Scrivi o detta. Puoi pianificare una giornata oppure chiedere un dato, per esempio un numero di telefono.
      </p>
      {bubbles.length > 0 && (
        <div className="mt-4 space-y-3">
          {bubbles.map((b) => (
            <div key={b.id} className="space-y-2">
              <p className="text-sm text-slate-500">{b.question}</p>
              <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap">{b.answer}</div>
              {b.clienti.map((c) => {
                const phone = c.telefono || c.telefono2;
                const digits = (phone ?? "").replace(/\D/g, "");
                const label = [c.nome, c.cognome].filter(Boolean).join(" ") || c.ragioneSociale || "Cliente";
                return (
                  <div key={c.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex flex-wrap items-center gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-slate-500">{[c.citta, c.indirizzo].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                    <div className="ml-auto flex gap-2">
                      {phone && <a className="btn btn-primary text-xs py-1" href={`tel:${digits}`}><Phone size={12} /> {phone}</a>}
                      {digits && <a className="btn text-xs py-1" href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer">WhatsApp</a>}
                      <Link className="btn text-xs py-1" href={`/clienti/${c.id}`}>Scheda</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <form
        className="mt-5 relative"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Domani: Gianfranco 4 clienti zona Revello, Simone 6 zona Carmagnola…"
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 pr-24 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
        <div className="absolute right-2 bottom-2 flex gap-1.5">
          <button type="button" onClick={dictate} className={`w-10 h-10 rounded-xl flex items-center justify-center ${listening ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"}`}>
            <Mic size={18} />
          </button>
          <button type="submit" disabled={busy || !text.trim()} className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center disabled:opacity-40">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
          </button>
        </div>
      </form>
      <div className="mt-3 flex flex-col gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => setText(ex)} className="text-left text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2.5 hover:border-teal-300">
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
