import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full flex items-center justify-center bg-slate-900 text-slate-400">
          Caricamento…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
