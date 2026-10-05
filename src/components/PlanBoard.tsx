"use client";

import { useEffect, useState } from "react";
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
                <article key={plan.id} className="glass rounded-2xl p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {personName(plan.technician)} · {plan.zona}
                      </div>
                      <div className="text-sm text-slate-500">
                        {confirmed}/{active.length} confermati · raggio {plan.raggioKm} km
                        {plan.totalDistance != null ? ` · ${plan.totalDistance} km · ~${plan.totalDuration} min` : ""}
                        {" · "}
                        {plan.status}
                      </div>
                    </div>
                    <button type="button" onClick={() => removePlan(plan.id)} className="text-slate-400 hover:text-rose-600 p-1" aria-label="Elimina piano">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {pending && (
                    <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      Qualcuno non ha ancora risposto. Puoi creare il percorso lo stesso.
                    </p>
                  )}

                  <ul className="mt-3 divide-y divide-slate-100">
                    {plan.stops.map((stop) => (
                      <li key={stop.id} className={`py-2.5 flex flex-wrap items-center gap-2 ${stop.status === "NON_DISPONIBILE" ? "opacity-50" : ""}`}>
                        <span className="w-6 text-sm font-semibold text-teal-700">{stop.ordine ?? "·"}</span>
                        <div className="min-w-[12rem] flex-1">
                          <div className="font-medium text-slate-900">
                            {stop.orario ? `${stop.orario} · ` : ""}
                            {personName(stop.client)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {clientAddress(stop.client)}
                            {stop.motivo ? ` · ${stop.motivo}` : ""}
                          </div>
                        </div>
                        <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{STATUS_LABEL[stop.status]}</span>
                        {stop.status !== "NON_DISPONIBILE" && (
                          <div className="flex gap-1">
                            <a href={telHref(stop.client.telefono || stop.client.telefono2)} className="p-2 rounded-lg bg-slate-100 text-slate-700" title="Chiama">
                              <Phone size={14} />
                            </a>
                            <button
                              type="button"
                              disabled={!!busy}
                              onClick={() => act(`sms-${stop.id}`, `/api/stops/${stop.id}/sms`, { method: "POST" })}
                              className="px-2 py-1 text-xs rounded-lg bg-slate-100"
                            >
                              SMS
                            </button>
                            <button
                              type="button"
                              disabled={!!busy}
                              onClick={() =>
                                act(`ok-${stop.id}`, `/api/stops/${stop.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: "CONFERMATO" }),
                                })
                              }
                              className="p-2 rounded-lg bg-emerald-50 text-emerald-700"
                              title="Disponibile"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={!!busy}
                              onClick={() =>
                                act(`no-${stop.id}`, `/api/stops/${stop.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: "NON_DISPONIBILE" }),
                                })
                              }
                              className="p-2 rounded-lg bg-rose-50 text-rose-700"
                              title="Non disponibile, sostituisci"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="text-sm px-3 py-1.5 rounded-lg border border-slate-200" onClick={() => loadCandidates(plan.id)}>
                      <Plus size={14} className="inline mr-1" /> Altro cliente
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      className="text-sm px-3 py-1.5 rounded-lg bg-teal-700 text-white disabled:opacity-50"
                      onClick={() => act(`opt-${plan.id}`, `/api/plans/${plan.id}/optimize`, { method: "POST" })}
                    >
                      {busy === `opt-${plan.id}` ? <Loader2 size={14} className="inline animate-spin" /> : null} Crea percorso
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

                  {candidates[plan.id] && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {candidates[plan.id].map((c) => (
                        <button
                          key={c.client.id}
                          type="button"
                          className="text-xs px-2 py-1 rounded-lg bg-slate-50 border border-slate-200"
                          onClick={async () => {
                            await act(`add-${plan.id}-${c.client.id}`, `/api/plans/${plan.id}/stops`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ clientId: c.client.id }),
                            });
                            setCandidates((prev) => ({ ...prev, [plan.id]: prev[plan.id].filter((x) => x.client.id !== c.client.id) }));
                          }}
                        >
                          {personName(c.client)} · {c.distanzaKm} km
                        </button>
                      ))}
                    </div>
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
