"use client";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Stats {
  total_members: number;
  living_count: number;
  deceased_count: number;
  male_count: number;
  female_count: number;
  other_count: number;
  no_gender_count: number;
  male_living: number;
  male_deceased: number;
  female_living: number;
  female_deceased: number;
  other_living: number;
  other_deceased: number;
  average_age_male: number | null;
  average_age_female: number | null;
  average_age_at_death_male: number | null;
  average_age_at_death_female: number | null;
  oldest_male:   { name: string; age: number; birth_date: string } | null;
  oldest_female: { name: string; age: number; birth_date: string } | null;
  most_common_first_name_male: string | null;
  most_common_first_name_female: string | null;
  total_unions: number;
  couple_count: number;
  ex_couple_count: number;
  marriage_count: number;
  divorce_count: number;
  oldest_member:   { name: string; age: number; birth_date: string } | null;
  youngest_member: { name: string; age: number; birth_date: string } | null;
  average_age: number | null;
  average_age_at_death: number | null;
  most_common_first_name: string | null;
  last_names_top5: { name: string; count: number }[];
  birth_decades: { decade: number; count: number }[];
}

export default function StatsPage() {
  return <Suspense><StatsPageContent /></Suspense>;
}

function StatsPageContent() {
  const searchParams = useSearchParams();
  const treeId = searchParams.get("treeId");

  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError]  = useState<string | null>(null);

  useEffect(() => {
    if (!treeId) return;
    fetch(`/api/stats?treeId=${treeId}`).then(r => r.json()).then(setStats).catch(() => setError("Impossible de charger"));
  }, [treeId]);

  if (!treeId) {
    return (
      <main className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-6 text-center px-4">
        <div>
          <p className="text-xl font-bold text-zinc-800 mb-2">Aucun arbre sélectionné</p>
          <p className="text-zinc-400 text-sm">Choisissez un arbre depuis votre tableau de bord.</p>
        </div>
        <a href="/dashboard" className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:opacity-90">
          Aller au dashboard
        </a>
      </main>
    );
  }

  if (error) return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <p className="text-red-600 bg-red-50 px-6 py-3 rounded-xl border border-red-100">{error}</p>
    </main>
  );

  if (!stats) return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-zinc-400 text-sm">Calcul des statistiques…</p>
      </div>
    </main>
  );

  const total = stats.total_members;
  const genreTotal = stats.male_count + stats.female_count + stats.other_count;
  const maxDecade = Math.max(...stats.birth_decades.map(d => d.count), 1);
  const maxName   = Math.max(...stats.last_names_top5.map(n => n.count), 1);

  // Conic gradient pour le pie chart genre
  let conicGrad = "";
  if (genreTotal > 0) {
    const mDeg = (stats.male_count   / genreTotal) * 360;
    const fDeg = (stats.female_count / genreTotal) * 360;
    const oDeg = (stats.other_count  / genreTotal) * 360;
    const parts: string[] = [];
    let cur = 0;
    if (mDeg > 0) { parts.push(`#60a5fa ${cur}deg ${cur + mDeg}deg`); cur += mDeg; }
    if (fDeg > 0) { parts.push(`#f472b6 ${cur}deg ${cur + fDeg}deg`); cur += fDeg; }
    if (oDeg > 0) { parts.push(`#a78bfa ${cur}deg ${cur + oDeg}deg`); cur += oDeg; }
    conicGrad = `conic-gradient(${parts.join(", ")})`;
  }

  const livingPct = total > 0 ? Math.round((stats.living_count / total) * 100) : 0;
  const deceasedPct = 100 - livingPct;

  const unionTypes = [
    { label: "Couples",    picto: "♥",   count: stats.couple_count,    color: "bg-pink-500"   },
    { label: "Mariés",     picto: "💍",  count: stats.marriage_count,   color: "bg-amber-500"  },
    { label: "Ex-couples", picto: "💔",  count: stats.ex_couple_count,  color: "bg-zinc-400"   },
    { label: "Divorcés",   picto: "✗",   count: stats.divorce_count,    color: "bg-zinc-600"   },
  ].filter(u => u.count > 0);

  return (
    <main className="min-h-screen bg-zinc-50">

      {/* ── En-tête ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-zinc-100 px-4 py-6 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Statistiques</h1>
          <p className="text-sm text-zinc-400 mt-1">Analyse de votre arbre généalogique</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── KPI Cards dark premium ─────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total membres",  value: total,                grad: "from-slate-900 to-indigo-900",  accent: "text-indigo-300",  sub: "text-indigo-400/60" },
            { label: "Vivants",        value: stats.living_count,   grad: "from-slate-900 to-emerald-900", accent: "text-emerald-300", sub: "text-emerald-400/60" },
            { label: "Décédés",        value: stats.deceased_count, grad: "from-slate-900 to-slate-800",   accent: "text-slate-300",   sub: "text-slate-400/60" },
            { label: "Unions",         value: stats.total_unions,   grad: "from-slate-900 to-pink-900",    accent: "text-pink-300",    sub: "text-pink-400/60" },
          ].map(({ label, value, grad, accent, sub }) => (
            <div key={label} className={`bg-gradient-to-br ${grad} rounded-2xl p-5 shadow-xl border border-white/5`}>
              <p className={`text-5xl font-black ${accent} leading-none`}>{value}</p>
              <p className={`text-xs uppercase tracking-widest font-semibold mt-2 ${sub}`}>{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* ── Pie chart genre CSS ─────────────────────────────── */}
          {genreTotal > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm space-y-4">
              <h2 className="font-black text-zinc-900">Répartition par genre</h2>
              <div className="flex items-center gap-6">
                {/* Pie chart */}
                <div
                  className="w-24 h-24 rounded-full shrink-0 shadow-lg"
                  style={{ background: conicGrad }}
                />
                {/* Légende */}
                <div className="space-y-2">
                  {[
                    { label: "Hommes", count: stats.male_count,   pct: Math.round((stats.male_count   / genreTotal) * 100), color: "bg-blue-400",   text: "text-blue-600"   },
                    { label: "Femmes", count: stats.female_count, pct: Math.round((stats.female_count / genreTotal) * 100), color: "bg-pink-400",   text: "text-pink-600"   },
                    { label: "Autres", count: stats.other_count,  pct: Math.round((stats.other_count  / genreTotal) * 100), color: "bg-purple-400", text: "text-purple-600" },
                  ].filter(g => g.count > 0).map(g => (
                    <div key={g.label} className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${g.color} shrink-0`} />
                      <span className="text-sm text-zinc-500">{g.label}</span>
                      <span className={`font-black text-sm ${g.text}`}>{g.count}</span>
                      <span className="text-xs text-zinc-300">{g.pct}%</span>
                    </div>
                  ))}
                  {stats.no_gender_count > 0 && (
                    <p className="text-xs text-zinc-400">{stats.no_gender_count} sans genre</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Âges ───────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm space-y-3">
            <h2 className="font-black text-zinc-900">Âges</h2>
            <div className="space-y-2">
              {[
                { label: "Âge moyen (vivants)",   value: stats.average_age         != null ? `${stats.average_age} ans`         : "—" },
                { label: "Âge moyen au décès",    value: stats.average_age_at_death != null ? `${stats.average_age_at_death} ans` : "—" },
                { label: "Plus âgé",              value: stats.oldest_member        ? `${stats.oldest_member.name} · ${stats.oldest_member.age} ans`   : "—" },
                { label: "Plus jeune",            value: stats.youngest_member      ? `${stats.youngest_member.name} · ${stats.youngest_member.age} ans` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start gap-2 py-1.5 border-b border-zinc-50 last:border-0">
                  <span className="text-xs text-zinc-400 font-medium">{label}</span>
                  <span className="text-sm font-black text-zinc-900 text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Vivants vs Décédés — split bar ──────────────────── */}
        {total > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm space-y-4">
            <h2 className="font-black text-zinc-900">Vivants vs Décédés</h2>
            <div className="h-8 rounded-full flex overflow-hidden shadow-inner">
              {stats.living_count > 0 && (
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full flex items-center justify-center transition-all"
                  style={{ width: `${livingPct}%` }}
                >
                  <span className="text-xs text-white font-black px-1">{livingPct}%</span>
                </div>
              )}
              {stats.deceased_count > 0 && (
                <div
                  className="bg-gradient-to-r from-zinc-300 to-zinc-200 h-full flex items-center justify-center flex-1 transition-all"
                >
                  <span className="text-xs text-zinc-600 font-black px-1">{deceasedPct}%</span>
                </div>
              )}
            </div>
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                <span className="text-zinc-500">Vivants</span>
                <span className="font-black text-emerald-600">{stats.living_count}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-zinc-300 inline-block" />
                <span className="text-zinc-500">Décédés</span>
                <span className="font-black text-zinc-600">{stats.deceased_count}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── H vs F — colonnes colorées ──────────────────────── */}
        {(stats.male_count > 0 || stats.female_count > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                label: "Hommes", count: stats.male_count,
                living: stats.male_living, deceased: stats.male_deceased,
                avgAge: stats.average_age_male, avgDeath: stats.average_age_at_death_male,
                oldest: stats.oldest_male, firstName: stats.most_common_first_name_male,
                bg: "bg-blue-50", bigText: "text-blue-600", labelCls: "text-blue-400", dot: "bg-blue-400",
              },
              {
                label: "Femmes", count: stats.female_count,
                living: stats.female_living, deceased: stats.female_deceased,
                avgAge: stats.average_age_female, avgDeath: stats.average_age_at_death_female,
                oldest: stats.oldest_female, firstName: stats.most_common_first_name_female,
                bg: "bg-pink-50", bigText: "text-pink-600", labelCls: "text-pink-400", dot: "bg-pink-400",
              },
            ].filter(g => g.count > 0).map(g => (
              <div key={g.label} className={`${g.bg} rounded-3xl p-6 border border-white shadow-sm space-y-4`}>
                <div>
                  <p className={`text-xs uppercase tracking-widest font-semibold ${g.labelCls}`}>{g.label}</p>
                  <p className={`text-5xl font-black ${g.bigText} leading-none mt-1`}>{g.count}</p>
                </div>
                <div className="space-y-2 pt-2 border-t border-black/5">
                  {[
                    { label: "Vivants",             value: g.living   },
                    { label: "Décédés",             value: g.deceased },
                    { label: "Âge moyen (vivants)", value: g.avgAge   != null ? `${g.avgAge} ans` : "—" },
                    { label: "Âge moyen au décès",  value: g.avgDeath != null ? `${g.avgDeath} ans` : "—" },
                    { label: "Plus âgé·e",          value: g.oldest   ? `${g.oldest.name} (${g.oldest.age} ans)` : "—" },
                    { label: "Prénom courant",       value: g.firstName ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center gap-2">
                      <span className="text-xs text-zinc-400 font-medium">{label}</span>
                      <span className="text-xs font-black text-zinc-800 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* ── Bar chart naissances par décennie ──────────────── */}
          {stats.birth_decades.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm">
              <h2 className="font-black text-zinc-900 mb-5">Naissances par décennie</h2>
              <div className="flex items-end gap-1.5 h-32">
                {stats.birth_decades.map(({ decade, count }) => {
                  const heightPct = Math.round((count / maxDecade) * 100);
                  return (
                    <div key={decade} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <span className="text-xs font-black text-zinc-600 leading-none">{count}</span>
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-indigo-600 to-violet-400 transition-all min-h-[4px] shadow-sm"
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="text-[10px] text-zinc-400 font-medium truncate w-full text-center">{decade}s</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Barres horizontales noms de famille ────────────── */}
          {stats.last_names_top5.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm">
              <h2 className="font-black text-zinc-900 mb-1">Top noms de famille</h2>
              {stats.most_common_first_name && (
                <p className="text-xs text-zinc-400 mb-4">Prénom le + courant : <strong className="text-zinc-700">{stats.most_common_first_name}</strong></p>
              )}
              <div className="space-y-3">
                {stats.last_names_top5.map(({ name, count }, i) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-xs font-black text-zinc-300 w-4">{i + 1}</span>
                    <span className="text-sm font-bold text-zinc-900 w-20 truncate shrink-0">{name}</span>
                    <div className="flex-1 h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all"
                        style={{ width: `${(count / maxName) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-zinc-600 w-5 text-right shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Unions ───────────────────────────────────────────── */}
        {stats.total_unions > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm">
            <h2 className="font-black text-zinc-900 mb-4">Types d&apos;unions</h2>
            <div className="flex flex-wrap gap-3">
              {unionTypes.map(({ label, picto, count, color }) => (
                <div key={label} className="flex items-center gap-3 bg-zinc-50 border border-zinc-100 rounded-2xl px-5 py-3 hover:-translate-y-0.5 hover:shadow-md transition-all">
                  <span className="text-2xl">{picto}</span>
                  <div>
                    <p className="font-black text-zinc-900 text-2xl leading-none">{count}</p>
                    <p className="text-xs text-zinc-400 font-medium mt-0.5">{label}</p>
                  </div>
                  <div className={`w-1.5 h-10 rounded-full ${color} ml-1`} />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
