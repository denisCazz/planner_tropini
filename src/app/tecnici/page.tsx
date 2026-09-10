"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import PageHeader from "@/components/ui/PageHeader";
import { ROLE_LABEL, technicianDisplayName, type SessionRole } from "@/lib/roles";
import type { OrgUser } from "@/types/client";

export default function TecniciPage() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [form, setForm] = useState({
    username: "",
    password: "",
    nome: "",
    cognome: "",
    telefono: "",
    role: "TECNICO" as SessionRole,
  });
  const [me, setMe] = useState<{ role: SessionRole } | null>(null);

  function load() {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  }

  useEffect(() => {
    load();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error((err as { error?: string }).error ?? "Errore");
      return;
    }
    toast.success("Utente creato");
    setForm({ username: "", password: "", nome: "", cognome: "", telefono: "", role: "TECNICO" });
    load();
  }

  async function toggleAttivo(u: OrgUser) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attivo: !(u.attivo ?? true) }),
    });
    if (!res.ok) {
      toast.error("Operazione non consentita");
      return;
    }
    load();
  }

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <PageHeader title="Tecnici" subtitle="Anagrafica operatori e tecnici associabili a interventi e appuntamenti" />

      <div className="card overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">Nome</th>
              <th className="text-left px-4 py-2">Ruolo</th>
              <th className="text-left px-4 py-2">Telefono</th>
              <th className="text-left px-4 py-2">Stato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{technicianDisplayName(u)}</div>
                  <div className="text-xs text-slate-400">{u.username}</div>
                </td>
                <td className="px-4 py-2.5">{ROLE_LABEL[u.role]}</td>
                <td className="px-4 py-2.5">{u.telefono ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <button type="button" className="text-xs font-medium" onClick={() => void toggleAttivo(u)}>
                    {(u.attivo ?? true) ? "Attivo" : "Non attivo"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {me?.role === "ADMIN" && (
        <form onSubmit={create} className="card p-4 grid grid-cols-2 gap-3 max-w-xl">
          <h2 className="col-span-2 font-semibold text-sm">Nuovo utente</h2>
          <input className="field" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          <input className="field" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <input className="field" placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input className="field" placeholder="Cognome" value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} />
          <input className="field" placeholder="Telefono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as SessionRole })}>
            <option value="TECNICO">Tecnico</option>
            <option value="USER">Operatore</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button className="btn btn-primary col-span-2">Crea</button>
        </form>
      )}
    </div>
  );
}
