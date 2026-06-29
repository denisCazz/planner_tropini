"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Sparkles, ArrowRight } from "lucide-react";

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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#040810]">
      <Image
        src="/images/login-hero.png"
        alt=""
        fill
        priority
        className="object-cover object-center scale-105"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-[#040810]/75 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#040810]/30 to-[#040810]/90" />

      <div className="relative z-10 w-full max-w-md mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Planner</h1>
          <p className="text-slate-400 text-sm mt-2">Accedi al tuo spazio di lavoro</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden"
        >
          <div className="p-6 sm:p-8 space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-700/80 bg-slate-950/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                placeholder="Il tuo username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-700/80 bg-slate-950/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                placeholder="La tua password"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
          </div>

          <div className="border-t border-white/10 bg-slate-950/40 px-6 sm:px-8 py-5 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-semibold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-cyan-500/25"
              >
                <Lock size={16} />
                {loading ? "Accesso…" : "Accedi"}
                {!loading && <ArrowRight size={16} className="opacity-70" />}
              </button>
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 border border-slate-600 hover:border-cyan-400/50 hover:bg-cyan-500/10 disabled:opacity-60 text-slate-200 font-medium py-3 px-4 rounded-xl transition-all"
              >
                <Sparkles size={16} className="text-cyan-400" />
                Prova demo
              </button>
            </div>
            <p className="text-center text-xs text-slate-500">
              Demo: <span className="font-mono text-slate-400">demo</span>
              {" · "}
              <span className="font-mono text-slate-400">demo1234!</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
