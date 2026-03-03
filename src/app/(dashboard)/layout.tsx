import Link from "next/link";
import { LogoutButton } from "@/components/ui/LogoutButton";
import { NavLinks } from "@/components/ui/NavLinks";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-slate-900 border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 mr-2">
            <span className="text-xl">🌳</span>
            <span className="font-bold text-white tracking-tight hidden sm:block">GeneaSphere</span>
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center">
            <LogoutButton />
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
