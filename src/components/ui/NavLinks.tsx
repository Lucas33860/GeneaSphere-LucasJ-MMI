"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const navLinks = [
  { href: "/tree",      label: "Arbre 3D",    icon: "🌳" },
  { href: "/members",   label: "Membres",     icon: "👥" },
  { href: "/relations", label: "Relations",   icon: "💞" },
  { href: "/stats",     label: "Stats",       icon: "📊" },
];

export function NavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const treeId = searchParams.get("treeId");

  return (
    <div className="flex gap-1">
      {navLinks.map(({ href, label, icon }) => {
        const active = pathname.startsWith(href);
        const fullHref = treeId ? `${href}?treeId=${treeId}` : href;
        return (
          <Link key={href} href={fullHref}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              active
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="hidden sm:inline">{icon}</span>
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
