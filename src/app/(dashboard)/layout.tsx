import Link from "next/link";
import { LogoutButton } from "@/components/ui/LogoutButton";

const navLinks = [
  { href: "/tree",      label: "Arbre" },
  { href: "/members",   label: "Membres" },
  { href: "/relations", label: "Relations" },
  { href: "/stats",     label: "Statistiques" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barre de navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          <Link href="/dashboard" className="font-bold text-blue-600 text-lg tracking-tight">
            GeneaSphere
          </Link>
          <div className="flex gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="ml-auto">
            <LogoutButton />
          </div>
        </div>
      </nav>

      {children}
    </div>
  );
}
