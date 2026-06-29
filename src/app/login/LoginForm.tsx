"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Map, Lock, Route, Users, Sparkles } from "lucide-react";

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
    setUsername(DEMO_USERNAME);
    setPassword(DEMO_PASSWORD);
    void login(DEMO_USERNAME, DEMO_PASSWORD);
  }

  return (
    <div className="min-h-screen flex">
      {/* Pannello branding — desktop */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-indigo-400/20 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div>
            <div className="inline-flex w-12 h-12 rounded-xl bg-white/10 backdrop-blur items-center justify-center mb-8">
              <Map size={24} className="text-white" />
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white tracking-tight leading-tight">
              Planner
              <br />
              Tropini
            </h1>
            <p className="text-indigo-200 text-lg mt-4 max-w-sm leading-relaxed">
              CRM per agenti di commercio: clienti, mappa e percorsi ottimizzati in un unico strumento.
            </p>
          </div>

          <ul className="space-y-5 mt-12">
            {[
              { icon: Users, text: "Gestisci clienti e visite sul territorio" },
              { icon: Map, text: "Visualizza tutto su mappa interattiva" },
              { icon: Route, text: "Calcola percorsi ottimizzati in un click" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-indigo-100">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 shrink-0">
                  <Icon size={18} className="text-white" />
                </span>
                <span className="text-sm leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form login */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-indigo-600 items-center justify-center shadow-lg shadow-indigo-600/30 mb-4">
              <Map size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Planner Tropini</h1>
            <p className="text-slate-500 text-sm mt-1">Accedi al tuo account</p>
          </div>

          <div className="lg:mb-8">
            <h2 className="hidden lg:block text-2xl font-bold text-slate-900">Bentornato</h2>
            <p className="hidden lg:block text-slate-500 mt-1">Inserisci le tue credenziali per accedere</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-5"
          >
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-colors"
                placeholder="Il tuo username"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-colors"
                placeholder="La tua password"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm shadow-indigo-600/20"
            >
              <Lock size={16} />
              {loading ? "Accesso in corso…" : "Accedi"}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-400">oppure</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 disabled:opacity-60 text-amber-800 font-medium py-3 rounded-xl transition-colors"
            >
              <Sparkles size={16} />
              Prova la demo
            </button>
            <p className="text-center text-xs text-slate-400">
              Account demo: <span className="font-mono text-slate-500">demo</span> /{" "}
              <span className="font-mono text-slate-500">demo1234!</span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
