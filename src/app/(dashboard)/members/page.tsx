"use client";
import { Suspense } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import type { Member } from "@/types";
import type { TreeRole } from "@/lib/tree-access";
import { inputCls } from "@/lib/ui";
import { uploadMemberPhoto } from "@/lib/supabase/storage";
import { type UnionState4, UNION_STATE_OPTIONS, stateToBody } from "@/lib/union";
import { UnionStateSelector } from "@/components/union/UnionStateSelector";
import { MemberCard } from "@/components/members/MemberCard";

const canWrite  = (r: TreeRole | null) => r === "owner" || r === "admin" || r === "editor";
const canDelete = (r: TreeRole | null) => r === "owner" || r === "admin";

// ── Schemas ───────────────────────────────────────────────────────
const addMemberSchema = z.object({
  first_name:  z.string().min(1, "Requis"),
  last_name:   z.string().min(1, "Requis"),
  gender:      z.enum(["male", "female", "other", ""]).optional(),
  birth_date:  z.string().optional(),
  birth_place: z.string().optional(),
  death_date:  z.string().optional(),
  father_id:   z.string().optional(),
  mother_id:   z.string().optional(),
});
type AddMemberInput = z.infer<typeof addMemberSchema>;

const editMemberSchema = z.object({
  first_name:  z.string().min(1, "Requis"),
  last_name:   z.string().min(1, "Requis"),
  gender:      z.enum(["male", "female", "other", ""]).optional(),
  birth_date:  z.string().optional(),
  birth_place: z.string().optional(),
  death_date:  z.string().optional(),
  bio:         z.string().optional(),
  father_id:   z.string().optional(),
  mother_id:   z.string().optional(),
  is_private:  z.boolean().optional(),
});
type EditMemberInput = z.infer<typeof editMemberSchema>;

type Panel = "add" | "union" | null;

// ── Composant principal ───────────────────────────────────────────
export default function MembersPage() {
  return <Suspense><MembersPageContent /></Suspense>;
}

