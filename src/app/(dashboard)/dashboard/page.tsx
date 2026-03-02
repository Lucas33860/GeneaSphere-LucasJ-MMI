import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const quickLinks = [
  { href: "/tree",      icon: "🌳", title: "Arbre 3D",    desc: "Visualisez votre arbre interactif en 3D",    color: "from-indigo-500 to-purple-600" },
  { href: "/members",   icon: "👥", title: "Membres",      desc: "Ajoutez et gérez les membres de la famille", color: "from-blue-500 to-cyan-600"    },
  { href: "/relations", icon: "💞", title: "Relations",    desc: "Unions, mariages et liens de parenté",       color: "from-pink-500 to-rose-600"    },
  { href: "/stats",     icon: "📊", title: "Statistiques", desc: "Explorez les données de votre famille",     color: "from-emerald-500 to-teal-600" },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("full_name, is_admin").eq("id", user.id).single();

  if (profile?.is_admin) redirect("/admin");

  const name = profile?.full_name ?? user.email?.split("@")[0] ?? "vous";

  const [{ count: membersCount }, { count: unionsCount }, { data: recentMembers }] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }),
    supabase.from("spouses").select("id",  { count: "exact", head: true }),
    supabase.from("members").select("first_name, last_name, photo_url").order("created_at", { ascending: false }).limit(5),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 18 ? "Bonjour" : "Bonsoir";

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ── Hero ───────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-indigo-300 text-sm font-medium tracking-widest uppercase mb-3">{greeting} 👋</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white">{name}</h1>
          <p className="text-slate-400 text-lg mt-3">Votre espace généalogique personnel</p>

          <div className="flex gap-12 justify-center mt-10">
            <div className="text-center">
              <p className="text-4xl font-bold text-white">{membersCount ?? 0}</p>
              <p className="text-slate-400 text-sm mt-1">membre{(membersCount ?? 0) > 1 ? "s" : ""}</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <p className="text-4xl font-bold text-white">{unionsCount ?? 0}</p>
              <p className="text-slate-400 text-sm mt-1">union{(unionsCount ?? 0) > 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">

        {/* ── Accès rapide ───────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Accès rapide</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quickLinks.map(({ href, icon, title, desc, color }) => (
              <Link key={href} href={href}
                className="group bg-white rounded-2xl p-5 border border-slate-100 hover:border-indigo-200 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-2xl shrink-0 shadow-sm`}>
                    {icon}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{title}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{desc}</p>
                  </div>
                  <span className="ml-auto text-slate-300 group-hover:text-indigo-400 transition-colors text-lg">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Membres récents ────────────────────────────── */}
        {(recentMembers ?? []).length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Derniers ajouts</h2>
              <Link href="/members" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">Voir tous →</Link>
            </div>
            <div className="flex gap-3 flex-wrap">
              {(recentMembers ?? []).map((m, i) => (
                <div key={i} className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-3 py-2 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 overflow-hidden shrink-0">
                    {m.photo_url
                      ? <img src={m.photo_url} className="w-full h-full object-cover" alt="" />
                      : <>{m.first_name[0]}{m.last_name[0]}</>}
                  </div>
                  <span className="text-sm font-medium text-slate-700">{m.first_name} {m.last_name}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
