"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, User, Eye, EyeOff, ArrowRight } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

function PasswordInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Lock
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="auth-input auth-input--icon-both"
          placeholder="••••••••"
          required
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
          aria-label={visible ? "Nascondi password" : "Mostra password"}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const from = searchParams.get("from") || "/dashboard";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Accesso riservato a Tropini Service");
        return;
      }
      router.replace(from.startsWith("/") ? from : "/dashboard");
      router.refresh();
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo className="h-14 w-auto" />
          <p className="text-sm text-slate-500 mt-3">Accesso riservato al personale Tropini Service</p>
        </div>

        <h1 className="text-xl font-semibold text-slate-900 mb-1">Accedi</h1>
        <p className="text-sm text-slate-500 mb-5">Usa le credenziali interne. La registrazione è disabilitata.</p>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="auth-input auth-input--icon-left"
                required
              />
            </div>
          </div>

          <PasswordInput id="password" label="Password" value={password} onChange={setPassword} />

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl"
          >
            {loading ? "Accesso…" : "Accedi"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
