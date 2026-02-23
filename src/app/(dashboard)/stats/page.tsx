"use client";

import { useEffect, useState } from "react";

interface Stats {
  total_members: number;
  deceased_count: number;
  unions_count: number;
  oldest_member: { name: string; birth_date: string } | null;
  average_age: number | null;
  most_common_name: string | null;
}

function StatCard({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col gap-1">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-sm text-gray-400">{sub}</p>}
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then(r => r.json())
      .then(setStats)
      .catch(() => setError("Impossible de charger les statistiques"));
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Statistiques familiales</h1>

        {error && (
          <div className="text-sm px-4 py-2 rounded-lg bg-red-50 text-red-600">{error}</div>
        )}

        {!stats && !error && (
          <p className="text-gray-400 text-center py-12">Chargement…</p>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard title="Total membres" value={stats.total_members} />
              <StatCard title="Décédés" value={stats.deceased_count} />
              <StatCard title="Unions" value={stats.unions_count} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard
                title="Membre le plus âgé"
                value={stats.oldest_member?.name ?? "—"}
                sub={
                  stats.oldest_member?.birth_date
                    ? `Né(e) le ${new Date(stats.oldest_member.birth_date).toLocaleDateString("fr-FR")}`
                    : undefined
                }
              />
              <StatCard
                title="Âge moyen (vivants)"
                value={stats.average_age !== null ? `${stats.average_age} ans` : "—"}
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <StatCard
                title="Prénom le plus courant"
                value={stats.most_common_name ?? "—"}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
