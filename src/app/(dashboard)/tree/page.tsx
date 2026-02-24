"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FamilyTree, type TreeData, type AncestorInfo } from "@/components/tree/FamilyTree";
import type { Member, Spouse } from "@/types";
import { inputCls } from "@/lib/ui";

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

// ── Page principale ───────────────────────────────────────────────
export default function TreePage() {
  const [members, setMembers]       = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [treeData, setTreeData]     = useState<TreeData | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [treeError, setTreeError]     = useState<string | null>(null);

  // Expansion des ancêtres (père/mère → leurs propres parents)
  const [expandedAncestors, setExpandedAncestors] = useState<Record<string, AncestorInfo>>({});

  // Historique de navigation (IDs visités)
  const [history, setHistory] = useState<string[]>([]);

  // Panneau latéral : membre (édition) ou union
  const [panel, setPanel] = useState<
    { type: "member"; data: Member; editing: boolean } |
    { type: "union";  data: Spouse; editing: boolean } |
    null
  >(null);

  // Dialog légende (mobile)
  const legendDialogRef = useRef<HTMLDialogElement>(null);

  // ── Chargement des membres ────────────────────────────────────
  useEffect(() => {
    fetch("/api/members")
      .then(r => r.json())
      .then((data: Member[]) => {
        setMembers(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(() => setMemberError("Impossible de charger les membres"));
  }, []);

  // ── Chargement de l'arbre ─────────────────────────────────────
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!selectedId) return;
    setLoadingTree(true);
    setTreeError(null);
    setPanel(null);
    setExpandedAncestors({});
    fetch(`/api/tree?person_id=${selectedId}`)
      .then(r => r.json())
      .then(data => { setTreeData(data); setLoadingTree(false); })
      .catch(() => { setTreeError("Impossible de charger l'arbre"); setLoadingTree(false); });
  }, [selectedId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const refreshTree = useCallback((id: string) => {
    fetch(`/api/tree?person_id=${id}`)
      .then(r => r.json())
      .then(setTreeData);
  }, []);

  // ── Expansion ancêtres (clic père/mère) ──────────────────────
  const handleToggleExpand = useCallback(async (m: Member) => {
    if (expandedAncestors[m.id]) {
      setExpandedAncestors(prev => { const n = { ...prev }; delete n[m.id]; return n; });
    } else {
      const res = await fetch(`/api/tree?person_id=${m.id}`);
      const d = await res.json();
      setExpandedAncestors(prev => ({
        ...prev,
        [m.id]: { father: d.father, mother: d.mother, parentUnion: d.parentUnion },
      }));
    }
  }, [expandedAncestors]);

  // ── Navigation ────────────────────────────────────────────────
  const navigateTo = useCallback((id: string) => {
    setHistory(prev => [...prev, selectedId]);
    setSelectedId(id);
  }, [selectedId]);

  const navigateBack = useCallback(() => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(h => h.slice(0, -1));
    setSelectedId(prev);
  }, [history]);

  // ── Clic sur un nœud ─────────────────────────────────────────
  // "self" (nœud vert) → panneau d'édition
  // Autres nœuds (père, mère, fratrie, partenaire) → navigation
  const handleSelectMember = useCallback((m: Member) => {
    if (treeData && m.id === treeData.person.id) {
      setPanel({ type: "member", data: m, editing: false });
    } else {
      navigateTo(m.id);
    }
  }, [treeData, navigateTo]);

  const handleSelectUnion = useCallback((u: Spouse) => {
    setPanel({ type: "union", data: u, editing: false });
  }, []);

  const legendItems = [
    { color: "#1d4ed8", label: "Père" },
    { color: "#db2777", label: "Mère" },
    { color: "#059669", label: "Moi" },
    { color: "#be185d", label: "Conjoint·e" },
    { color: "#7c3aed", label: "Fratrie" },
    { color: "#ea580c", label: "Demi-fratrie" },
    { color: "#f97316", label: "Autre partenaire" },
    { color: "#475569", label: "Grand-parent" },
    { color: "#94a3b8", label: "Arr.-grand-parent" },
    { color: "#ec4899", label: "♥ Union" },
    { color: "#94a3b8", label: "✗ Séparé" },
    { color: "#94a3b8", label: "† Décédé(e)", dashed: true },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="flex h-[calc(100vh-57px)]">

        {/* ── Sidebar gauche : légende (desktop uniquement) ──── */}
        <aside className="w-44 shrink-0 bg-white border-r border-gray-100 hidden lg:flex flex-col gap-1 p-4 overflow-y-auto justify-center">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Légende</p>
          {legendItems.map(({ color, label, dashed }) => (
            <span key={label} className="flex items-center gap-2 text-xs text-gray-600 py-0.5">
              <span
                className="w-3 h-3 rounded-full shrink-0 inline-block"
                style={{
                  backgroundColor: color,
                  border: dashed ? `2px dashed ${color}` : undefined,
                  opacity: dashed ? 0.7 : 1,
                }}
              />
              {label}
            </span>
          ))}
          <div className="mt-4 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-400">
            <p>▼ développer</p>
            <p>▶ naviguer</p>
            <p>Clic MOI = modifier</p>
          </div>
        </aside>

        {/* ── Zone principale ───────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* En-tête + navigation */}
          <div className="flex flex-wrap items-center gap-3 px-6 py-4 bg-white border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-900">Arbre généalogique</h1>

            {/* Bouton légende mobile */}
            <button
              className="lg:hidden px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50"
              onClick={() => legendDialogRef.current?.showModal()}
            >
              Légende ℹ
            </button>

            {history.length > 0 && (
              <button
                onClick={navigateBack}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50"
              >
                ← Retour
              </button>
            )}

            {memberError ? (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">{memberError}</p>
            ) : members.length > 0 ? (
              <select
                value={selectedId}
                onChange={e => { setHistory([]); setSelectedId(e.target.value); }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-400">
                Aucun membre.{" "}
                <a href="/members" className="text-blue-600 underline">Ajoutez-en d&apos;abord.</a>
              </p>
            )}

            {history.length > 0 && (
              <span className="text-xs text-gray-400">
                {history.length} étape{history.length > 1 ? "s" : ""} en arrière
              </span>
            )}
          </div>

          {/* Arbre + panneau */}
          <div className="flex-1 flex gap-4 p-4 overflow-auto items-start">

            {/* ── Arbre D3 ──────────────────────────────────── */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 min-w-0">
              {treeError && (
                <div className="mb-3 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                  {treeError}
                </div>
              )}
              {loadingTree && (
                <div className="flex items-center justify-center h-64 text-gray-400">Chargement…</div>
              )}
              {!loadingTree && !treeError && !treeData && (
                <div className="flex items-center justify-center h-64 text-gray-400">Sélectionnez un membre.</div>
              )}
              {!loadingTree && treeData && (
                <FamilyTree
                  data={treeData}
                  expandedAncestors={expandedAncestors}
                  onToggleExpand={handleToggleExpand}
                  onSelectMember={handleSelectMember}
                  onSelectUnion={handleSelectUnion}
                />
              )}
            </div>

            {/* ── Panneau latéral (édition) ──────────────────── */}
            {panel && (
            <div className="w-72 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">

              {/* --- Panneau MEMBRE (info) --- */}
              {panel.type === "member" && !panel.editing && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-lg shrink-0">
                      {panel.data.first_name[0]}{panel.data.last_name[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{panel.data.first_name} {panel.data.last_name}</p>
                      <p className="text-xs text-gray-400">
                        {panel.data.gender
                          ? ({ male: "Homme", female: "Femme", other: "Autre" } as Record<string, string>)[panel.data.gender]
                          : "Genre inconnu"}
                      </p>
                    </div>
                  </div>
                  <dl className="text-sm space-y-2">
                    {panel.data.birth_date && <InfoRow label="Naissance" value={new Date(panel.data.birth_date).toLocaleDateString("fr-FR")} />}
                    {panel.data.birth_place && <InfoRow label="Lieu" value={panel.data.birth_place} />}
                    {panel.data.death_date && <InfoRow label="Décès" value={new Date(panel.data.death_date).toLocaleDateString("fr-FR")} />}
                    {panel.data.bio && <InfoRow label="Bio" value={panel.data.bio} />}
                  </dl>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setPanel({ ...panel, editing: true })} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                      Modifier
                    </button>
                    <button onClick={() => setPanel(null)} className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">✕</button>
                  </div>
                </>
              )}

              {/* --- Panneau MEMBRE (édition) --- */}
              {panel.type === "member" && panel.editing && (
                <EditMemberForm
                  member={panel.data}
                  onCancel={() => setPanel({ ...panel, editing: false })}
                  onSuccess={updated => {
                    setPanel({ type: "member", data: updated, editing: false });
                    refreshTree(selectedId);
                    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
                  }}
                />
              )}

              {/* --- Panneau UNION (info) --- */}
              {panel.type === "union" && !panel.editing && (
                <>
                  <UnionInfo union={panel.data} />
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setPanel({ ...panel, editing: true })} className="flex-1 bg-pink-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-700">
                      Modifier
                    </button>
                    <button onClick={() => setPanel(null)} className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">✕</button>
                  </div>
                </>
              )}

              {/* --- Panneau UNION (édition) --- */}
              {panel.type === "union" && panel.editing && (
                <EditUnionForm
                  union={panel.data}
                  onCancel={() => setPanel({ ...panel, editing: false })}
                  onSuccess={updated => {
                    setPanel({ type: "union", data: updated, editing: false });
                    refreshTree(selectedId);
                  }}
                />
              )}

            </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Dialog légende (mobile) ─────────────────────────── */}
      <dialog
        ref={legendDialogRef}
        className="rounded-2xl shadow-xl p-6 w-72 backdrop:bg-black/30"
        onClick={e => { if (e.target === legendDialogRef.current) legendDialogRef.current?.close(); }}
      >
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Légende</p>
        {legendItems.map(({ color, label, dashed }) => (
          <span key={label} className="flex items-center gap-2 text-xs text-gray-600 py-0.5">
            <span
              className="w-3 h-3 rounded-full shrink-0 inline-block"
              style={{
                backgroundColor: color,
                border: dashed ? `2px dashed ${color}` : undefined,
                opacity: dashed ? 0.7 : 1,
              }}
            />
            {label}
          </span>
        ))}
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-400">
          <p>▼ développer</p>
          <p>▶ naviguer</p>
          <p>Clic MOI = modifier</p>
        </div>
        <button
          onClick={() => legendDialogRef.current?.close()}
          className="mt-4 w-full py-2 rounded-lg bg-gray-100 text-sm text-gray-600 hover:bg-gray-200"
        >
          Fermer
        </button>
      </dialog>
    </main>
  );
}

// ── Info row ──────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-400 text-xs">{label}</dt>
      <dd className="text-gray-800 font-medium">{value}</dd>
    </div>
  );
}

// ── Affichage union ───────────────────────────────────────────────
function UnionInfo({ union }: { union: Spouse }) {
  const isSeparated = !!union.separation_date;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{isSeparated ? "✗" : "♥"}</span>
        <div>
          <p className="font-semibold text-gray-900">{isSeparated ? "Séparé" : "Ensemble"}</p>
          <p className="text-xs text-gray-400">Union</p>
        </div>
      </div>
      <dl className="text-sm space-y-2">
        {union.union_date && <InfoRow label="Date de début" value={new Date(union.union_date).toLocaleDateString("fr-FR")} />}
        {union.separation_date && <InfoRow label="Date de séparation" value={new Date(union.separation_date).toLocaleDateString("fr-FR")} />}
        {!union.union_date && !union.separation_date && <p className="text-gray-400 text-xs">Aucune date renseignée</p>}
      </dl>
    </div>
  );
}