function MembersPageContent() {
  const searchParams = useSearchParams();
  const treeId = searchParams.get("treeId");
  const [treeRole, setTreeRole] = useState<TreeRole | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Charger le rôle sur l'arbre courant
  useEffect(() => {
    if (!treeId) return;
    fetch(`/api/trees/${treeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTreeRole(d.role as TreeRole); })
      .catch(() => {});
  }, [treeId]);

  const notify = (type: "ok" | "err", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchMembers = useCallback(async () => {
    const qs = treeId ? `?treeId=${treeId}` : "";
    const res = await fetch(`/api/members${qs}`).catch(() => null);
    if (!res) { notify("err", "Impossible de charger les membres"); setLoading(false); return; }
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }, [treeId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const togglePanel = (p: Panel) => setPanel(prev => prev === p ? null : p);

  const filtered = members.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const living  = members.filter(m => !m.death_date).length;
  const deceased = members.filter(m =>  m.death_date).length;

  if (!treeId) {
    return (
      <main className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-6 text-center px-4">
        <div>
          <p className="text-xl font-semibold text-zinc-800 mb-2">Aucun arbre sélectionné</p>
          <p className="text-zinc-400 text-sm">Choisissez un arbre depuis votre tableau de bord pour voir ses membres.</p>
        </div>
        <a href="/dashboard" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
          Aller au dashboard
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">

      {/* ── En-tête ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-zinc-100 px-4 py-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Membres</h1>
            <div className="flex gap-4 mt-1.5">
              {[
                { label: "Total",   value: members.length, color: "text-indigo-600" },
                { label: "Vivants", value: living,          color: "text-emerald-600" },
                { label: "Décédés", value: deceased,        color: "text-zinc-400" },
              ].map(({ label, value, color }) => (
                <span key={label} className="text-sm text-zinc-400">
                  <span className={`font-black text-lg ${color}`}>{value}</span> {label}
                </span>
              ))}
            </div>
          </div>
          {canWrite(treeRole) && (
            <div className="flex gap-2">
              <button
                onClick={() => togglePanel("add")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-sm ${panel === "add" ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-200" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"}`}
              >
                + Ajouter
              </button>
              <button
                onClick={() => togglePanel("union")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 shadow-sm ${panel === "union" ? "bg-pink-500 text-white shadow-pink-200" : "bg-pink-50 text-pink-700 hover:bg-pink-100"}`}
              >
                ♥ Union
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Feedback */}
        {feedback && (
          <div role="status" className={`text-sm px-4 py-3 rounded-xl font-medium ${
            feedback.type === "ok"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "bg-red-50 text-red-600 border border-red-100"
          }`}>
            {feedback.type === "ok" ? "✓ " : "✕ "}{feedback.msg}
          </div>
        )}

        {/* Formulaires */}
        {panel === "add" && (
          <AddMemberForm
            members={members}
            treeId={treeId ?? undefined}
            onSuccess={() => { notify("ok", "Membre ajouté."); fetchMembers(); setPanel(null); }}
            onError={(m) => notify("err", m)}
          />
        )}
        {panel === "union" && (
          <UnionForm
            members={members}
            treeId={treeId ?? undefined}
            onSuccess={() => { notify("ok", "Union créée."); fetchMembers(); setPanel(null); }}
            onError={(m) => notify("err", m)}
          />
        )}

        {/* Recherche */}
        {members.length > 0 && (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un membre…"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">✕</button>
            )}
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 text-sm">Chargement…</p>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-zinc-500 font-medium">Aucun membre pour l&apos;instant</p>
            <p className="text-zinc-400 text-sm">Commencez par ajouter la première personne de votre famille.</p>
            <button
              onClick={() => togglePanel("add")}
              className="mt-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              + Ajouter un membre
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-400 py-8">Aucun résultat pour &quot;{search}&quot;</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(m => (
              <MemberCard
                key={m.id}
                member={m}
                onClick={() => setSelectedMember(m)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal édition complète */}
      {selectedMember && (
        <EditMemberModal
          member={selectedMember}
          members={members}
          canWrite={canWrite(treeRole)}
          canDelete={canDelete(treeRole)}
          onClose={() => setSelectedMember(null)}
          onSaved={() => {
            notify("ok", "Modifications enregistrées.");
            fetchMembers();
            setSelectedMember(null);
          }}
          onDeleted={() => {
            notify("ok", "Membre supprimé.");
            fetchMembers();
            setSelectedMember(null);
          }}
        />
      )}
    </main>
  );
}

// ── Field helper ──────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ── Modal édition complète d'un membre ───────────────────────────
function EditMemberModal({ member, members, canWrite: cw = true, canDelete: cd = true, onClose, onSaved, onDeleted }: {
  member: Member;
  members: Member[];
  canWrite?: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(member.photo_url);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      father_id:   member.father_id ?? "",
      mother_id:   member.mother_id ?? "",
      is_private:  member.is_private,
    },
  });

  const onSubmit = async (data: EditMemberInput) => {
    setSaveError(null);
    let photoUrl = member.photo_url;

    const file = fileRef.current?.files?.[0];
    if (file) {
      setUploading(true);
      const uploaded = await uploadMemberPhoto(file);
      if (uploaded) photoUrl = uploaded;
      setUploading(false);
    }

    const body = {
      ...data,
      gender:      data.gender      || null,
      birth_date:  data.birth_date  || null,
      birth_place: data.birth_place || null,
      death_date:  data.death_date  || null,
      bio:         data.bio         || null,
      father_id:   data.father_id   || null,
      mother_id:   data.mother_id   || null,
      is_private:  data.is_private  ?? false,
      photo_url:   photoUrl,
    };

    const res = await fetch(`/api/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      onSaved();
    } else {
      const json = await res.json().catch(() => ({}));
      setSaveError(json.error ?? "Erreur lors de la sauvegarde");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer définitivement ${member.first_name} ${member.last_name} ?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/members/${member.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) onDeleted();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">

        {/* Header photo */}
        <div className="relative h-28 bg-linear-to-br from-indigo-600 to-blue-500 rounded-t-2xl overflow-hidden">
          {preview && <img src={preview} alt="" className="w-full h-full object-cover opacity-60" />}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center text-sm font-bold"
          >
            ✕
          </button>
          {/* Avatar */}
          <div className="absolute -bottom-8 left-6">
            <div className="w-16 h-16 rounded-full border-4 border-white bg-indigo-100 overflow-hidden shadow-md">
              {preview
                ? <img src={preview} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-indigo-600 font-bold text-xl">
                    {member.first_name[0]}{member.last_name[0]}
                  </div>
              }
            </div>
          </div>
        </div>

        <div className="pt-12 px-6 pb-6 space-y-5">

          {/* Photo upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Changer la photo</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={e => {
                const f = e.target.files?.[0];
                setPreview(f ? URL.createObjectURL(f) : member.photo_url);
              }}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">✕ {saveError}</p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Prénom *" error={errors.first_name?.message}>
                <input {...register("first_name")} className={inputCls} />
              </Field>
              <Field label="Nom *" error={errors.last_name?.message}>
                <input {...register("last_name")} className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Genre">
                <select {...register("gender")} className={inputCls}>
                  <option value="">—</option>
                  <option value="male">Homme</option>
                  <option value="female">Femme</option>
                  <option value="other">Autre</option>
                </select>
              </Field>
              <Field label="Date de naissance">
                <input {...register("birth_date")} type="date" className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Lieu de naissance">
                <input {...register("birth_place")} placeholder="Paris" className={inputCls} />
              </Field>
              <Field label="Date de décès">
                <input {...register("death_date")} type="date" className={inputCls} />
              </Field>
            </div>

            <Field label="Biographie">
              <textarea {...register("bio")} rows={3} placeholder="Quelques mots…" className={`${inputCls} resize-none`} />
            </Field>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Parents</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Père">
                  <select {...register("father_id")} className={inputCls}>
                    <option value="">— Aucun —</option>
                    {members.filter(m => m.id !== member.id).map(m => (
                      <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Mère">
                  <select {...register("mother_id")} className={inputCls}>
                    <option value="">— Aucune —</option>
                    {members.filter(m => m.id !== member.id).map(m => (
                      <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_private" {...register("is_private")} className="rounded accent-indigo-600" />
              <label htmlFor="is_private" className="text-sm text-slate-600">Profil privé</label>
            </div>

            <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
              {cd ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                >
                  {deleting ? "Suppression…" : "🗑 Supprimer"}
                </button>
              ) : <span />}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium"
                >
                  {cw ? "Annuler" : "Fermer"}
                </button>
                {cw && (
                  <button
                    type="submit"
                    disabled={isSubmitting || uploading}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {uploading ? "Upload…" : isSubmitting ? "Sauvegarde…" : "Enregistrer"}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Formulaire : ajouter un membre ────────────────────────────────
function AddMemberForm({ members, treeId, onSuccess, onError }: {
  members: Member[];
  treeId?: string;
  onSuccess: () => void;
  onError: (m: string) => void;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<AddMemberInput>({
    resolver: zodResolver(addMemberSchema),
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const onSubmit = async (data: AddMemberInput) => {
    let photoUrl: string | null = null;

    const file = fileRef.current?.files?.[0];
    if (file) {
      setUploading(true);
      const uploaded = await uploadMemberPhoto(file);
      if (uploaded) photoUrl = uploaded;
      setUploading(false);
    }

    const body = {
      ...data,
      gender:      data.gender      || null,
      birth_date:  data.birth_date  || null,
      birth_place: data.birth_place || null,
      death_date:  data.death_date  || null,
      father_id:   data.father_id   || null,
      mother_id:   data.mother_id   || null,
      photo_url:   photoUrl,
      ...(treeId ? { treeId } : {}),
    };
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { onError((await res.json()).error ?? "Erreur"); return; }
    reset();
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">
      <h2 className="font-bold text-slate-900 text-lg">Ajouter un membre</h2>

      {/* Photo */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
          {preview
            ? <img src={preview} alt="aperçu" className="w-full h-full object-cover" />
            : <span className="text-2xl text-slate-300">📷</span>
          }
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Photo (optionnel)</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={e => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
            className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Prénom *" error={errors.first_name?.message}>
          <input {...register("first_name")} placeholder="Marie" className={inputCls} />
        </Field>
        <Field label="Nom *" error={errors.last_name?.message}>
          <input {...register("last_name")} placeholder="DUPONT" className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Genre">
          <select {...register("gender")} className={inputCls}>
            <option value="">—</option>
            <option value="male">Homme</option>
            <option value="female">Femme</option>
            <option value="other">Autre</option>
          </select>
        </Field>
        <Field label="Date de naissance">
          <input {...register("birth_date")} type="date" className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Lieu de naissance">
          <input {...register("birth_place")} placeholder="Paris" className={inputCls} />
        </Field>
        <Field label="Date de décès">
          <input {...register("death_date")} type="date" className={inputCls} />
        </Field>
      </div>

      {members.length > 0 && (
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Parents (optionnel)</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Père">
              <select {...register("father_id")} className={inputCls}>
                <option value="">— Aucun —</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Mère">
              <select {...register("mother_id")} className={inputCls}>
                <option value="">— Aucune —</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || uploading}
        className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {uploading ? "Upload photo…" : isSubmitting ? "Ajout…" : "Ajouter le membre"}
      </button>
    </form>
  );
}

// ── Formulaire : créer une union ──────────────────────────────────
function UnionForm({ members, treeId, onSuccess, onError }: {
  members: Member[];
  treeId?: string;
  onSuccess: () => void;
  onError: (m: string) => void;
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
      body: JSON.stringify({ type: "spouse", member1_id: data.member1_id, member2_id: data.member2_id, ...(treeId ? { treeId } : {}), ...stateToBody(state, data.date) }),
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
