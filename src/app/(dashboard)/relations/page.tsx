"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { Member } from "@/types";
import { inputCls } from "@/lib/ui";
import { type UnionState4, UNION_STATE_OPTIONS, stateToBody, unionToState4 } from "@/lib/union";
import { UnionStateSelector } from "@/components/union/UnionStateSelector";

// ── Types ─────────────────────────────────────────────────────────
interface MemberSnap { id: string; first_name: string; last_name: string }

interface UnionRow {
  id: string;
  member1_id: string;
  member2_id: string;
  union_type: "couple" | "marriage";
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

const fullName = (m: MemberSnap | null | undefined) => m ? `${m.first_name} ${m.last_name}` : "—";
const fmtDate  = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : null;

// ── Page principale ───────────────────────────────────────────────
export default function RelationsPage() {
  const [unions,     setUnions]     = useState<UnionRow[]>([]);
  const [parentages, setParentages] = useState<ParentageRow[]>([]);
  const [members,    setMembers]    = useState<Member[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [feedback,   setFeedback]   = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [editingUnion,     setEditingUnion]     = useState<UnionRow | null>(null);
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
      const [relRes, memRes] = await Promise.all([fetch("/api/relations"), fetch("/api/members")]);
      if (relRes.ok) {
        const rel = await relRes.json();
        setUnions(rel.unions ?? []);
        setParentages(rel.parentages ?? []);
      }
      if (memRes.ok) setMembers(await memRes.json());
    } catch { notify("err", "Impossible de charger les relations"); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const deleteUnion = async (id: string) => {
    if (!confirm("Supprimer cette union ?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/relations/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) { notify("ok", "Union supprimée."); loadAll(); }
    else notify("err", (await res.json()).error ?? "Erreur");
  };

  const deleteParentage = async (id: string) => {
    if (!confirm("Supprimer cette parenté ?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/parentages/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) { notify("ok", "Parenté supprimée."); loadAll(); }
    else notify("err", (await res.json()).error ?? "Erreur");
  };

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="bg-linear-to-br from-slate-900 via-pink-950 to-slate-900 px-4 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Relations</h1>
              <p className="text-slate-400 mt-1 text-sm">Unions et liens de parenté</p>
            </div>
            <button
              onClick={() => setShowUnionForm(v => !v)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                showUnionForm
                  ? "bg-white/20 text-white"
                  : "bg-pink-500 hover:bg-pink-400 text-white"
              }`}
            >
              {showUnionForm ? "Annuler" : "💞 Nouvelle union"}
            </button>
          </div>

          {/* Compteurs */}
          <div className="flex gap-8 mt-8">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{unions.length}</p>
              <p className="text-slate-400 text-xs mt-0.5">Union{unions.length > 1 ? "s" : ""}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{parentages.length}</p>
              <p className="text-slate-400 text-xs mt-0.5">Parenté{parentages.length > 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Feedback */}
        {feedback && (
          <div className={`text-sm px-4 py-3 rounded-xl font-medium border ${
            feedback.type === "ok"
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-red-50 text-red-600 border-red-100"
          }`}>
            {feedback.type === "ok" ? "✓ " : "✕ "}{feedback.msg}
          </div>
        )}

        {/* Formulaire nouvelle union */}
        {showUnionForm && (
          <UnionForm
            members={members}
            onSuccess={() => { setShowUnionForm(false); notify("ok", "Union créée."); loadAll(); }}
            onError={m => notify("err", m)}
          />
        )}

        {loading ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 text-sm">Chargement…</p>
          </div>
        ) : (
          <>
            {/* ── Unions ─────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                Unions ({unions.length})
              </h2>
              {unions.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-2xl border border-slate-100">
                  <p className="text-slate-400 text-sm">Aucune union enregistrée.</p>
                </div>
              ) : (
                <div className="space-y-3">
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

            {/* ── Parentés ───────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                Parentés ({parentages.length})
              </h2>
              {parentages.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-2xl border border-slate-100">
                  <p className="text-slate-400 text-sm">Aucune parenté enregistrée.</p>
                </div>
              ) : (
                <div className="space-y-3">
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

// ── Helpers ───────────────────────────────────────────────────────
function unionPictoLabel(u: UnionRow) {
  const sep = !!u.separation_date;
  if (u.union_type === "couple") return sep ? { picto: "💔", label: "Ex-couple", bg: "bg-slate-100 text-slate-600" } : { picto: "♥", label: "Couple", bg: "bg-pink-100 text-pink-700" };
  return sep ? { picto: "💍✗", label: "Divorcé·e", bg: "bg-slate-100 text-slate-600" } : { picto: "💍", label: "Marié·e", bg: "bg-amber-100 text-amber-700" };
}

// ── Carte union ───────────────────────────────────────────────────
function UnionCard({ union, onEdit, onDelete, deleting }: {
  union: UnionRow; onEdit: () => void; onDelete: () => void; deleting?: boolean;
}) {
  const { picto, label, bg } = unionPictoLabel(union);
  const isSep = !!union.separation_date;
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${bg}`}>
        {picto}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 truncate">
          {fullName(union.member1)} <span className="text-slate-300 font-normal">×</span> {fullName(union.member2)}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {label}
          {isSep && fmtDate(union.separation_date) ? ` · séparé le ${fmtDate(union.separation_date)}` : ""}
          {!isSep && fmtDate(union.union_date) ? ` · depuis le ${fmtDate(union.union_date)}` : ""}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={onEdit} disabled={deleting}
          className="px-3 py-1.5 text-xs rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 font-medium disabled:opacity-50">
          Modifier
        </button>
        <button onClick={onDelete} disabled={deleting}
          className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium disabled:opacity-50">
          {deleting ? "…" : "Supprimer"}
        </button>
      </div>
    </div>
  );
}

// ── Formulaire édition union ──────────────────────────────────────
function EditUnionForm({ union, onCancel, onSuccess, onError }: {
  union: UnionRow; onCancel: () => void; onSuccess: () => void; onError: (m: string) => void;
}) {
  const [state, setState] = useState<UnionState4>(unionToState4(union));
  const [submitting, setSubmitting] = useState(false);
  const isSep = state === "ex-couple" || state === "divorce";
  const { register, handleSubmit, setValue } = useForm({
    defaultValues: { date: (isSep ? union.separation_date : union.union_date)?.slice(0, 10) ?? "" },
  });

  const handleStateChange = (v: UnionState4) => {
    setState(v);
    if (v === "ex-couple" || v === "divorce") {
      setValue("date", new Date().toISOString().slice(0, 10));
    }
  };

  const onSubmit = async (data: { date: string }) => {
    setSubmitting(true);
    const res = await fetch(`/api/relations/${union.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stateToBody(state, data.date)),
    });
    setSubmitting(false);
    if (!res.ok) { onError((await res.json()).error ?? "Erreur"); return; }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white border-2 border-indigo-100 rounded-2xl p-5 space-y-4 shadow-sm">
      <p className="font-bold text-slate-900 text-sm">
        Modifier : {fullName(union.member1)} × {fullName(union.member2)}
      </p>
      <UnionStateSelector value={state} onChange={handleStateChange} />
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">
          {isSep ? "Date de séparation" : "Date de début"} (optionnel)
        </label>
        <input {...register("date")} type="date" className={inputCls} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting}
          className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
          {submitting ? "Sauvegarde…" : "Sauvegarder"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100">
          Annuler
        </button>
      </div>
    </form>
  );
}

// ── Carte parenté ─────────────────────────────────────────────────
function ParentageCard({ parentage, onEdit, onDelete, deleting }: {
  parentage: ParentageRow; onEdit: () => void; onDelete: () => void; deleting?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
        👶
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900">{fullName(parentage.child)}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {parentage.father ? `👨 ${fullName(parentage.father)}` : "Père inconnu"}
          {" · "}
          {parentage.mother ? `👩 ${fullName(parentage.mother)}` : "Mère inconnue"}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={onEdit} disabled={deleting}
          className="px-3 py-1.5 text-xs rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 font-medium disabled:opacity-50">
          Modifier
        </button>
        <button onClick={onDelete} disabled={deleting}
          className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium disabled:opacity-50">
          {deleting ? "…" : "Supprimer"}
        </button>
      </div>
    </div>
  );
}

// ── Formulaire édition parenté ────────────────────────────────────
function EditParentageForm({ parentage, members, onCancel, onSuccess, onError }: {
  parentage: ParentageRow; members: Member[]; onCancel: () => void; onSuccess: () => void; onError: (m: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit } = useForm({
    defaultValues: { father_id: parentage.father_id ?? "", mother_id: parentage.mother_id ?? "" },
  });

  const onSubmit = async (data: { father_id: string; mother_id: string }) => {
    setSubmitting(true);
    const res = await fetch(`/api/parentages/${parentage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ father_id: data.father_id || null, mother_id: data.mother_id || null }),
    });
    setSubmitting(false);
    if (!res.ok) { onError((await res.json()).error ?? "Erreur"); return; }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white border-2 border-indigo-100 rounded-2xl p-5 space-y-4 shadow-sm">
      <p className="font-bold text-slate-900 text-sm">
        Parenté de {fullName(parentage.child)}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Père</label>
          <select {...register("father_id")} className={inputCls}>
            <option value="">— Inconnu —</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Mère</label>
          <select {...register("mother_id")} className={inputCls}>
            <option value="">— Inconnue —</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting}
          className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
          {submitting ? "Sauvegarde…" : "Sauvegarder"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100">
          Annuler
        </button>
      </div>
    </form>
  );
}

// ── Formulaire nouvelle union ─────────────────────────────────────
function UnionForm({ members, onSuccess, onError }: {
  members: Member[]; onSuccess: () => void; onError: (m: string) => void;
}) {
  const [state, setState] = useState<UnionState4 | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { member1_id: "", member2_id: "", date: "" },
  });
  const m1 = watch("member1_id");
  const m2 = watch("member2_id");
  const isSep = state === "ex-couple" || state === "divorce";