// ── Formulaire édition membre ─────────────────────────────────────
function EditMemberForm({ member, onCancel, onSuccess }: { member: Member; onCancel: () => void; onSuccess: (u: Member) => void }) {
  const [submitError, setSubmitError] = useState<string | null>(null);
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
      <p className="font-semibold text-gray-800">Modifier le membre</p>
      {submitError && (
        <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{submitError}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <input {...register("first_name")} placeholder="Prénom" className={inputCls} />
          {errors.first_name && <p className="text-red-500 text-xs mt-0.5">{errors.first_name.message}</p>}
        </div>
        <div>
          <input {...register("last_name")} placeholder="Nom" className={inputCls} />
          {errors.last_name && <p className="text-red-500 text-xs mt-0.5">{errors.last_name.message}</p>}
        </div>
      </div>
      <select {...register("gender")} className={inputCls}>
        <option value="">Genre —</option>
        <option value="male">Homme</option>
        <option value="female">Femme</option>
        <option value="other">Autre</option>
      </select>
      <input {...register("birth_date")} type="date" className={inputCls} />
      <input {...register("birth_place")} placeholder="Lieu de naissance" className={inputCls} />
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Date de décès</label>
        <input {...register("death_date")} type="date" className={inputCls} />
      </div>
      <textarea {...register("bio")} placeholder="Biographie" rows={3} className={inputCls} />
      <div className="flex gap-2">
        <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {isSubmitting ? "Sauvegarde…" : "Sauvegarder"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">Annuler</button>
      </div>
    </form>
  );
}

// ── Formulaire édition union ──────────────────────────────────────
function EditUnionForm({ union, onCancel, onSuccess }: { union: Spouse; onCancel: () => void; onSuccess: (u: Spouse) => void }) {
  const isSeparatedInit = !!union.separation_date;
  const [statut, setStatut] = useState<"ensemble" | "séparé">(isSeparatedInit ? "séparé" : "ensemble");
  const [saveError, setSaveError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      date: isSeparatedInit
        ? (union.separation_date?.slice(0, 10) ?? "")
        : (union.union_date?.slice(0, 10) ?? ""),
    },
  });

  const onSubmit = async (data: { date: string }) => {
    setSaveError(null);
    const body = {
      union_date:      statut === "ensemble" ? (data.date || null) : null,
      separation_date: statut === "séparé"   ? (data.date || null) : null,
    };
    const res = await fetch(`/api/relations/${union.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setSaveError(j.error ?? "Erreur lors de la sauvegarde");
      return;
    }
    onSuccess(await res.json());
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="font-semibold text-gray-800">Modifier l&apos;union</p>
      {saveError && (
        <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>
      )}
      <div className="flex gap-2">
        {(["ensemble", "séparé"] as const).map(s => (
          <button
            key={s} type="button" onClick={() => setStatut(s)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              statut === s
                ? s === "ensemble" ? "bg-pink-500 text-white border-pink-500" : "bg-gray-400 text-white border-gray-400"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {s === "ensemble" ? "♥ Ensemble" : "✗ Séparé"}
          </button>
        ))}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {statut === "ensemble" ? "Date de début" : "Date de séparation"}
        </label>
        <input {...register("date")} type="date" className={inputCls} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={isSubmitting} className="flex-1 bg-pink-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-50">
          {isSubmitting ? "Sauvegarde…" : "Sauvegarder"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">Annuler</button>
      </div>
    </form>
  );
}
