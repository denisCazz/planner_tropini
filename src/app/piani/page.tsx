"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PlanBoard from "@/components/PlanBoard";
import type { Plan } from "@/types/plan";

function PianiInner() {
  const params = useSearchParams();
  const batch = params.get("batch");
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ messaggio?: string; warnings?: string[] } | undefined>();

  useEffect(() => {
    const raw = sessionStorage.getItem("planFlash");
    if (raw) {
      sessionStorage.removeItem("planFlash");
      try {
        setFlash(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
    const q = batch ? `?batchId=${encodeURIComponent(batch)}` : "";
    fetch(`/api/plans${q}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) {
          setError("Database non raggiungibile. I piani restano salvati solo dopo la migrazione.");
          setPlans([]);
          return;
        }
        setPlans(data);
      })
      .catch(() => {
        setError("Database non raggiungibile. I piani restano salvati solo dopo la migrazione.");
        setPlans([]);
      });
  }, [batch]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Giornate</h1>
        <Link href="/assistente" className="text-sm text-teal-700 font-medium">
          Nuova richiesta
        </Link>
      </div>
      {error && <p className="mb-3 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p>}
      {plans === null ? <p className="text-sm text-slate-400">Caricamento…</p> : <PlanBoard initial={plans} flash={flash} />}
    </div>
  );
}

export default function PianiPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Caricamento…</p>}>
      <PianiInner />
    </Suspense>
  );
}
