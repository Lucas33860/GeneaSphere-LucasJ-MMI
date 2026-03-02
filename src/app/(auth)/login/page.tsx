import { LoginForm } from "@/components/forms/LoginForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="text-4xl">🌳</span>
            <span className="text-3xl font-bold text-white tracking-tight">GeneaSphere</span>
          </div>
          <p className="text-slate-400">Votre arbre généalogique en 3D</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-white mb-6">Connexion</h1>
          <LoginForm />
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Pas encore de compte ?{" "}
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
            S&apos;inscrire
          </Link>
        </p>
      </div>
    </main>
  );
}
