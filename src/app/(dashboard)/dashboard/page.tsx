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
  reader: "bg-zinc-100 text-zinc-600",
};

// ── Composant carte arbre ─────────────────────────────────────────
function TreeCard({ tree }: { tree: Tree }) {
  const role = tree.role ?? "reader";
  const isOwner = role === "owner";
  return (
    <div className="bg-white rounded-3xl shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all duration-200 flex flex-col overflow-hidden border border-zinc-100">
      {/* Gradient band */}
      <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500" />

      <div className="p-6 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-zinc-900 truncate text-base">{tree.name}</p>
            {!isOwner && tree.owner_name && (
              <p className="text-xs text-zinc-400 mt-0.5">Arbre de {tree.owner_name}</p>
            )}
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${ROLE_COLORS[role]}`}>
            {ROLE_LABELS[role]}
          </span>
        </div>

        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <span className="font-semibold text-zinc-700">{tree.member_count ?? 0}</span>
          <span>membre{(tree.member_count ?? 0) !== 1 ? "s" : ""}</span>
          <span className="text-zinc-200">·</span>
          <span>{new Date(tree.created_at).toLocaleDateString("fr-FR")}</span>
        </div>

        <Link
          href={`/tree?treeId=${tree.id}`}
          className="mt-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold py-2.5 rounded-xl transition-all shadow-md shadow-indigo-500/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Ouvrir l&apos;arbre →
        </Link>
      </div>
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900 text-lg">Nouvel arbre</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-zinc-400 hover:text-zinc-600 text-xl leading-none focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">Nom de l&apos;arbre</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex : Famille Martin"
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">

        {/* ── En-tête ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Mes arbres</h1>
            <p className="text-sm text-zinc-400 mt-1">Gérez et partagez vos arbres généalogiques</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/25 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            + Créer un arbre
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* ── Mes arbres ──────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">Mes arbres</h2>
              {owned.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-2xl bg-white">
                  <p className="text-zinc-500 font-medium">Aucun arbre pour l&apos;instant</p>
                  <p className="text-zinc-400 text-sm mt-1">Commencez par créer votre premier arbre généalogique.</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    + Créer un arbre
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
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">Partagés avec moi</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {shared.map(tree => <TreeCard key={tree.id} tree={tree} />)}
                </div>
              </section>
            )}

            {/* ── Accès rapide ─────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">Accès rapide</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { href: "/members",   label: "Membres",       icon: "👥" },
                  { href: "/relations", label: "Relations",     icon: "🔗" },
                  { href: "/stats",     label: "Statistiques",  icon: "📊" },
                  { href: "/tree",      label: "Arbre 3D",      icon: "🌳" },
                ].map(({ href, label, icon }) => (
                  <Link key={href} href={href}
                    className="bg-white rounded-2xl p-4 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-100 transition-all text-center group border border-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <span className="text-2xl block mb-1">{icon}</span>
                    <p className="text-sm font-semibold text-zinc-600 group-hover:text-indigo-600 transition-colors">{label}</p>
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
