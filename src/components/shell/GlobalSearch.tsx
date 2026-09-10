"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Flame } from "lucide-react";
import { STATO_META, TIPO_LABEL } from "@/lib/status";
import type { StatoIntervento, TipoIntervento } from "@/types/client";

type SearchResult = {
  clients: { id: number; displayName: string; citta: string | null; telefono: string | null }[];
  plants?: { id: number; clientId: number; label: string; clientName: string }[];
  interventi: { id: number; stato: StatoIntervento; tipo: TipoIntervento; clientName: string; citta: string | null }[];
};

export default function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 2) {
      seq.current += 1;
      setData(null);
      setLoading(false);
      setOpen(false);
      return;
    }
    const id = ++seq.current;
    timer.current = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (seq.current !== id) return;
          setData(d);
          setOpen(true);
        })
        .catch(() => {
          if (seq.current !== id) return;
          setData(null);
        })
        .finally(() => {
          if (seq.current === id) setLoading(false);
        });
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    setData(null);
    router.push(href);
  }

  const plants = data?.plants ?? [];
  const empty =
    data &&
    data.clients.length === 0 &&
    plants.length === 0 &&
    data.interventi.length === 0;

  return (
    <div ref={boxRef} className="relative w-full">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        type="text"
        role="searchbox"
        autoComplete="off"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => data && setOpen(true)}
        placeholder="Cerca…"
        className="field field-icon text-sm"
      />
      {open && (data || loading) && (
        <div className="absolute z-[80] mt-1.5 left-0 w-[22rem] max-w-[min(22rem,calc(100vw-1.5rem))] card shadow-xl overflow-hidden max-h-[70vh] overflow-y-auto">
          {loading && !data && (
            <p className="px-3 py-4 text-sm text-slate-500">Ricerca…</p>
          )}
          {empty && <p className="px-3 py-4 text-sm text-slate-500">Nessun risultato</p>}
          {data && data.clients.length > 0 && (
            <Section title="Clienti">
              {data.clients.map((c) => (
                <button
                  key={`c-${c.id}`}
                  type="button"
                  onClick={() => go(`/clienti/${c.id}`)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                >
                  <span className="font-medium text-slate-900">{c.displayName}</span>
                  <span className="text-slate-500 ml-2">{c.citta ?? ""}</span>
                </button>
              ))}
            </Section>
          )}
          {plants.length > 0 && (
            <Section title="Impianti">
              {plants.map((p) => (
                <button
                  key={`p-${p.id}`}
                  type="button"
                  onClick={() => go(`/clienti/${p.clientId}`)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                >
                  <span className="font-medium text-slate-900">{p.label}</span>
                  <span className="text-slate-500 ml-2">{p.clientName}</span>
                </button>
              ))}
            </Section>
          )}
          {data && data.interventi.length > 0 && (
            <Section title="Interventi">
              {data.interventi.map((i) => (
                <button
                  key={`i-${i.id}`}
                  type="button"
                  onClick={() => go(`/interventi?focus=${i.id}`)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm flex items-center gap-2"
                >
                  <span className="font-medium">{i.clientName}</span>
                  <span className="text-slate-500">{TIPO_LABEL[i.tipo]}</span>
                  <span className="ml-auto text-[11px] font-semibold" style={{ color: STATO_META[i.stato]?.color }}>
                    {STATO_META[i.stato]?.short}
                  </span>
                </button>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 last:border-0">
      <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
        <Flame size={10} /> {title}
      </div>
      {children}
    </div>
  );
}
