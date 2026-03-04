"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Tree } from "@/types";

const ROLE_LABELS: Record<string, string> = {
  owner:  "Propriétaire",
  admin:  "Admin",
  editor: "Éditeur",
  reader: "Lecteur",
};

const ROLE_COLORS: Record<string, string> = {
  owner:  "bg-violet-100 text-violet-700",
  admin:  "bg-blue-100 text-blue-700",
  editor: "bg-emerald-100 text-emerald-700",
  reader: "bg-slate-100 text-slate-600",
};

// ── Composant carte arbre ─────────────────────────────────────────
function TreeCard({ tree }: { tree: Tree }) {
  const role = tree.role ?? "reader";
  const isOwner = role === "owner";
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 truncate">{tree.name}</p>
          {!isOwner && tree.owner_name && (
            <p className="text-xs text-slate-400 mt-0.5">Arbre de {tree.owner_name}</p>
          )}
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLORS[role]}`}>
          {ROLE_LABELS[role]}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span>👥 {tree.member_count ?? 0} membre{(tree.member_count ?? 0) !== 1 ? "s" : ""}</span>
        <span className="text-slate-300">·</span>
        <span>{new Date(tree.created_at).toLocaleDateString("fr-FR")}</span>
      </div>

      <Link
        href={`/tree?treeId=${tree.id}`}
        className="mt-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
      >
        🌳 Ouvrir
      </Link>
    </div>
  );
}

// ── Modal création arbre ──────────────────────────────────────────
function CreateTreeModal({ onClose, onCreate }: { onClose: () => void; onCreate: (t: Tree) => void }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Nom requis"); return; }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/trees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Erreur"); return; }
    onCreate(data);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-lg">Nouvel arbre</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Nom de l&apos;arbre</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex : Famille Martin"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {loading ? "Création…" : "Créer l'arbre"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────
export default function DashboardPage() {
  const [owned, setOwned] = useState<Tree[]>([]);
  const [shared, setShared] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetch("/api/trees")
      .then(r => r.json())
      .then(data => {
        setOwned(data.owned ?? []);
        setShared(data.shared ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCreated = (tree: Tree) => {
    setOwned(prev => [...prev, tree]);
  };

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-14">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-indigo-300 text-sm font-medium tracking-widest uppercase mb-2">Mes arbres</p>
            <h1 className="text-4xl font-bold text-white">GeneaSphere</h1>
            <p className="text-slate-400 mt-2">Créez et partagez vos arbres généalogiques</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-xl font-semibold text-sm transition-colors shadow-lg"
          >
            ＋ Créer un arbre
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">

        {loading ? (
          <div className="text-center py-16">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* ── Mes arbres ──────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Mes arbres</h2>
              {owned.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-3xl mb-3">🌳</p>
                  <p className="text-slate-500 font-medium">Aucun arbre pour l&apos;instant</p>
                  <p className="text-slate-400 text-sm mt-1">Commencez par créer votre premier arbre généalogique.</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
                  >
                    ＋ Créer un arbre
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {owned.map(tree => <TreeCard key={tree.id} tree={tree} />)}
                </div>
              )}
            </section>

            {/* ── Partagés avec moi ────────────────────────────────── */}
            {shared.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Partagés avec moi</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {shared.map(tree => <TreeCard key={tree.id} tree={tree} />)}
                </div>
              </section>
            )}

            {/* ── Accès rapide ─────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Accès rapide</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { href: "/members",   icon: "👥", label: "Membres",      color: "from-blue-500 to-cyan-600" },
                  { href: "/relations", icon: "💞", label: "Relations",    color: "from-pink-500 to-rose-600" },
                  { href: "/stats",     icon: "📊", label: "Statistiques", color: "from-emerald-500 to-teal-600" },
                  { href: "/tree",      icon: "🌳", label: "Arbre 3D",     color: "from-indigo-500 to-purple-600" },
                ].map(({ href, icon, label, color }) => (
                  <Link key={href} href={href}
                    className="group bg-white border border-slate-100 rounded-2xl p-4 hover:shadow-md hover:border-indigo-100 transition-all text-center"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-xl mx-auto mb-2 shadow-sm`}>
                      {icon}
                    </div>
                    <p className="text-sm font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">{label}</p>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {showCreate && (
        <CreateTreeModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreated}
        />
      )}
    </main>
  );
}