  const handleStateChange = (v: UnionState4) => {
    setState(v);
    if ((v === "ex-couple" || v === "divorce") && !watch("date")) {
      setValue("date", new Date().toISOString().slice(0, 10));
    }
  };

  const onSubmit = async (data: { member1_id: string; member2_id: string; date: string }) => {
    if (!data.member1_id || !data.member2_id) { onError("Sélectionnez 2 membres."); return; }
    if (data.member1_id === data.member2_id) { onError("Les deux membres doivent être différents."); return; }
    if (!state) { onError("Choisissez un état d'union."); return; }
    setSubmitting(true);
    const res = await fetch("/api/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "spouse", member1_id: data.member1_id, member2_id: data.member2_id, ...stateToBody(state, data.date) }),
    });
    setSubmitting(false);
    if (!res.ok) { onError((await res.json()).error ?? "Erreur"); return; }
    reset();
    setState(null);
    onSuccess();
  };

  const selectedOpt = UNION_STATE_OPTIONS.find(o => o.value === state);
  const name1 = members.find(m => m.id === m1)?.first_name;
  const name2 = members.find(m => m.id === m2)?.first_name;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">
      <h2 className="font-bold text-slate-900 text-lg">Nouvelle union</h2>

      {/* Personnes */}
      <div className="grid grid-cols-2 gap-3">
        {(["member1_id", "member2_id"] as const).map((name, i) => (
          <div key={name}>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Personne {i + 1}</label>
            <select {...register(name)} className={inputCls}>
              <option value="">— Choisir —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
          </div>
        ))}
      </div>
      {m1 && m2 && m1 !== m2 && (
        <p className="text-sm text-pink-600 font-medium -mt-2">
          {name1} &amp; {name2}
        </p>
      )}

      {/* État de l'union */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">État de l&apos;union</p>
        <UnionStateSelector value={state} onChange={handleStateChange} />
      </div>

      {/* Date */}
      {state && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">
            {isSep ? "Date de séparation" : "Date de début"} (optionnel)
          </label>
          <input {...register("date")} type="date" className={inputCls} />
        </div>
      )}

      {/* Résumé */}
      {state && m1 && m2 && m1 !== m2 && selectedOpt && (
        <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-slate-700">
          <span className="text-lg">{selectedOpt.picto}</span>
          <span><strong>{name1}</strong> &amp; <strong>{name2}</strong> — {selectedOpt.label}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !state || !m1 || !m2 || m1 === m2}
        className="w-full bg-pink-500 hover:bg-pink-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"

>
        {submitting ? "Création…" : "Créer l'union"}
      </button>
    </form>
  );
}
