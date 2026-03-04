"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { FamilyTree3D, type ViewMode } from "@/components/tree/FamilyTree3D";
import type { Member, Spouse, Tree, TreeAccessEntry } from "@/types";
import type { TreeRole } from "@/lib/tree-access";
import { darkInputCls } from "@/lib/ui";
import { uploadMemberPhoto } from "@/lib/supabase/storage";
import { type UnionState4, UNION_STATE_OPTIONS, stateToBody, unionToState4 } from "@/lib/union";

// ── Schemas ───────────────────────────────────────────────────────
const editMemberSchema = z.object({
  first_name:  z.string().min(1, "Requis"),
  last_name:   z.string().min(1, "Requis"),
  gender:      z.enum(["male", "female", "other", ""]).optional(),
  birth_date:  z.string().optional(),
  birth_place: z.string().optional(),
  death_date:  z.string().optional(),
  bio:         z.string().optional(),
});
type EditMemberInput = z.infer<typeof editMemberSchema>;

// ── Rôle badges ───────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  owner:  "Propriétaire",
  admin:  "Admin",
  editor: "Éditeur",
  reader: "Lecteur",
};
const ROLE_COLORS: Record<string, string> = {
  owner:  "bg-violet-600/20 text-violet-300 border-violet-500/30",
  admin:  "bg-blue-600/20 text-blue-300 border-blue-500/30",
  editor: "bg-emerald-600/20 text-emerald-300 border-emerald-500/30",
  reader: "bg-slate-600/20 text-slate-400 border-slate-500/30",
};

// ── canWrite / canDelete helpers (frontend) ───────────────────────
const canWrite  = (r: TreeRole | null) => r === "owner" || r === "admin" || r === "editor";
const canDelete = (r: TreeRole | null) => r === "owner" || r === "admin";
const canShare  = (r: TreeRole | null) => r === "owner" || r === "admin";

// ── ShareModal ────────────────────────────────────────────────────
interface UserResult { id: string; full_name: string | null; email: string; }

