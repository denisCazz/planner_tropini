"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, Loader2, Plus, Trash2, Users, UserPlus } from "lucide-react";
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

type UserRow = {
  id: string;
  username: string;
  role: "ADMIN" | "USER";
  organizationId: string | null;
  organizationName: string | null;
};

export default function AdminSocietaPage() {
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  const [name, setName] = useState("");
  const [orgUsername, setOrgUsername] = useState("");
  const [orgPassword, setOrgPassword] = useState("");

  const [userOrgId, setUserOrgId] = useState("");
  const [userUsername, setUserUsername] = useState("");
  const [userPassword, setUserPassword] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [orgsRes, usersRes] = await Promise.all([
        fetch("/api/admin/organizations"),
        fetch("/api/admin/users"),
      ]);
      if (!orgsRes.ok || !usersRes.ok) throw new Error("Errore caricamento");
      const orgList = await orgsRes.json();
      setOrgs(orgList);
      setUsers(await usersRes.json());
      if (!userOrgId && orgList.length > 0) {
        const tropini = orgList.find((o: OrganizationRow) => o.slug === "tropini");
        setUserOrgId(tropini?.id ?? orgList[0].id);
      }
    } catch {
      toast.error("Impossibile caricare i dati");
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

  async function handleCreateOrg(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username: orgUsername, password: orgPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore creazione");
      toast.success(`Società "${name}" creata`);
      setName("");
      setOrgUsername("");
      setOrgPassword("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: userOrgId,
          username: userUsername,
          password: userPassword,
          role: "USER",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore creazione utente");
      toast.success(`Utente "${userUsername}" creato`);
      setUserUsername("");
      setUserPassword("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setCreatingUser(false);
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
    <div className="max-w-4xl mx-auto p-6 sm:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 size={24} className="text-indigo-600" />
          Amministrazione
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Gestisci società e utenti. Ogni utente accede solo ai dati della propria società.
        </p>
      </div>

      {/* Utenti — qui si crea l'utenza Tropini */}
      <form
        onSubmit={handleCreateUser}
        className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm space-y-4 ring-1 ring-indigo-50"
      >
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <UserPlus size={18} className="text-indigo-600" />
          Nuovo utente
        </h2>
        <p className="text-xs text-slate-500 -mt-2">
          Per creare l&apos;utenza Tropini: seleziona società <strong>Tropini</strong>, username e password.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <select
            value={userOrgId}
            onChange={(e) => setUserOrgId(e.target.value)}
            required
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <input
            value={userUsername}
            onChange={(e) => setUserUsername(e.target.value)}
            placeholder="Username *"
            required
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
          />
          <input
            value={userPassword}
            onChange={(e) => setUserPassword(e.target.value)}
            type="password"
            placeholder="Password * (min 6 car.)"
            required
            minLength={6}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={creatingUser}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
        >
          {creatingUser ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          Crea utente
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
        </div>
      ) : (
        <>
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Users size={16} />
              Utenti ({users.length})
            </h2>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
              {users.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">Nessun utente. Esegui il seed o creane uno sopra.</p>
              ) : (
                users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="font-mono font-medium text-slate-900">{u.username}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">{u.organizationName ?? "—"}</span>
                    {u.role === "ADMIN" && (
                      <span className="text-[10px] font-bold uppercase bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full ml-auto">
                        Admin
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Building2 size={16} />
              Società ({orgs.length})
            </h2>
            <form
              onSubmit={handleCreateOrg}
              className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 shadow-sm space-y-3"
            >
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome nuova società *"
                  className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
                <input
                  value={orgUsername}
                  onChange={(e) => setOrgUsername(e.target.value)}
                  placeholder="Username (opz.)"
                  className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
                <input
                  value={orgPassword}
                  onChange={(e) => setOrgPassword(e.target.value)}
                  type="password"
                  placeholder="Password (opz.)"
                  className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="inline-flex items-center gap-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-sm font-medium px-4 py-2 rounded-xl"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Crea società
              </button>
            </form>

            <div className="space-y-2">
              {orgs.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 flex items-center gap-2 text-sm">
                      {org.name}
                      {org.isDemo && (
                        <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          Demo
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {org.userCount} utenti · {org.clientCount} clienti
                    </div>
                  </div>
                  {!org.isDemo && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(org.id, org.name)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Elimina società"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
