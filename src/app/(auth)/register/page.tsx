import { RegisterForm } from "@/components/forms/RegisterForm";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="text-4xl">🌳</span>
            <span className="text-3xl font-bold text-white tracking-tight">GeneaSphere</span>
          </div>
          <p className="text-slate-400">Commencez à construire votre arbre</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-white mb-6">Créer un compte</h1>
          <RegisterForm />
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
