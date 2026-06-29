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
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#060d18]">
      {/* Hero — immagine intera, senza crop */}
      <div className="relative flex items-center justify-center px-4 py-8 sm:px-8 sm:py-10 lg:flex-1 lg:min-h-screen lg:px-10 xl:px-14">
        <div className="relative w-full max-w-[640px] lg:max-w-[720px] xl:max-w-[780px]">
          <Image
            src="/images/login-hero.png"
            alt="Planner Tropini — ottimizzazione percorsi"
            width={1536}
            height={1024}
            priority
            className="w-full h-auto"
            sizes="(max-width: 1024px) 90vw, 45vw"
          />
        </div>
        {/* Sfumatura solo sul bordo destro verso il form */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden lg:block w-32 xl:w-48 bg-gradient-to-l from-[#060d18] to-transparent"
          aria-hidden
        />
      </div>

      {/* Pannello login */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-12 lg:max-w-[480px] xl:max-w-[520px] shrink-0">
        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white lg:text-[1.65rem]">Accedi</h1>
            <p className="text-slate-400 mt-1.5 text-sm">
              Inserisci le credenziali per entrare in Planner Tropini
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm shadow-2xl shadow-black/40 overflow-hidden"
          >
            <div className="p-6 sm:p-8 space-y-5">
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-slate-300 mb-1.5"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/60 focus:border-cyan-500/40 transition-all"
                  placeholder="Il tuo username"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-300 mb-1.5"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/60 focus:border-cyan-500/40 transition-all"
                  placeholder="La tua password"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-300 bg-red-950/50 border border-red-800/60 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}
            </div>

            <div className="border-t border-slate-800 bg-slate-950/40 px-6 sm:px-8 py-5 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-semibold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-cyan-500/20"
                >
                  <Lock size={16} />
                  {loading ? "Accesso…" : "Accedi"}
                  {!loading && <ArrowRight size={16} className="opacity-70" />}
                </button>
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 border border-slate-600 hover:border-cyan-500/50 hover:bg-cyan-500/5 disabled:opacity-60 text-slate-200 font-medium py-3 px-4 rounded-xl transition-all"
                >
                  <Sparkles size={16} className="text-cyan-400" />
                  Prova demo
                </button>
              </div>
              <p className="text-center text-xs text-slate-500">
                Demo:{" "}
                <span className="font-mono text-slate-400">demo</span>
                {" · "}
                <span className="font-mono text-slate-400">demo1234!</span>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
