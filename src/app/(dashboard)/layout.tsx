import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/ui/LogoutButton";
import { NavLinks } from "@/components/ui/NavLinks";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <nav className="bg-slate-950 border-b border-white/[0.06] sticky top-0 z-50 shadow-xl shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 mr-4 group" aria-label="Accueil GeneaSphere">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white font-black text-sm select-none shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">G</div>
            <span className="font-bold text-white tracking-tight hidden sm:block">GeneaSphere</span>
          </Link>
          <Suspense fallback={<div className="flex gap-1 h-8" />}>
            <NavLinks />
          </Suspense>
          <div className="ml-auto flex items-center">
            <LogoutButton />
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