function ShareModal({ treeId, onClose }: { treeId: string; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [accesses, setAccesses] = useState<TreeAccessEntry[]>([]);
  const [treeOwner, setTreeOwner] = useState<{ id: string; name: string } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadAccesses = useCallback(async () => {
    const [aRes, tRes] = await Promise.all([
      fetch(`/api/trees/${treeId}/access`),
      fetch(`/api/trees/${treeId}`),
    ]);
    if (aRes.ok) setAccesses(await aRes.json());
    if (tRes.ok) {
      const tree = await tRes.json();
      setTreeOwner({ id: tree.owner_id, name: tree.owner_name ?? "Propriétaire" });
    }
  }, [treeId]);

  useEffect(() => { loadAccesses(); }, [loadAccesses]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults(await res.json());
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const grantAccess = async (userId: string, role: string) => {
    const res = await fetch(`/api/trees/${treeId}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role }),
    });
    if (res.ok) {
      setFeedback("Accès accordé !");
      setQuery("");
      setResults([]);
      await loadAccesses();
    } else {
      const d = await res.json();
      setFeedback(d.error ?? "Erreur");
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  const changeRole = async (userId: string, role: string) => {
    await fetch(`/api/trees/${treeId}/access/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    await loadAccesses();
  };

  const revokeAccess = async (userId: string) => {
    await fetch(`/api/trees/${treeId}/access/${userId}`, { method: "DELETE" });
    await loadAccesses();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <p className="font-bold text-white">Partager l&apos;arbre</p>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {feedback && (
            <p className="text-xs text-emerald-300 bg-emerald-900/30 border border-emerald-500/20 px-3 py-2 rounded-lg">{feedback}</p>
          )}

          {/* Recherche */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Inviter un utilisateur</label>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Nom ou email…"
              className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
            />
            {searching && <p className="text-xs text-slate-500 mt-1">Recherche…</p>}
            {results.length > 0 && (
              <div className="mt-2 space-y-2">
                {results.map(u => (
                  <div key={u.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{u.full_name ?? u.email}</p>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {(["reader", "editor", "admin"] as const).map(r => (
                        <button
                          key={r}
                          onClick={() => grantAccess(u.id, r)}
                          className="text-xs px-2 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-colors"
                        >
                          {ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Accès existants */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Accès existants</label>
            <div className="space-y-2">
              {/* Propriétaire */}
              {treeOwner && (
                <div className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{treeOwner.name}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-300 border border-violet-500/30">
                    Propriétaire
                  </span>
                </div>
              )}

              {accesses.map(a => (
                <div key={a.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{a.user_name ?? a.user_email ?? a.user_id}</p>
                    {a.user_email && <p className="text-xs text-slate-400 truncate">{a.user_email}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={a.role}
                      onChange={e => changeRole(a.user_id, e.target.value)}
                      className="text-xs bg-white/10 border border-white/10 text-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                    >
                      <option value="reader">Lecteur</option>
                      <option value="editor">Éditeur</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => revokeAccess(a.user_id)}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-900/20"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}

              {accesses.length === 0 && !treeOwner && (
                <p className="text-xs text-slate-500 text-center py-3">Aucun accès partagé</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────
export default function TreePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [trees, setTrees] = useState<Tree[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  const [treeRole, setTreeRole] = useState<TreeRole | null>(null);
  const [members, setMembers]       = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [resetKey, setResetKey]           = useState(0);
  const [viewMode, setViewMode]           = useState<ViewMode>("free");
  const [showNavHistory, setShowNavHistory] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: "ok" | "err" | "loading"; msg: string } | null>(null);
  const [showShare, setShowShare] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const [panel, setPanel] = useState<
    { type: "member"; data: Member; editing: boolean; history?: boolean } |
    { type: "union";  data: Spouse; editing: boolean } |
    null
  >(null);

  // ── Charger la liste des arbres ───────────────────────────────
  useEffect(() => {
    fetch("/api/trees")
      .then(r => r.json())
      .then(data => {
        const all: Tree[] = [...(data.owned ?? []), ...(data.shared ?? [])];
        setTrees(all);

        const urlTreeId = searchParams.get("treeId");
        // Ne sélectionne un arbre que si treeId est dans l'URL
        const initial = urlTreeId && all.find(t => t.id === urlTreeId) ? urlTreeId : null;
        setActiveTreeId(initial);
      })
      .catch(() => {});
  }, [searchParams]);

  // ── Charger les membres + rôle quand l'arbre change ──────────
  useEffect(() => {
    if (!activeTreeId) return;

    const tree = trees.find(t => t.id === activeTreeId);
    setTreeRole((tree?.role as TreeRole) ?? null);

    const url = `/api/members?treeId=${activeTreeId}`;
    fetch(url)
      .then(r => r.json())
      .then((data: Member[]) => {
        setMembers(data);
        if (data.length > 0) setSelectedId(data[0].id);
        else setSelectedId("");
      })
      .catch(() => setMemberError("Impossible de charger les membres"));
  }, [activeTreeId, trees]);

  const handleTreeChange = (treeId: string) => {
    setActiveTreeId(treeId);
    setPanel(null);
    router.replace(`/tree?treeId=${treeId}`);
  };

  const handleSelectMember = (m: Member) => setPanel({ type: "member", data: m, editing: false });
  const handleSelectUnion  = (u: Spouse) => setPanel({ type: "union",  data: u, editing: false });

  const handleExport = async () => {
    const url = activeTreeId ? `/api/tree/export?treeId=${activeTreeId}` : "/api/tree/export";
    const res = await fetch(url);
    if (!res.ok) return;
    const json = await res.json();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `geneasphere-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus({ type: "loading", msg: "Import en cours…" });
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (activeTreeId) payload.treeId = activeTreeId;
      const res = await fetch("/api/tree/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportStatus({ type: "err", msg: data.error ?? "Erreur lors de l'import" });
      } else {
        setImportStatus({ type: "ok", msg: `${data.members_created} membres + ${data.spouses_created} unions importés.` });
        const url = activeTreeId ? `/api/members?treeId=${activeTreeId}` : "/api/members";
        const memRes = await fetch(url);
        if (memRes.ok) {
          const updated: Member[] = await memRes.json();
          setMembers(updated);
          if (updated.length > 0 && !selectedId) setSelectedId(updated[0].id);
        }
        setResetKey(k => k + 1);
      }
    } catch {
      setImportStatus({ type: "err", msg: "Fichier JSON invalide." });
    }
    if (importRef.current) importRef.current.value = "";
    setTimeout(() => setImportStatus(null), 5000);
  };

  const legendItems = [
    { picto: "♥",   label: "Couple",     color: "text-pink-400" },
    { picto: "💔",  label: "Ex-couple",  color: "text-slate-400" },
    { picto: "💍",  label: "Marié·e",    color: "text-amber-400" },
    { picto: "💍✗", label: "Divorcé·e",  color: "text-slate-500" },
    { picto: "†",   label: "Décédé·e",   color: "text-slate-500" },
  ];

  const activeTree = trees.find(t => t.id === activeTreeId);

  // ── Aucun arbre sélectionné ───────────────────────────────────
  if (!activeTreeId) {
    return (
      <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-6 text-center px-4">
        <div className="text-6xl">🌳</div>
        <div>
          <p className="text-xl font-semibold text-white mb-2">Aucun arbre sélectionné</p>
          <p className="text-slate-400 text-sm">Choisissez un arbre depuis votre tableau de bord pour commencer.</p>
        </div>
        <a
          href="/dashboard"
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Aller au dashboard
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col" style={{ height: "calc(100vh - 56px)" }}>

      {/* ── Barre de contrôle ─────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 backdrop-blur border-b border-white/10 shrink-0 flex-wrap">

        {/* Sélecteur d'arbre */}
        {trees.length > 0 && (
          <select
            value={activeTreeId ?? ""}
            onChange={e => handleTreeChange(e.target.value)}
            className="bg-white/10 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-40"
          >
            {trees.map(t => (
              <option key={t.id} value={t.id} className="bg-slate-800">{t.name}</option>
            ))}
          </select>
        )}

        {/* Badge rôle */}
        {treeRole && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ROLE_COLORS[treeRole]}`}>
            {ROLE_LABELS[treeRole]}
          </span>
        )}

        {/* Sélecteur de membre */}
        {memberError ? (
          <p className="text-xs text-red-400 bg-red-900/30 px-3 py-1 rounded-lg">{memberError}</p>
        ) : members.length > 0 ? (
          <select
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setPanel(null); }}
            className="bg-white/10 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-44"
          >
            {members.map(m => (
              <option key={m.id} value={m.id} className="bg-slate-800">
                {m.first_name} {m.last_name}
              </option>
            ))}
          </select>
        ) : activeTreeId ? (
          <p className="text-xs text-slate-400">
            Aucun membre.{" "}
            {canWrite(treeRole) && <a href="/members" className="text-indigo-400 underline">Ajoutez-en d&apos;abord.</a>}
          </p>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {/* Légende inline */}
          <div className="hidden lg:flex items-center gap-3">
            {legendItems.map(({ picto, label, color }) => (
              <span key={label} className={`flex items-center gap-1 text-xs ${color}`}>
                <span>{picto}</span>
                <span className="text-slate-400">{label}</span>
              </span>
            ))}
          </div>
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="lg:hidden text-slate-400 hover:text-white px-2 py-1 rounded text-xs"
          >
            Légende
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Boutons vues caméra */}
          {(["free","top","front","side"] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-2 py-1 text-xs rounded font-medium transition-colors ${viewMode === m ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-white/10"}`}>
              {{ free: "3D", top: "Y↑", front: "Z→", side: "X→" }[m]}
            </button>
          ))}

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Reset */}
          <button
            title="Ferme les branches ouvertes et revient à la vue initiale"
            onClick={() => { setResetKey(k => k + 1); setViewMode("free"); setPanel(null); }}
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <span className="text-sm">🔄</span>
            <span className="text-[10px] leading-none">Réinitialiser</span>
          </button>

          {/* Historique navigation */}
          <button
            title="Afficher / masquer l'historique de navigation"
            onClick={() => setShowNavHistory(v => !v)}
            className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors ${showNavHistory ? "text-indigo-400" : "text-slate-400 hover:text-white"}`}
          >
            <span className="text-sm">⏱</span>
            <span className="text-[10px] leading-none">Historique</span>
          </button>

          {/* Partager */}
          {activeTreeId && canShare(treeRole) && (
            <button
              title="Partager cet arbre"
              onClick={() => setShowShare(true)}
              className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <span className="text-sm">🔗</span>
              <span className="text-[10px] leading-none">Partager</span>
            </button>
          )}

          {/* Export */}
          <button
            title="Télécharger l'arbre au format JSON"
            onClick={handleExport}
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <span className="text-sm">📤</span>
            <span className="text-[10px] leading-none">Exporter</span>
          </button>

          {/* Import */}
          {canWrite(treeRole) && (
            <label
              title="Importer un arbre depuis un fichier JSON"
              className="cursor-pointer flex flex-col items-center gap-0.5 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <span className="text-sm">📥</span>
              <span className="text-[10px] leading-none">Importer</span>
              <input
                ref={importRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImport}
              />
            </label>
          )}
        </div>
      </div>

      {/* ── Zone canvas ───────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">

        {importStatus && (
          <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl text-sm font-medium shadow-lg border ${
            importStatus.type === "ok"      ? "bg-emerald-900/90 text-emerald-300 border-emerald-700" :
            importStatus.type === "err"     ? "bg-red-900/90 text-red-300 border-red-700" :
                                              "bg-slate-800/90 text-slate-300 border-white/10"
          }`}>
            {importStatus.type === "loading" ? "⏳ " : importStatus.type === "ok" ? "✓ " : "✕ "}
            {importStatus.msg}
          </div>
        )}

        {selectedId ? (
          <FamilyTree3D
            rootId={selectedId}
            resetKey={resetKey}
            viewMode={viewMode}
            showHistory={showNavHistory}
            onSelectMember={handleSelectMember}
            onSelectUnion={handleSelectUnion}
            treeId={activeTreeId ?? undefined}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            {trees.length === 0
              ? <span>Aucun arbre. <a href="/dashboard" className="text-indigo-400 underline">Créez-en un.</a></span>
              : "Sélectionnez un membre pour démarrer."
            }
          </div>
        )}

        {/* Légende mobile */}
        {sidebarOpen && (
          <div className="absolute top-2 right-2 z-20 bg-slate-800/95 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-xl">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Légende</p>
            {legendItems.map(({ picto, label, color }) => (
              <p key={label} className={`flex items-center gap-2 text-sm mb-1.5 ${color}`}>
                <span className="w-5 text-center">{picto}</span>
                <span className="text-slate-300">{label}</span>
              </p>
            ))}
          </div>
        )}

        {/* Bouton reset flottant */}
        <button
          onClick={() => { setResetKey(k => k + 1); setViewMode("free"); setPanel(null); }}
          title="Réinitialiser la caméra et l'arbre"
          className="absolute bottom-4 right-4 z-20 bg-slate-800/80 hover:bg-slate-700 text-white p-3 rounded-full shadow-xl border border-white/10 text-lg"
        >
          🎯
        </button>

        {/* ── Panneau info/édition ──────────────────────────── */}
        {panel && (
          <div className="absolute top-3 left-3 z-20 w-80 bg-slate-900/95 backdrop-blur border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

            {panel.type === "member" && !panel.editing && !panel.history && (
              <MemberPanel
                member={panel.data}
                members={members}
                canWrite={canWrite(treeRole)}
                canDelete={canDelete(treeRole)}
                onEdit={() => setPanel({ ...panel, editing: true })}
                onHistory={() => setPanel({ ...panel, history: true })}
                onClose={() => setPanel(null)}
                onDeleted={() => {
                  setMembers(prev => prev.filter(m => m.id !== panel.data.id));
                  setPanel(null);
                }}
              />
            )}

            {panel.type === "member" && !panel.editing && panel.history && (
              <MemberHistoryPanel
                member={panel.data}
                onBack={() => setPanel({ ...panel, history: false })}
                onRestored={updated => {
                  setPanel({ type: "member", data: updated, editing: false });
                  setMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
                }}
                onClose={() => setPanel(null)}
              />
            )}

            {panel.type === "member" && panel.editing && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-white text-sm">Modifier</p>
                  <button onClick={() => setPanel({ ...panel, editing: false })} className="text-slate-400 hover:text-white text-xs">✕</button>
                </div>
                <EditMemberForm
                  member={panel.data}
                  onCancel={() => setPanel({ ...panel, editing: false })}
                  onSuccess={updated => {
                    setPanel({ type: "member", data: updated, editing: false });
                    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
                  }}
                />
              </div>
            )}

            {panel.type === "union" && !panel.editing && (
              <UnionPanel
                union={panel.data}
                canWrite={canWrite(treeRole)}
                canDelete={canDelete(treeRole)}
                onEdit={() => setPanel({ ...panel, editing: true })}
                onClose={() => setPanel(null)}
                onDeleted={() => setPanel(null)}
              />
            )}

            {panel.type === "union" && panel.editing && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-white text-sm">Modifier l&apos;union</p>
                  <button onClick={() => setPanel({ ...panel, editing: false })} className="text-slate-400 hover:text-white text-xs">✕</button>
                </div>
                <EditUnionForm
                  union={panel.data}
                  onCancel={() => setPanel({ ...panel, editing: false })}
                  onSuccess={updated => setPanel({ type: "union", data: updated, editing: false })}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ShareModal */}
      {showShare && activeTreeId && (
        <ShareModal treeId={activeTreeId} onClose={() => setShowShare(false)} />
      )}

      {/* Titre arbre courant (info flottante en bas) */}
      {activeTree && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <span className="text-xs text-slate-500 bg-slate-900/60 px-3 py-1 rounded-full border border-white/5">
            {activeTree.name}
          </span>
        </div>
      )}
    </main>
  );
}

// ── Panneau membre ────────────────────────────────────────────────
function MemberPanel({ member, members, canWrite: cw, canDelete: cd, onEdit, onHistory, onClose, onDeleted }: {
  member: Member; members: Member[];
  canWrite: boolean; canDelete: boolean;
  onEdit: () => void; onHistory: () => void; onClose: () => void; onDeleted: () => void;
}) {
  const father = members.find(m => m.id === member.father_id);
  const mother = members.find(m => m.id === member.mother_id);
  const isDead = !!member.death_date;
  const age = member.birth_date
    ? (isDead
        ? new Date(member.death_date!).getFullYear() - new Date(member.birth_date).getFullYear()
        : new Date().getFullYear() - new Date(member.birth_date).getFullYear())
    : null;

  const genderLabel: Record<string, string> = { male: "♂ Homme", female: "♀ Femme", other: "⚥ Autre" };

  const handleDelete = async () => {
    if (!confirm(`Supprimer définitivement ${member.first_name} ${member.last_name} ?`)) return;
    const res = await fetch(`/api/members/${member.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  };

  return (
    <>
      <div className="relative">
        {member.photo_url ? (
          <div className="h-36 overflow-hidden flex items-center justify-center bg-slate-900">
            <img src={member.photo_url} alt={member.first_name} className="max-w-full max-h-full object-contain" />
            <div className="absolute inset-0 bg-linear-to-t from-slate-900 via-slate-900/30 to-transparent" />
          </div>
        ) : (
          <div className="h-20 bg-linear-to-br from-indigo-900 to-slate-900" />
        )}
        <button onClick={onClose} className="absolute top-2 right-2 bg-black/40 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs hover:bg-black/60">✕</button>
        <div className="absolute bottom-0 left-4 translate-y-1/2">
          <div className="w-14 h-14 rounded-full bg-indigo-800 border-2 border-slate-900 flex items-center justify-center text-lg font-bold text-white overflow-hidden">
            {member.photo_url
              ? <img src={member.photo_url} alt="" className="w-full h-full object-cover" />
              : <>{member.first_name[0]}{member.last_name[0]}</>
            }
          </div>
        </div>
      </div>

      <div className="pt-10 px-4 pb-4 space-y-3">
        <div>
          <p className="font-bold text-white text-base leading-tight">{member.first_name} {member.last_name.toUpperCase()}</p>
          <p className="text-slate-400 text-xs mt-0.5">
            {member.gender ? genderLabel[member.gender] : "Genre inconnu"}
            {age != null && ` · ${age} ans`}
            {isDead && " · †"}
          </p>
        </div>

        <div className="space-y-1.5">
          {member.birth_date && (
            <InfoRowDark label="Naissance" value={
              new Date(member.birth_date).toLocaleDateString("fr-FR") +
              (member.birth_place ? ` — ${member.birth_place}` : "")
            } />
          )}
          {member.death_date && (
            <InfoRowDark label="Décès" value={new Date(member.death_date).toLocaleDateString("fr-FR")} />
          )}
          {(father || mother) && (
            <InfoRowDark
              label="Parents"
              value={[father && `${father.first_name} ${father.last_name}`, mother && `${mother.first_name} ${mother.last_name}`].filter(Boolean).join(" · ")}
            />
          )}
          {member.bio && <InfoRowDark label="Bio" value={member.bio} />}
          {member.is_private && <InfoRowDark label="Visibilité" value="Profil privé 🔒" />}
        </div>

        {cw && (
          <button
            onClick={onEdit}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            Modifier
          </button>
        )}
        <button
          onClick={onHistory}
          className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          Historique
        </button>
        {cd && (
          <button
            onClick={handleDelete}
            className="w-full text-red-400 hover:text-red-300 text-xs font-medium py-1"
          >
            🗑 Supprimer
          </button>
        )}
      </div>
    </>
  );
}

// ── Historique membre : types + helpers ───────────────────────────
interface MemberHistoryEntry {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  birth_date: string | null;
  death_date: string | null;
  birth_place: string | null;
  photo_url: string | null;
  bio: string | null;
  is_private: boolean | null;
  changed_at: string;
  change_type: string;
}

type HistoryLike = {
  first_name: string; last_name: string; gender: string | null;
  birth_date: string | null; death_date: string | null; birth_place: string | null;
  bio: string | null; is_private: boolean | null; photo_url: string | null;
};

const GENDER_LABELS: Record<string, string> = { male: "Homme", female: "Femme", other: "Autre" };
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const trunc = (s: string | null, n = 45) => !s ? "—" : s.length > n ? s.slice(0, n) + "…" : s;

function buildDiff(before: HistoryLike, after: HistoryLike): string[] {
  const diffs: string[] = [];
  if (before.first_name !== after.first_name)
    diffs.push(`Prénom : ${before.first_name} → ${after.first_name}`);
  if (before.last_name !== after.last_name)
    diffs.push(`Nom : ${before.last_name} → ${after.last_name}`);
  if (before.gender !== after.gender)
    diffs.push(`Genre : ${GENDER_LABELS[before.gender ?? ""] ?? "—"} → ${GENDER_LABELS[after.gender ?? ""] ?? "—"}`);
  if (before.birth_date !== after.birth_date)
    diffs.push(`Naissance : ${fmtDate(before.birth_date)} → ${fmtDate(after.birth_date)}`);
  if (before.death_date !== after.death_date)
    diffs.push(`Décès : ${fmtDate(before.death_date)} → ${fmtDate(after.death_date)}`);
  if (before.birth_place !== after.birth_place)
    diffs.push(`Lieu naiss. : ${before.birth_place ?? "—"} → ${after.birth_place ?? "—"}`);
  if (before.bio !== after.bio)
    diffs.push(`Bio : « ${trunc(before.bio)} » → « ${trunc(after.bio)} »`);
  if (before.is_private !== after.is_private)
    diffs.push(`Visibilité : ${before.is_private ? "Privé" : "Public"} → ${after.is_private ? "Privé" : "Public"}`);
  if (before.photo_url !== after.photo_url)
    diffs.push("Photo : mise à jour");
  return diffs;
}

// ── Panneau historique membre ─────────────────────────────────────
function MemberHistoryPanel({ member, onBack, onRestored, onClose }: {
  member: Member; onBack: () => void; onRestored: (m: Member) => void; onClose: () => void;
}) {
  const [history, setHistory] = useState<MemberHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/members/${member.id}/history`)
      .then(r => r.json())
      .then((data: MemberHistoryEntry[]) => { setHistory(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [member.id]);

  const handleRestore = async (hid: string) => {
    setRestoring(hid);
    const res = await fetch(`/api/members/${member.id}/restore/${hid}`, { method: "POST" });
    if (res.ok) {
      const updated: Member = await res.json();
      const histRes = await fetch(`/api/members/${member.id}/history`);
      if (histRes.ok) setHistory(await histRes.json());
      onRestored(updated);
    }
    setRestoring(null);
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-slate-400 hover:text-white text-xs">← Retour</button>
          <p className="font-bold text-white text-sm">Historique</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xs">✕</button>
      </div>
      <div className="p-3 max-h-96 overflow-y-auto space-y-2">
        {loading && <p className="text-slate-500 text-xs text-center py-4">Chargement…</p>}
        {!loading && history.length === 0 && (
          <p className="text-slate-500 text-xs text-center py-4">Aucun historique disponible</p>
        )}

        {!loading && history.length > 0 && (
          <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-3 text-xs">
            <p className="text-indigo-400 font-semibold mb-1">Version actuelle</p>
            <p className="text-white font-medium">{member.first_name} {member.last_name.toUpperCase()}</p>
            {member.birth_date && <p className="text-slate-400 mt-0.5">Né·e le {fmtDate(member.birth_date)}{member.birth_place ? ` à ${member.birth_place}` : ""}</p>}
            {member.bio && <p className="text-slate-500 mt-0.5 italic">{trunc(member.bio, 60)}</p>}
          </div>
        )}

        {history.map((entry, i) => {
          const afterState: HistoryLike = i === 0 ? member : history[i - 1];
          const diffs = buildDiff(entry, afterState);

          return (
            <div key={entry.id} className="bg-white/5 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">
                  {new Date(entry.changed_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <button
                  onClick={() => handleRestore(entry.id)}
                  disabled={restoring === entry.id}
                  className="text-[11px] font-semibold bg-slate-700 hover:bg-indigo-600 text-slate-300 hover:text-white px-2 py-0.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  {restoring === entry.id ? "…" : "Restaurer"}
                </button>
              </div>

              <p className="text-slate-300 font-semibold">{entry.first_name} {entry.last_name.toUpperCase()}</p>

              {diffs.length > 0 ? (
                <ul className="space-y-1 pt-0.5">
                  {diffs.map((d, j) => (
                    <li key={j} className="text-slate-400 leading-snug">
                      <span className="text-slate-600">•</span> {d}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-600 italic">
                  {i === history.length - 1 ? "Première version enregistrée" : "Aucune différence détectable"}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Panneau union ─────────────────────────────────────────────────
function UnionPanel({ union, canWrite: cw, canDelete: cd, onEdit, onClose, onDeleted }: {
  union: Spouse; canWrite: boolean; canDelete: boolean;
  onEdit: () => void; onClose: () => void; onDeleted: () => void;
}) {
  const sep = !!union.separation_date;
  const isCouple = union.union_type === "couple";
  const picto = isCouple ? (sep ? "💔" : "♥") : (sep ? "💍✗" : "💍");
  const label = isCouple ? (sep ? "Ex-couple" : "Couple") : (sep ? "Divorcé·e" : "Marié·e");
  const color = isCouple ? (sep ? "from-slate-700 to-slate-800" : "from-pink-800 to-rose-900")
                         : (sep ? "from-slate-700 to-slate-800" : "from-amber-800 to-yellow-900");

  const handleDelete = async () => {
    if (!confirm("Supprimer cette union ?")) return;
    const res = await fetch(`/api/relations/${union.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  };

  return (
    <>
      <div className={`h-16 bg-linear-to-br ${color} flex items-center justify-between px-4`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{picto}</span>
          <span className="text-white font-bold">{label}</span>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white text-sm">✕</button>
      </div>
      <div className="px-4 py-4 space-y-2">
        {union.union_date && (
          <InfoRowDark label="Début" value={new Date(union.union_date).toLocaleDateString("fr-FR")} />
        )}
        {union.separation_date && (
          <InfoRowDark label="Séparation" value={new Date(union.separation_date).toLocaleDateString("fr-FR")} />
        )}
        {!union.union_date && !union.separation_date && (
          <p className="text-slate-500 text-xs">Aucune date renseignée</p>
        )}
        {cw && (
          <button
            onClick={onEdit}
            className="w-full bg-pink-600 hover:bg-pink-500 text-white py-2 rounded-xl text-sm font-semibold transition-colors mt-2"
          >
            Modifier
          </button>
        )}
        {cd && (
          <button
            onClick={handleDelete}
            className="w-full text-red-400 hover:text-red-300 text-xs font-medium py-1"
          >
            🗑 Supprimer l&apos;union
          </button>
        )}
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────
function InfoRowDark({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-slate-200 text-sm font-medium">{value}</p>
    </div>
  );
}

// ── Formulaire édition membre ─────────────────────────────────────
function EditMemberForm({ member, onCancel, onSuccess }: { member: Member; onCancel: () => void; onSuccess: (u: Member) => void }) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(member.photo_url ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EditMemberInput>({
    resolver: zodResolver(editMemberSchema),
    defaultValues: {
      first_name:  member.first_name,
      last_name:   member.last_name,
      gender:      member.gender ?? "",
      birth_date:  member.birth_date ?? "",
      birth_place: member.birth_place ?? "",
      death_date:  member.death_date ?? "",
      bio:         member.bio ?? "",
    },
  });

  const onSubmit = async (data: EditMemberInput) => {
    setSubmitError(null);
    let photoUrl = member.photo_url ?? null;

    const file = fileRef.current?.files?.[0];
    if (file) {
      setUploading(true);
      const uploaded = await uploadMemberPhoto(file);
      if (uploaded) photoUrl = uploaded;
      setUploading(false);
    }

    const res = await fetch(`/api/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        gender:      data.gender      || null,
        birth_date:  data.birth_date  || null,
        birth_place: data.birth_place || null,
        death_date:  data.death_date  || null,
        bio:         data.bio         || null,
        photo_url:   photoUrl,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setSubmitError(j.error ?? "Erreur lors de la sauvegarde");
      return;
    }
    onSuccess(await res.json());
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {submitError && (
        <p className="text-red-400 text-xs bg-red-900/30 px-3 py-2 rounded-lg">{submitError}</p>
      )}

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
          {preview
            ? <img src={preview} alt="" className="w-full h-full object-cover" />
            : <span className="text-xl text-slate-500">📷</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={e => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : (member.photo_url ?? null));
            }}
            className="block w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-900/50 file:text-indigo-300 hover:file:bg-indigo-900"
          />
          {preview && preview !== member.photo_url && (
            <button type="button" onClick={() => { setPreview(member.photo_url ?? null); if (fileRef.current) fileRef.current.value = ""; }}
              className="text-xs text-slate-500 hover:text-red-400 mt-0.5">
              Annuler le changement
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <input {...register("first_name")} placeholder="Prénom" className={darkInputCls} />
          {errors.first_name && <p className="text-red-400 text-xs mt-0.5">{errors.first_name.message}</p>}
        </div>
        <div>
          <input {...register("last_name")} placeholder="Nom" className={darkInputCls} />
          {errors.last_name && <p className="text-red-400 text-xs mt-0.5">{errors.last_name.message}</p>}
        </div>
      </div>

      <select {...register("gender")} className={darkInputCls + " [&>option]:bg-slate-800"}>
        <option value="">Genre —</option>
        <option value="male">Homme</option>
        <option value="female">Femme</option>
        <option value="other">Autre</option>
      </select>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-slate-500 mb-1">Naissance</p>
          <input {...register("birth_date")} type="date" className={darkInputCls} />
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Décès</p>
          <input {...register("death_date")} type="date" className={darkInputCls} />
        </div>
      </div>

      <input {...register("birth_place")} placeholder="Lieu de naissance" className={darkInputCls} />
      <textarea {...register("bio")} placeholder="Biographie…" rows={2} className={darkInputCls + " resize-none"} />

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={isSubmitting || uploading}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
          {uploading ? "Upload…" : isSubmitting ? "Sauvegarde…" : "Sauvegarder"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-white/5">
          Annuler
        </button>
      </div>
    </form>
  );
}

// ── Formulaire édition union ──────────────────────────────────────
function EditUnionForm({ union, onCancel, onSuccess }: { union: Spouse; onCancel: () => void; onSuccess: (u: Spouse) => void }) {
  const [state, setState] = useState<UnionState4>(unionToState4(union));
  const [saveError, setSaveError] = useState<string | null>(null);
  const isSep = state === "ex-couple" || state === "divorce";

  const { register, handleSubmit, formState: { isSubmitting }, setValue } = useForm({
    defaultValues: { date: (isSep ? union.separation_date : union.union_date)?.slice(0, 10) ?? "" },
  });

  const handleStateChange = (v: UnionState4) => {
    setState(v);
    if (v === "ex-couple" || v === "divorce") {
      setValue("date", new Date().toISOString().slice(0, 10));
    }
  };

  const onSubmit = async (data: { date: string }) => {
    setSaveError(null);
    const res = await fetch(`/api/relations/${union.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stateToBody(state, data.date)),
    });
    if (!res.ok) {
      setSaveError((await res.json().catch(() => ({}))).error ?? "Erreur");
      return;
    }
    onSuccess(await res.json());
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {saveError && <p className="text-red-400 text-xs bg-red-900/30 px-3 py-2 rounded-lg">{saveError}</p>}

      <div className="grid grid-cols-2 gap-2">
        {UNION_STATE_OPTIONS.map(opt => (
          <button key={opt.value} type="button" onClick={() => handleStateChange(opt.value)}
            className={`flex flex-col items-center py-2.5 rounded-xl border transition-all text-xs font-semibold ${
              state === opt.value ? opt.active : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
            }`}>
            <span className="text-lg mb-0.5">{opt.picto}</span>
            {opt.label}
          </button>
        ))}
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1">{isSep ? "Date de séparation" : "Date de début"} (optionnel)</p>
        <input {...register("date")} type="date" className={darkInputCls} />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={isSubmitting}
          className="flex-1 bg-pink-600 hover:bg-pink-500 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
          {isSubmitting ? "Sauvegarde…" : "Sauvegarder"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-white/5">
          Annuler
        </button>
      </div>
    </form>
  );
}
