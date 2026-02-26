"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { Member } from "@/types";
import { inputCls } from "@/lib/ui";

// ── Types enrichis renvoyés par GET /api/relations ────────────────
interface MemberSnap { id: string; first_name: string; last_name: string }

interface UnionRow {
  id: string;
  member1_id: string;
  member2_id: string;
  union_type: 'couple' | 'marriage';
  union_date: string | null;
  separation_date: string | null;
  member1: MemberSnap;
  member2: MemberSnap;
}

interface ParentageRow {
  id: string;
  child_id: string;
  father_id: string | null;
  mother_id: string | null;
  child:  MemberSnap;
  father: MemberSnap | null;
  mother: MemberSnap | null;
}

const fullName  = (m: MemberSnap | null | undefined) => m ? `${m.first_name} ${m.last_name}` : "—";
const fmtDate   = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : null;

// ── Page principale ───────────────────────────────────────────────
export default function RelationsPage() {
  const [unions,    setUnions]    = useState<UnionRow[]>([]);
  const [parentages, setParentages] = useState<ParentageRow[]>([]);
  const [members,   setMembers]   = useState<Member[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [feedback,  setFeedback]  = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [editingUnion,    setEditingUnion]    = useState<UnionRow | null>(null);
  const [editingParentage, setEditingParentage] = useState<ParentageRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showUnionForm, setShowUnionForm] = useState(false);

  const notify = (type: "ok" | "err", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [relRes, memRes] = await Promise.all([
        fetch("/api/relations"),
        fetch("/api/members"),
      ]);
      if (relRes.ok) {
        const rel = await relRes.json();
        setUnions(rel.unions ?? []);
        setParentages(rel.parentages ?? []);
      }
      if (memRes.ok) setMembers(await memRes.json());
    } catch {
      notify("err", "Impossible de charger les relations");
    }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Supprimer une union ───────────────────────────────────────
  const deleteUnion = async (id: string) => {
    if (!confirm("Supprimer cette union ?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/relations/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) { notify("ok", "Union supprimée."); loadAll(); }
    else notify("err", (await res.json()).error ?? "Erreur");
  };

  // ── Supprimer une parenté ─────────────────────────────────────
  const deleteParentage = async (id: string) => {
    if (!confirm("Supprimer cette parenté ?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/parentages/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) { notify("ok", "Parenté supprimée."); loadAll(); }
    else notify("err", (await res.json()).error ?? "Erreur");
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">

        <h1 className="text-2xl font-bold text-gray-900">Relations</h1>

        {feedback && (
          <div className={`text-sm px-4 py-2 rounded-lg ${feedback.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {feedback.msg}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400 text-center py-12">Chargement…</p>
        ) : (
          <>
            {/* ── Unions ─────────────────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">
                  Unions <span className="text-gray-400 text-base font-normal">({unions.length})</span>
                </h2>
                <button
                  onClick={() => setShowUnionForm(v => !v)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-pink-50 text-pink-700 hover:bg-pink-100 font-medium"
                >
                  {showUnionForm ? "Annuler" : "+ Nouvelle union"}
                </button>
              </div>
              {showUnionForm && (
                <UnionForm
                  members={members}
                  onSuccess={() => { setShowUnionForm(false); notify("ok", "Union créée."); loadAll(); }}
                  onError={m => notify("err", m)}
                />
              )}
              {unions.length === 0 ? (
                <p className="text-gray-400 text-sm">Aucune union.</p>
              ) : (
                <div className="grid gap-3">
                  {unions.map(u => (
                    <div key={u.id}>
                      {editingUnion?.id === u.id ? (
                        <EditUnionForm
                          union={u}
                          onCancel={() => setEditingUnion(null)}
                          onSuccess={() => { setEditingUnion(null); notify("ok", "Union mise à jour."); loadAll(); }}
                          onError={m => notify("err", m)}
                        />
                      ) : (
                        <UnionCard
                          union={u}
                          onEdit={() => setEditingUnion(u)}
                          onDelete={() => deleteUnion(u.id)}
                          deleting={deletingId === u.id}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Parentés ───────────────────────────────────────── */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-800">
                Parentés <span className="text-gray-400 text-base font-normal">({parentages.length})</span>
              </h2>
              {parentages.length === 0 ? (
                <p className="text-gray-400 text-sm">Aucune parenté.</p>
              ) : (
                <div className="grid gap-3">
                  {parentages.map(p => (
                    <div key={p.id}>
                      {editingParentage?.id === p.id ? (
                        <EditParentageForm
                          parentage={p}
                          members={members}
                          onCancel={() => setEditingParentage(null)}
                          onSuccess={() => { setEditingParentage(null); notify("ok", "Parenté mise à jour."); loadAll(); }}
                          onError={m => notify("err", m)}
                        />
                      ) : (
                        <ParentageCard
                          parentage={p}
                          onEdit={() => setEditingParentage(p)}
                          onDelete={() => deleteParentage(p.id)}
                          deleting={deletingId === p.id}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

// ── Picto et libellé selon le type d'union ────────────────────────
function unionPictoLabel(u: UnionRow): { picto: string; label: string } {
  const sep = !!u.separation_date;
  if (u.union_type === 'couple') {
    return sep ? { picto: "💔", label: "Ex-couple" } : { picto: "♥", label: "Couple" };
  }
  return sep ? { picto: "💍✗", label: "Divorcé·e" } : { picto: "💍", label: "Marié·e" };
}

// ── Carte union ───────────────────────────────────────────────────
function UnionCard({ union, onEdit, onDelete, deleting }: { union: UnionRow; onEdit: () => void; onDelete: () => void; deleting?: boolean }) {
  const isSep = !!union.separation_date;
  const { picto, label } = unionPictoLabel(union);
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4">
      <span className="text-2xl">{picto}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">
          {fullName(union.member1)} &nbsp;×&nbsp; {fullName(union.member2)}
        </p>
        <p className="text-xs text-gray-400">
          {label}
          {isSep && fmtDate(union.separation_date) ? ` · séparé le ${fmtDate(union.separation_date)}` : ""}
          {!isSep && fmtDate(union.union_date) ? ` · depuis ${fmtDate(union.union_date)}` : ""}
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={onEdit} disabled={deleting} className="px-3 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50">Modifier</button>
        <button onClick={onDelete} disabled={deleting} className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
          {deleting ? "…" : "Supprimer"}
        </button>
      </div>
    </div>
  );
}

// ── 4 états d'union ───────────────────────────────────────────────
type UnionState4 = "couple" | "ex-couple" | "marriage" | "divorce";

const UNION_STATE_OPTIONS: {
  value: UnionState4;
  picto: string;
  label: string;
  desc: string;
  active: string;
}[] = [
  { value: "couple",    picto: "♥",   label: "Couple",    desc: "En couple",        active: "bg-pink-500 border-pink-500 text-white" },
  { value: "ex-couple", picto: "💔",  label: "Ex-couple", desc: "Séparés",          active: "bg-gray-400 border-gray-400 text-white" },
  { value: "marriage",  picto: "💍",  label: "Marié·e",   desc: "Union officielle", active: "bg-yellow-500 border-yellow-500 text-white" },
  { value: "divorce",   picto: "💍✗", label: "Divorcé·e", desc: "Mariage terminé",  active: "bg-slate-600 border-slate-600 text-white" },
];

function stateToBody(state: UnionState4, date: string) {
  const isSep = state === "ex-couple" || state === "divorce";
  return {
    union_type:      state === "couple" || state === "ex-couple" ? "couple" : "marriage",
    union_date:      !isSep ? (date || null) : null,
    separation_date:  isSep ? (date || null) : null,
  };
}

function unionToState4(u: { union_type: string; separation_date: string | null }): UnionState4 {
  if (u.union_type === "couple") return u.separation_date ? "ex-couple" : "couple";
  return u.separation_date ? "divorce" : "marriage";
}

// ── Sélecteur 4 états réutilisable ────────────────────────────────
function UnionStateSelector({ value, onChange }: {
  value: UnionState4 | null;
  onChange: (v: UnionState4) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {UNION_STATE_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex flex-col items-center gap-0.5 py-3 px-2 rounded-xl border-2 font-medium transition-all ${
            value === opt.value
              ? opt.active + " shadow-md scale-[1.02]"
              : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-white"
          }`}
        >
          <span className="text-xl">{opt.picto}</span>
          <span className="text-sm font-semibold">{opt.label}</span>
          <span className="text-xs opacity-60">{opt.desc}</span>
        </button>
      ))}
    </div>
  );
}

// ── Formulaire édition union ──────────────────────────────────────
function EditUnionForm({ union, onCancel, onSuccess, onError }: {
  union: UnionRow;
  onCancel: () => void;
  onSuccess: () => void;
  onError: (m: string) => void;
}) {
  const [state, setState] = useState<UnionState4>(unionToState4(union));
  const [submitting, setSubmitting] = useState(false);
  const isSep = state === "ex-couple" || state === "divorce";
  const { register, handleSubmit } = useForm({
    defaultValues: {
      date: (isSep ? union.separation_date : union.union_date)?.slice(0, 10) ?? "",
    },
  });

  const onSubmit = async (data: { date: string }) => {
    setSubmitting(true);
    const res = await fetch(`/api/relations/${union.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stateToBody(state, data.date)),
    });
    setSubmitting(false);
    if (!res.ok) { onError((await res.json()).error ?? "Erreur lors de la sauvegarde"); return; }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-blue-100 rounded-xl p-4 space-y-3">
      <p className="font-semibold text-gray-800 text-sm">
        Modifier : {fullName(union.member1)} × {fullName(union.member2)}
      </p>
      <UnionStateSelector value={state} onChange={setState} />
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {isSep ? "Date de séparation (optionnel)" : "Date de début (optionnel)"}
        </label>
        <input {...register("date")} type="date" className={inputCls} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting}
          className="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {submitting ? "Sauvegarde…" : "Sauvegarder"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100">
          Annuler
        </button>
      </div>
    </form>
  );
}

// ── Carte parenté ─────────────────────────────────────────────────
function ParentageCard({ parentage, onEdit, onDelete, deleting }: { parentage: ParentageRow; onEdit: () => void; onDelete: () => void; deleting?: boolean }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">{fullName(parentage.child)}</p>
        <p className="text-xs text-gray-400">
          {parentage.father ? `Père : ${fullName(parentage.father)}` : "Père inconnu"}
          {" · "}
          {parentage.mother ? `Mère : ${fullName(parentage.mother)}` : "Mère inconnue"}
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={onEdit} disabled={deleting} className="px-3 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50">Modifier</button>
        <button onClick={onDelete} disabled={deleting} className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
          {deleting ? "…" : "Supprimer"}
        </button>
      </div>
    </div>
  );
}

// ── Formulaire édition parenté ────────────────────────────────────
function EditParentageForm({ parentage, members, onCancel, onSuccess, onError }: {
  parentage: ParentageRow;
  members: Member[];
  onCancel: () => void;
  onSuccess: () => void;
  onError: (m: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit } = useForm({
    defaultValues: {
      father_id: parentage.father_id ?? "",
      mother_id: parentage.mother_id ?? "",
    },
  });

  const onSubmit = async (data: { father_id: string; mother_id: string }) => {
    setSubmitting(true);
    const body = {
      father_id: data.father_id || null,
      mother_id: data.mother_id || null,
    };
    const res = await fetch(`/api/parentages/${parentage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (!res.ok) { onError((await res.json()).error ?? "Erreur lors de la sauvegarde"); return; }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-blue-100 rounded-xl p-4 space-y-3">
      <p className="font-semibold text-gray-800 text-sm">
        Modifier parenté de : {fullName(parentage.child)}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Père</label>
          <select {...register("father_id")} className={inputCls}>
            <option value="">— Inconnu —</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Mère</label>
          <select {...register("mother_id")} className={inputCls}>
            <option value="">— Inconnue —</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting}
          className="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {submitting ? "Sauvegarde…" : "Sauvegarder"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100">
          Annuler
        </button>
      </div>
    </form>
  );
}

// ── Formulaire création union ──────────────────────────────────────
function UnionForm({ members, onSuccess, onError }: {
  members: Member[];
  onSuccess: () => void;
  onError: (m: string) => void;
}) {
  const [state, setState] = useState<UnionState4 | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { member1_id: "", member2_id: "", date: "" },
  });
  const m1 = watch("member1_id");
  const m2 = watch("member2_id");
  const isSep = state === "ex-couple" || state === "divorce";

  const onSubmit = async (data: { member1_id: string; member2_id: string; date: string }) => {
    if (!data.member1_id || !data.member2_id) { onError("Veuillez sélectionner 2 membres."); return; }
    if (data.member1_id === data.member2_id) { onError("Les deux membres doivent être différents."); return; }
    if (!state) { onError("Choisissez un état d'union."); return; }
    setSubmitting(true);
    const res = await fetch("/api/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "spouse",
        member1_id: data.member1_id,
        member2_id: data.member2_id,
        ...stateToBody(state, data.date),
      }),
    });
    setSubmitting(false);
    if (!res.ok) { onError((await res.json()).error ?? "Erreur lors de la création"); return; }
    reset();
    setState(null);
    onSuccess();
  };

  const selectedOpt = UNION_STATE_OPTIONS.find(o => o.value === state);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white border-2 border-pink-200 rounded-2xl p-5 space-y-4 shadow-sm">
      <p className="font-bold text-gray-900 text-base">Nouvelle union</p>

      {/* ── Personnes ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">① Personnes</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Personne 1</label>
            <select {...register("member1_id")} className={inputCls}>
              <option value="">— Choisir —</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Personne 2</label>
            <select {...register("member2_id")} className={inputCls}>
              <option value="">— Choisir —</option>
              {members.filter(m => m.id !== m1).map(m => (
                <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
              ))}
            </select>
          </div>
        </div>
        {m1 && m2 && m1 !== m2 && (
          <p className="mt-1.5 text-xs text-pink-600 font-medium">
            {members.find(m => m.id === m1)?.first_name} &amp; {members.find(m => m.id === m2)?.first_name}
          </p>
        )}
      </div>

      {/* ── État de l'union (4 cartes directes) ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">② État de l&apos;union</p>
        <UnionStateSelector value={state} onChange={setState} />
      </div>

      {/* ── Date ── */}
      {state && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            ③ Date <span className="font-normal normal-case text-gray-400">(optionnel)</span>
          </p>
          <label className="block text-xs text-gray-500 mb-1">
            {isSep ? "Date de séparation / divorce" : "Date de début de l'union"}
          </label>
          <input {...register("date")} type="date" className={inputCls} />
        </div>
      )}

      {/* ── Résumé ── */}
      {state && m1 && m2 && m1 !== m2 && selectedOpt && (
        <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-700 flex items-center gap-2">
          <span className="text-lg">{selectedOpt.picto}</span>
          <span>
            <strong>{members.find(m => m.id === m1)?.first_name}</strong>
            {" & "}
            <strong>{members.find(m => m.id === m2)?.first_name}</strong>
            {" — "}{selectedOpt.label}
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !state || !m1 || !m2 || m1 === m2}
        className="w-full bg-pink-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Création…" : "Créer l'union"}
      </button>
    </form>
  );
}
