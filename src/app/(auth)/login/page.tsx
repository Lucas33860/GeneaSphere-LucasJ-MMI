import { LoginForm } from "@/components/forms/LoginForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center px-4">

      {/* Orbs décoratifs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white font-black text-base shadow-lg shadow-indigo-500/30">G</div>
            <span className="text-2xl font-black text-white tracking-tight">GeneaSphere</span>
          </div>
          <p className="text-slate-400 text-sm">Votre arbre généalogique en 3D</p>
        </div>

        {/* Card glassmorphism */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <h1 className="text-lg font-bold text-white mb-6">Connexion</h1>
          <LoginForm />
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Pas encore de compte ?{" "}
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
            S&apos;inscrire
          </Link>
        </p>
      </div>
    </main>
  );
}
