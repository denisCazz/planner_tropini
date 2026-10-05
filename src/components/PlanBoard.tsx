"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Mail, MessageCircle, Phone, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Candidate, Plan, PlanStop } from "@/types/plan";
import { personName, clientAddress } from "@/lib/share";
import { telHref } from "@/lib/phone";

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

const STATUS_LABEL: Record<PlanStop["status"], string> = {
  DA_CHIAMARE: "Da chiamare",
  SMS_INVIATO: "SMS inviato",
  CONFERMATO: "Confermato",
  NON_DISPONIBILE: "Non disponibile",
  NESSUNA_RISPOSTA: "Nessuna risposta",
};

export default function PlanBoard({ initial, flash }: { initial: Plan[]; flash?: { messaggio?: string; warnings?: string[] } }) {
  const [plans, setPlans] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Record<number, Candidate[]>>({});
  const [calendarHref, setCalendarHref] = useState<Record<number, string>>({});

  useEffect(() => {
    if (flash?.messaggio) toast.success(flash.messaggio);
    flash?.warnings?.forEach((w) => toast.warning(w));
  }, [flash]);

  function replace(plan: Plan) {
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? plan : p)));
  }

  async function act(key: string, url: string, init?: RequestInit) {
    setBusy(key);
    try {
      const res = await fetch(url, init);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      if (data.plan) replace(data.plan);
      else if (data.id) replace(data as Plan);
      if (data.calendarDate && data.plan?.id) {
        setCalendarHref((prev) => ({ ...prev, [data.plan.id]: `/calendario?date=${data.calendarDate}` }));
        toast.success(data.warning ? `Percorso in calendario. ${data.warning}` : "Percorso creato e messo in calendario");
      }
      if (data.whatsappUrl) window.open(data.whatsappUrl, "_blank", "noopener");
      if (Array.isArray(data.errors)) data.errors.forEach((e: string) => toast.error(e));
      if (typeof data.sent === "number") toast.success(`${data.sent} SMS inviati`);
      return data;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function loadCandidates(planId: number) {
    const res = await fetch(`/api/plans/${planId}/candidates`);
    if (!res.ok) return;
    const list = (await res.json()) as Candidate[];
    setCandidates((c) => ({ ...c, [planId]: list }));
  }

  async function removePlan(id: number) {
    if (!confirm("Eliminare questa giornata?")) return;
    setBusy(`del-${id}`);
    const res = await fetch(`/api/plans/${id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) setPlans((prev) => prev.filter((p) => p.id !== id));
    else toast.error("Non eliminato");
  }

  const groups = new Map<string, Plan[]>();
  for (const p of plans) {
    const key = p.data.slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  if (plans.length === 0) {
    return <p className="text-slate-500 text-sm">Nessun piano in questo elenco.</p>;
  }

  return (
    <div className="space-y-8">
      {[...groups.entries()].map(([day, dayPlans]) => (
        <section key={day}>
          <h2 className="text-lg font-semibold capitalize text-slate-800 mb-3">{dayLabel(day)}</h2>
          <div className="space-y-4">
            {dayPlans.map((plan) => {
              const active = plan.stops.filter((s) => s.status !== "NON_DISPONIBILE");
              const confirmed = active.filter((s) => s.status === "CONFERMATO").length;
              const pending = active.some((s) => s.status === "DA_CHIAMARE" || s.status === "SMS_INVIATO" || s.status === "NESSUNA_RISPOSTA");
              return (
                <article key={plan.id} className="card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {personName(plan.technician)} · {plan.zona}
                      </div>
                      <div className="text-xs text-slate-500">
                        {confirmed} tenuti su {active.length} · raggio {plan.raggioKm} km
                        {plan.totalDistance != null ? ` · ${plan.totalDistance} km · ~${plan.totalDuration} min` : ""}
                        {pending ? " · puoi creare il percorso anche senza tutte le risposte" : ""}
                      </div>
                    </div>
                    <button type="button" onClick={() => removePlan(plan.id)} className="text-slate-400 hover:text-rose-600 p-1" aria-label="Elimina piano">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 py-2 w-10">#</th>
                          <th className="text-left px-3 py-2 w-16">Ora</th>
                          <th className="text-left px-3 py-2">Cliente</th>
                          <th className="text-left px-3 py-2">Telefono</th>
                          <th className="text-left px-3 py-2">Indirizzo</th>
                          <th className="text-right px-3 py-2 w-16">km</th>
                          <th className="text-left px-3 py-2">Perché</th>
                          <th className="text-left px-3 py-2">Stato</th>
                          <th className="text-right px-3 py-2">Scelta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {plan.stops.map((stop, index) => {
                          const kept = stop.status === "CONFERMATO";
                          const dropped = stop.status === "NON_DISPONIBILE";
                          const phone = stop.client.telefono || stop.client.telefono2;
                          return (
                            <tr key={stop.id} className={kept ? "bg-emerald-50" : dropped ? "bg-slate-50 text-slate-400" : ""}>
                              <td className="px-3 py-2 font-semibold text-teal-800">{stop.ordine ?? index + 1}</td>
                              <td className="px-3 py-2 tabular-nums">{stop.orario ?? "—"}</td>
                              <td className="px-3 py-2 font-medium text-slate-900">{personName(stop.client)}</td>
                              <td className="px-3 py-2">
                                {phone ? <a className="text-teal-700" href={telHref(phone)}>{phone}</a> : "—"}
                              </td>
                              <td className="px-3 py-2 text-slate-600">{clientAddress(stop.client) || "—"}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{stop.distanzaKm ?? "—"}</td>
                              <td className="px-3 py-2 text-xs text-slate-500">{stop.motivo ?? "—"}</td>
                              <td className="px-3 py-2">
                                <span className={`text-xs rounded px-1.5 py-0.5 ${kept ? "bg-emerald-600 text-white" : dropped ? "bg-slate-200 text-slate-500" : "bg-amber-100 text-amber-800"}`}>
                                  {STATUS_LABEL[stop.status]}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {!dropped && (
                                  <div className="flex justify-end gap-1">
                                    {phone && <a href={telHref(phone)} className="p-1.5 rounded border border-slate-200" title="Chiama"><Phone size={14} /></a>}
                                    <button
                                      type="button"
                                      disabled={!!busy || kept}
                                      title="Tieni"
                                      onClick={() =>
                                        act(`ok-${stop.id}`, `/api/stops/${stop.id}`, {
                                          method: "PATCH",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ status: "CONFERMATO" }),
                                        })
                                      }
                                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-50"
                                    >
                                      <Check size={12} /> Tieni
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!!busy}
                                      title="Non può, sostituisci"
                                      onClick={() =>
                                        act(`no-${stop.id}`, `/api/stops/${stop.id}`, {
                                          method: "PATCH",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ status: "NON_DISPONIBILE" }),
                                        })
                                      }
                                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-rose-200 text-rose-700"
                                    >
                                      <X size={12} /> No
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-4 py-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!!busy || active.length === 0}
                    className="text-sm px-3 py-2 rounded-lg bg-teal-700 text-white disabled:opacity-50 font-medium"
                    onClick={() => act(`opt-${plan.id}`, `/api/plans/${plan.id}/optimize`, { method: "POST" })}
                  >
                    {busy === `opt-${plan.id}` ? (
                      <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Sto creando il percorso…</span>
                    ) : (
                      "Crea percorso e metti in calendario"
                    )}
                  </button>
                  {(calendarHref[plan.id] || plan.status === "PRONTO" || plan.status === "INVIATO") && (
                    <Link href={calendarHref[plan.id] ?? `/calendario?date=${plan.data.slice(0, 10)}`} className="text-sm font-medium text-teal-700">
                      Vedi in calendario
                    </Link>
                  )}

                  <div className="flex flex-wrap gap-2 ml-auto">
                    <button type="button" className="text-sm px-3 py-1.5 rounded-lg border border-slate-200" onClick={() => loadCandidates(plan.id)}>
                      <Plus size={14} className="inline mr-1" /> Altro cliente
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      className="text-sm px-3 py-1.5 rounded-lg border border-slate-200"
                      onClick={() => act(`smsall-${plan.id}`, `/api/plans/${plan.id}/sms-all`, { method: "POST" })}
                    >
                      SMS a tutti
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      className="text-sm px-3 py-1.5 rounded-lg border border-slate-200"
                      onClick={() =>
                        act(`mail-${plan.id}`, `/api/plans/${plan.id}/send`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ channels: ["email"] }),
                        })
                      }
                    >
                      <Mail size={14} className="inline mr-1" /> Email
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      className="text-sm px-3 py-1.5 rounded-lg border border-slate-200"
                      onClick={() =>
                        act(`wa-${plan.id}`, `/api/plans/${plan.id}/send`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ channels: ["whatsapp"] }),
                        })
                      }
                    >
                      <MessageCircle size={14} className="inline mr-1" /> WhatsApp
                    </button>
                  </div>
                  </div>

                  {candidates[plan.id] && (
                    <table className="w-full text-sm border-t border-slate-200">
                      <thead className="text-xs text-slate-500">
                        <tr>
                          <th className="text-left px-3 py-2">Altri clienti in zona</th>
                          <th className="text-left px-3 py-2">Indirizzo</th>
                          <th className="text-right px-3 py-2">km</th>
                          <th className="text-right px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {candidates[plan.id].map((c) => (
                          <tr key={c.client.id}>
                            <td className="px-3 py-2 font-medium">{personName(c.client)}</td>
                            <td className="px-3 py-2 text-slate-600">{clientAddress(c.client) || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{c.distanzaKm}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                className="text-xs px-2 py-1 rounded border border-slate-200"
                                onClick={async () => {
                                  await act(`add-${plan.id}-${c.client.id}`, `/api/plans/${plan.id}/stops`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ clientId: c.client.id }),
                                  });
                                  setCandidates((prev) => ({ ...prev, [plan.id]: prev[plan.id].filter((x) => x.client.id !== c.client.id) }));
                                }}
                              >
                                Aggiungi
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
