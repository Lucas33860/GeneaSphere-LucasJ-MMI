"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const navLinks = [
  { href: "/tree",      label: "Arbre 3D"   },
  { href: "/members",   label: "Membres"    },
  { href: "/relations", label: "Relations"  },
  { href: "/stats",     label: "Stats"      },
];

export function NavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const treeId = searchParams.get("treeId");

  return (
    <nav className="flex gap-1" aria-label="Navigation principale">
      {navLinks.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        const fullHref = treeId ? `${href}?treeId=${treeId}` : href;
        return (
          <Link key={href} href={fullHref}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 focus:ring-offset-slate-900 ${
              active
                ? "bg-indigo-600 text-white"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
