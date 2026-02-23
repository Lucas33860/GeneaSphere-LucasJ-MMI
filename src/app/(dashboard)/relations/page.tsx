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
              <h2 className="text-lg font-semibold text-gray-800">
                Unions <span className="text-gray-400 text-base font-normal">({unions.length})</span>
              </h2>
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

// ── Carte union ───────────────────────────────────────────────────
function UnionCard({ union, onEdit, onDelete, deleting }: { union: UnionRow; onEdit: () => void; onDelete: () => void; deleting?: boolean }) {
  const isSep = !!union.separation_date;
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4">
      <span className="text-2xl">{isSep ? "✗" : "♥"}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">
          {fullName(union.member1)} &nbsp;×&nbsp; {fullName(union.member2)}
        </p>
        <p className="text-xs text-gray-400">
          {isSep
            ? `Séparé${fmtDate(union.separation_date) ? ` le ${fmtDate(union.separation_date)}` : ""}`
            : `Ensemble${fmtDate(union.union_date) ? ` depuis ${fmtDate(union.union_date)}` : ""}`}
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

// ── Formulaire édition union ──────────────────────────────────────
function EditUnionForm({ union, onCancel, onSuccess, onError }: {
  union: UnionRow;
  onCancel: () => void;
  onSuccess: () => void;
  onError: (m: string) => void;
}) {
  const isSepInit = !!union.separation_date;
  const [statut, setStatut] = useState<"ensemble" | "séparé">(isSepInit ? "séparé" : "ensemble");
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit } = useForm({
    defaultValues: {
      date: (isSepInit ? union.separation_date : union.union_date)?.slice(0, 10) ?? "",
    },
  });

  const onSubmit = async (data: { date: string }) => {
    setSubmitting(true);
    const body = {
      union_date:      statut === "ensemble" ? (data.date || null) : null,
      separation_date: statut === "séparé"   ? (data.date || null) : null,
    };
    const res = await fetch(`/api/relations/${union.id}`, {
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
        Modifier : {fullName(union.member1)} × {fullName(union.member2)}
      </p>
      <div className="flex gap-2">
        {(["ensemble", "séparé"] as const).map(s => (
          <button key={s} type="button" onClick={() => setStatut(s)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              statut === s
                ? s === "ensemble" ? "bg-pink-500 text-white border-pink-500" : "bg-gray-400 text-white border-gray-400"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}>
            {s === "ensemble" ? "♥ Ensemble" : "✗ Séparé"}
          </button>
        ))}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {statut === "ensemble" ? "Date de début" : "Date de séparation"}
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
