"use client";
import { useEffect, useState } from "react";

interface Stats {
  total_members: number;
  living_count: number;
  deceased_count: number;
  male_count: number;
  female_count: number;
  other_count: number;
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError]  = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(setStats).catch(() => setError("Impossible de charger"));
  }, []);

  if (error) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-red-500 bg-red-50 px-6 py-3 rounded-xl">{error}</p>
    </main>
  );

  if (!stats) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 text-sm">Calcul des statistiques…</p>
      </div>
    </main>
  );

  const total = stats.total_members;
  const genreTotal = stats.male_count + stats.female_count + stats.other_count;
  const maxDecade = Math.max(...stats.birth_decades.map(d => d.count), 1);
  const maxName   = Math.max(...stats.last_names_top5.map(n => n.count), 1);

  const unionTypes = [
    { label: "Couples",    picto: "♥",   count: stats.couple_count,    color: "bg-pink-500"   },
    { label: "Mariés",     picto: "💍",  count: stats.marriage_count,   color: "bg-amber-500"  },
    { label: "Ex-couples", picto: "💔",  count: stats.ex_couple_count,  color: "bg-slate-400"  },
    { label: "Divorcés",   picto: "💍✗", count: stats.divorce_count,    color: "bg-slate-600"  },
  ].filter(u => u.count > 0);

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* ── Titre ────────────────────────────────────────── */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Statistiques familiales</h1>
          <p className="text-slate-400 mt-1">Analyse de votre arbre généalogique</p>
        </div>

        {/* ── Hero cards ───────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total membres",  value: total,               icon: "👥", color: "from-indigo-500 to-purple-600" },
            { label: "Vivants",        value: stats.living_count,  icon: "💚", color: "from-emerald-500 to-teal-600"  },
            { label: "Décédés",        value: stats.deceased_count, icon: "🕊️", color: "from-slate-500 to-slate-700"   },
            { label: "Unions",         value: stats.total_unions,  icon: "💞", color: "from-pink-500 to-rose-600"     },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${color} flex items-center justify-center text-xl mb-3`}>{icon}</div>
              <p className="text-3xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* ── Genre ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900">Répartition par genre</h2>
            {genreTotal > 0 ? (
              <>
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                  {stats.male_count > 0   && <div className="bg-blue-400  h-full transition-all" style={{ width: `${(stats.male_count   / genreTotal) * 100}%` }} />}
                  {stats.female_count > 0 && <div className="bg-pink-400  h-full transition-all" style={{ width: `${(stats.female_count / genreTotal) * 100}%` }} />}
                  {stats.other_count > 0  && <div className="bg-purple-400 h-full transition-all" style={{ width: `${(stats.other_count  / genreTotal) * 100}%` }} />}
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  {[
                    { label: "Hommes", count: stats.male_count,   dot: "bg-blue-400"   },
                    { label: "Femmes", count: stats.female_count, dot: "bg-pink-400"   },
                    { label: "Autres", count: stats.other_count,  dot: "bg-purple-400" },
                  ].filter(g => g.count > 0).map(g => (
                    <div key={g.label} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${g.dot}`} />
                      <span className="text-slate-500">{g.label}</span>
                      <span className="font-bold text-slate-900">{g.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-slate-400 text-sm">Aucune donnée de genre</p>}
          </div>

          {/* ── Ages ───────────────────────────────────────── */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
            <h2 className="font-bold text-slate-900">Âges</h2>
            <div className="space-y-2">
              {[
                { label: "Âge moyen (vivants)",   value: stats.average_age         != null ? `${stats.average_age} ans`         : "—" },
                { label: "Âge moyen au décès",    value: stats.average_age_at_death != null ? `${stats.average_age_at_death} ans` : "—" },
                { label: "Plus âgé",              value: stats.oldest_member        ? `${stats.oldest_member.name} · ${stats.oldest_member.age} ans`   : "—" },
                { label: "Plus jeune",            value: stats.youngest_member      ? `${stats.youngest_member.name} · ${stats.youngest_member.age} ans` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start gap-2 py-1 border-b border-slate-50 last:border-0">
                  <span className="text-xs text-slate-400">{label}</span>
                  <span className="text-sm font-semibold text-slate-900 text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Unions ───────────────────────────────────────── */}
        {stats.total_unions > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h2 className="font-bold text-slate-900 mb-4">Types d&apos;unions ({stats.total_unions})</h2>
            <div className="flex flex-wrap gap-3">
              {unionTypes.map(({ label, picto, count, color }) => (
                <div key={label} className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-2.5">
                  <span className="text-lg">{picto}</span>
                  <div>
                    <p className="font-bold text-slate-900 text-lg leading-none">{count}</p>
                    <p className="text-xs text-slate-400">{label}</p>
                  </div>
                  <div className={`w-2 h-8 rounded-full ${color} ml-1`} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* ── Décennies ─────────────────────────────────── */}
          {stats.birth_decades.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-4">Naissances par décennie</h2>
              <div className="space-y-2">
                {stats.birth_decades.map(({ decade, count }) => (
                  <div key={decade} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-14 shrink-0">{decade}s</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${(count / maxDecade) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 w-4 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Noms de famille ───────────────────────────── */}
          {stats.last_names_top5.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-1">Top noms de famille</h2>
              {stats.most_common_first_name && (
                <p className="text-xs text-slate-400 mb-4">Prénom le + courant : <strong className="text-slate-700">{stats.most_common_first_name}</strong></p>
              )}
              <div className="space-y-2">
                {stats.last_names_top5.map(({ name, count }, i) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300 w-4">{i + 1}</span>
                    <span className="text-sm font-semibold text-slate-900 flex-1">{name}</span>
                    <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-purple-500 h-full rounded-full" style={{ width: `${(count / maxName) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-600 w-4 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Vivants vs Décédés ───────────────────────────── */}
        {total > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h2 className="font-bold text-slate-900 mb-3">Vivants vs Décédés</h2>
            <div className="flex h-5 rounded-full overflow-hidden gap-0.5 mb-3">
              <div className="bg-emerald-400 h-full transition-all" style={{ width: `${(stats.living_count  / total) * 100}%` }} />
              <div className="bg-slate-400  h-full transition-all" style={{ width: `${(stats.deceased_count / total) * 100}%` }} />
            </div>
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" /><span className="text-slate-500">Vivants</span><span className="font-bold text-slate-900">{stats.living_count}</span><span className="text-slate-300">({Math.round((stats.living_count / total) * 100)}%)</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-400 inline-block" /><span className="text-slate-500">Décédés</span><span className="font-bold text-slate-900">{stats.deceased_count}</span><span className="text-slate-300">({Math.round((stats.deceased_count / total) * 100)}%)</span></div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
