"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Member } from "@/types";
import { inputCls } from "@/lib/ui";
import { createClient } from "@/lib/supabase/client";

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

const unionSchema = z.object({
  member1_id: z.string().min(1, "Sélectionnez le 1er membre"),
  member2_id: z.string().min(1, "Sélectionnez le 2ème membre"),
  union_date: z.string().optional(),
});
type UnionInput = z.infer<typeof unionSchema>;

type Panel = "add" | "union" | null;

// ── Composant principal ───────────────────────────────────────────
export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const notify = (type: "ok" | "err", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchMembers = useCallback(async () => {
    const res = await fetch("/api/members").catch(() => null);
    if (!res) { notify("err", "Impossible de charger les membres"); setLoading(false); return; }
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const togglePanel = (p: Panel) => setPanel(prev => prev === p ? null : p);

  const filtered = members.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const living  = members.filter(m => !m.death_date).length;
  const deceased = members.filter(m =>  m.death_date).length;

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ── Hero ────────────────────────────────────────────────── */}
      <div className="bg-linear-to-br from-slate-900 via-blue-950 to-slate-900 px-4 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Membres</h1>
              <p className="text-slate-400 mt-1 text-sm">Gérez les personnes de votre arbre généalogique</p>
            </div>
            <div className="flex gap-3">
              <HeroBtn active={panel === "add"} color="indigo" onClick={() => togglePanel("add")}>
                + Ajouter
              </HeroBtn>
              <HeroBtn active={panel === "union"} color="pink" onClick={() => togglePanel("union")}>
                💞 Union
              </HeroBtn>
            </div>
          </div>

          {/* Stats rapides */}
          <div className="flex gap-6 mt-8">
            {[
              { label: "Total", value: members.length, icon: "👥" },
              { label: "Vivants", value: living,  icon: "💚" },
              { label: "Décédés", value: deceased, icon: "🕊️" },
            ].map(({ label, value, icon }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{icon} {label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Feedback */}
        {feedback && (
          <div className={`text-sm px-4 py-3 rounded-xl font-medium ${
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
            onSuccess={() => { notify("ok", "Membre ajouté."); fetchMembers(); setPanel(null); }}
            onError={(m) => notify("err", m)}
          />
        )}
        {panel === "union" && (
          <UnionForm
            members={members}
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
            <p className="text-5xl">👨‍👩‍👧‍👦</p>
            <p className="text-slate-500 font-medium">Aucun membre pour l&apos;instant</p>
            <p className="text-slate-400 text-sm">Commencez par ajouter la première personne de votre famille.</p>
            <button
              onClick={() => togglePanel("add")}
              className="mt-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
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
                members={members}
                onUpdate={fetchMembers}
                onDelete={async () => {
                  if (!confirm(`Supprimer ${m.first_name} ${m.last_name} ?`)) return;
                  const res = await fetch(`/api/members/${m.id}`, { method: "DELETE" });
                  if (res.ok) { notify("ok", "Membre supprimé."); fetchMembers(); }
                  else notify("err", "Erreur lors de la suppression");
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Hero button ───────────────────────────────────────────────────
function HeroBtn({ children, onClick, active, color }: { children: React.ReactNode; onClick: () => void; active?: boolean; color: "indigo" | "pink" }) {
  const base = color === "indigo"
    ? active ? "bg-indigo-600 text-white" : "bg-white/10 text-white hover:bg-white/20"
    : active ? "bg-pink-500 text-white" : "bg-white/10 text-white hover:bg-white/20";
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${base}`}>
      {children}
    </button>
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

// ── Carte membre ──────────────────────────────────────────────────
function MemberCard({ member, members, onUpdate, onDelete }: { member: Member; members: Member[]; onUpdate: () => void; onDelete: () => void }) {
  const [editingParents, setEditingParents] = useState(false);
  const [fatherId, setFatherId] = useState(member.father_id ?? "");
  const [motherId, setMotherId] = useState(member.mother_id ?? "");
  const [saving, setSaving] = useState(false);

  const genderIcon: Record<string, string> = { male: "♂", female: "♀", other: "⚥" };
  const father = members.find(m => m.id === member.father_id);
  const mother = members.find(m => m.id === member.mother_id);

  const age = member.birth_date
    ? (member.death_date
        ? new Date(member.death_date).getFullYear() - new Date(member.birth_date).getFullYear()
        : new Date().getFullYear() - new Date(member.birth_date).getFullYear())
    : null;

  const saveParents = async () => {
    setSaving(true);
    await fetch(`/api/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ father_id: fatherId || null, mother_id: motherId || null }),
    });
    setSaving(false);
    setEditingParents(false);
    onUpdate();
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header de la carte */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-lg shrink-0 overflow-hidden border-2 border-white shadow-sm">
          {member.photo_url
            ? <img src={member.photo_url} alt={member.first_name} className="w-full h-full object-cover" />
            : <>{member.first_name[0]}{member.last_name[0]}</>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 truncate">
            {member.first_name} {member.last_name.toUpperCase()}
          </p>
          <p className="text-xs text-slate-400">
            {member.gender ? genderIcon[member.gender] : ""}
            {age != null ? ` · ${age} ans` : ""}
            {member.death_date ? " · †" : ""}
          </p>
        </div>
        {member.is_private && (
          <span className="text-xs bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-lg shrink-0">Privé</span>
        )}
      </div>

      {/* Infos */}
      <div className="px-4 pb-3 space-y-1">
        {member.birth_date && (
          <p className="text-xs text-slate-400">
            🎂 {new Date(member.birth_date).toLocaleDateString("fr-FR")}
            {member.birth_place ? ` — ${member.birth_place}` : ""}
          </p>
        )}
        {member.death_date && (
          <p className="text-xs text-slate-400">🕊️ {new Date(member.death_date).toLocaleDateString("fr-FR")}</p>
        )}
        {(father || mother) && !editingParents && (
          <p className="text-xs text-slate-400 truncate">
            {father && `👨 ${father.first_name} ${father.last_name}`}
            {father && mother && " · "}
            {mother && `👩 ${mother.first_name} ${mother.last_name}`}
          </p>
        )}
      </div>

      {/* Édition parents */}
      {editingParents && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Père</label>
              <select value={fatherId} onChange={e => setFatherId(e.target.value)} className={inputCls}>
                <option value="">— Aucun —</option>
                {members.filter(m => m.id !== member.id).map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Mère</label>
              <select value={motherId} onChange={e => setMotherId(e.target.value)} className={inputCls}>
                <option value="">— Aucune —</option>
                {members.filter(m => m.id !== member.id).map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={saveParents}
            disabled={saving}
            className="w-full bg-indigo-600 text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Sauvegarde…" : "Enregistrer"}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => setEditingParents(p => !p)}
          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
        >
          {editingParents ? "Annuler" : "⊕ Parents"}
        </button>
        <button
          onClick={onDelete}
          className="text-xs text-red-400 hover:text-red-600 font-medium"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

// ── Formulaire : ajouter un membre ────────────────────────────────
function AddMemberForm({ members, onSuccess, onError }: {
  members: Member[];
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
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { data: uploaded, error: uploadErr } = await supabase.storage
          .from("member-photos")
          .upload(path, file, { upsert: true });
        if (!uploadErr && uploaded) {
          const { data: urlData } = supabase.storage.from("member-photos").getPublicUrl(uploaded.path);
          photoUrl = urlData.publicUrl;
        }
      }
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
function UnionForm({ members, onSuccess, onError }: {
  members: Member[];
  onSuccess: () => void;
  onError: (m: string) => void;
}) {
  const [statut, setStatut] = useState<"ensemble" | "séparé">("ensemble");
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<UnionInput>({
    resolver: zodResolver(unionSchema),
  });

  const onSubmit = async (data: UnionInput) => {
    const body = {
      type: "spouse",
      member1_id: data.member1_id,
      member2_id: data.member2_id,
      union_date:      statut === "ensemble" ? (data.union_date || null) : null,
      separation_date: statut === "séparé"   ? (data.union_date || null) : null,
    };
    const res = await fetch("/api/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { onError((await res.json()).error ?? "Erreur"); return; }
    reset();
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">
      <h2 className="font-bold text-slate-900 text-lg">Créer une union</h2>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
        {(["ensemble", "séparé"] as const).map(s => (
          <button key={s} type="button" onClick={() => setStatut(s)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              statut === s
                ? s === "ensemble" ? "bg-pink-500 text-white shadow-sm" : "bg-slate-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}>
            {s === "ensemble" ? "♥ Ensemble" : "✗ Séparé·e"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {(["member1_id", "member2_id"] as const).map((name, i) => (
          <Field key={name} label={`Membre ${i + 1} *`} error={errors[name]?.message}>
            <select {...register(name)} className={inputCls}>
              <option value="">— Sélectionner —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
          </Field>
        ))}
      </div>

      <Field label={statut === "ensemble" ? "Date de début (optionnel)" : "Date de séparation (optionnel)"}>
        <input {...register("union_date")} type="date" className={inputCls} />
      </Field>

      <button type="submit" disabled={isSubmitting}
        className="w-full bg-pink-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-pink-600 disabled:opacity-50 transition-colors">
        {isSubmitting ? "Enregistrement…" : "Créer l'union"}
      </button>
    </form>
  );
}
