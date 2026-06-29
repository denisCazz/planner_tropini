"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Map, Lock, Sparkles, Navigation, Users, Route } from "lucide-react";

const DEMO_USERNAME = "demo";
const DEMO_PASSWORD = "demo1234!";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const from = searchParams.get("from") || "/mappa";

  async function login(user: string, pass: string) {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Accesso non riuscito");
        return;
      }

      router.replace(from.startsWith("/") ? from : "/mappa");
      router.refresh();
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void login(username, password);
  }

  function handleDemoLogin() {
    void login(DEMO_USERNAME, DEMO_PASSWORD);
  }

  return (
    <div className="min-h-screen flex">
      {/* Pannello brand — desktop */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[48%] bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-transparent to-slate-900" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/50">
              <Map size={22} className="text-white" />
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">Planner</span>
          </div>

          <div>
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
              CRM per agenti
              <br />
              sul territorio
            </h1>
            <ul className="mt-10 space-y-4">
              {[
                { icon: Users, text: "Gestisci clienti e visite" },
                { icon: Map, text: "Mappa interattiva con filtri" },
                { icon: Route, text: "Percorsi ottimizzati" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-slate-300">
                  <span className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <Icon size={17} className="text-indigo-300" />
                  </span>
                  <span className="text-sm">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-slate-500 text-xs">
            Ogni società ha dati isolati e salvati sul database.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-slate-50">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Map size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Planner</h1>
              <p className="text-slate-500 text-sm">Accedi al tuo account</p>
            </div>
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Accedi</h2>
            <p className="text-slate-500 text-sm mt-1">
              Inserisci le credenziali della tua società
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5"
          >
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                placeholder="es. tropini"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              <Lock size={16} />
              {loading ? "Accesso in corso…" : "Accedi"}
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-slate-400">oppure</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50 disabled:opacity-60 text-slate-700 font-medium py-2.5 rounded-xl transition-all text-sm"
            >
              <Sparkles size={15} className="text-indigo-500" />
              Prova la demo
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-5">
            Demo: <span className="font-mono text-slate-500">demo</span> /{" "}
            <span className="font-mono text-slate-500">demo1234!</span>
          </p>
        </div>
      </div>
    </div>
  );
}
