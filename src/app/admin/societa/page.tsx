"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  isDemo: boolean;
  clientCount: number;
  userCount: number;
  createdAt: string;
};

export default function AdminSocietaPage() {
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/organizations");
      if (!res.ok) throw new Error("Errore caricamento");
      setOrgs(await res.json());
    } catch {
      toast.error("Impossibile caricare le società");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) {
          window.location.href = "/mappa";
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data && data.role !== "ADMIN") {
          window.location.href = "/mappa";
        }
      })
      .catch(() => {});
    void load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore creazione");
      toast.success(`Società "${name}" creata`);
      setName("");
      setUsername("");
      setPassword("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, orgName: string) {
    if (!confirm(`Eliminare la società "${orgName}" e tutti i suoi dati?`)) return;
    try {
      const res = await fetch(`/api/admin/organizations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore eliminazione");
      toast.success("Società eliminata");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 size={24} className="text-indigo-600" />
          Gestione società
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Ogni società ha dati isolati: clienti, impostazioni e percorsi salvati sul database.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm space-y-4"
      >
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Plus size={18} />
          Nuova società
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome società *"
            required
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username operatore (opz.)"
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password operatore (opz.)"
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Crea società
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {orgs.map((org) => (
            <div
              key={org.id}
              className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 flex items-center gap-2">
                  {org.name}
                  {org.isDemo && (
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      Demo
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                  <span className="font-mono">{org.slug}</span>
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {org.userCount} utenti
                  </span>
                  <span>{org.clientCount} clienti</span>
                </div>
              </div>
              {!org.isDemo && (
                <button
                  type="button"
                  onClick={() => void handleDelete(org.id, org.name)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  title="Elimina società"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
