"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Member } from "@/types";
import { inputCls } from "@/lib/ui";

// ── Schemas ──────────────────────────────────────────────────────
const addMemberSchema = z.object({
  first_name: z.string().min(1, "Requis"),
  last_name: z.string().min(1, "Requis"),
  gender: z.enum(["male", "female", "other", ""]).optional(),
  birth_date: z.string().optional(),
  birth_place: z.string().optional(),
  death_date: z.string().optional(),
});

const parentageSchema = z.object({
  child_id: z.string().min(1, "Sélectionnez un enfant"),
  father_id: z.string().optional(),
  mother_id: z.string().optional(),
});

const unionSchema = z.object({
  member1_id: z.string().min(1, "Sélectionnez le 1er membre"),
  member2_id: z.string().min(1, "Sélectionnez le 2ème membre"),
  union_date: z.string().optional(),
});

type AddMemberInput = z.infer<typeof addMemberSchema>;
type ParentageInput = z.infer<typeof parentageSchema>;
type UnionInput = z.infer<typeof unionSchema>;

type Panel = "add" | "parentage" | "union" | null;

// ── Composant principal ───────────────────────────────────────────
export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const togglePanel = (p: Panel) => setPanel(prev => prev === p ? null : p);

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            Membres <span className="text-gray-400 text-lg font-normal">({members.length})</span>
          </h1>
          <div className="flex gap-2">
            <Btn active={panel === "add"}      onClick={() => togglePanel("add")}>+ Ajouter</Btn>
            <Btn active={panel === "parentage"} onClick={() => togglePanel("parentage")}>Parenté</Btn>
            <Btn active={panel === "union"}     onClick={() => togglePanel("union")}>Union</Btn>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`text-sm px-4 py-2 rounded-lg ${feedback.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {feedback.msg}
          </div>
        )}

        {/* Formulaires */}
        {panel === "add" && (
          <AddMemberForm
            onSuccess={() => { notify("ok", "Membre ajouté."); fetchMembers(); setPanel(null); }}
            onError={(m) => notify("err", m)}
          />
        )}
        {panel === "parentage" && (
          <ParentageForm
            members={members}
            onSuccess={() => { notify("ok", "Parenté définie."); setPanel(null); }}
            onError={(m) => notify("err", m)}
          />
        )}
        {panel === "union" && (
          <UnionForm
            members={members}
            onSuccess={() => { notify("ok", "Union créée."); setPanel(null); }}
            onError={(m) => notify("err", m)}
          />
        )}

        {/* Liste */}
        {loading ? (
          <p className="text-gray-400 text-center py-12">Chargement…</p>
        ) : members.length === 0 ? (
          <p className="text-gray-400 text-center py-12">Aucun membre. Commencez par en ajouter un.</p>
        ) : (
          <div className="grid gap-3">
            {members.map(m => <MemberRow key={m.id} member={m} />)}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Sous-composants ───────────────────────────────────────────────

function Btn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function MemberRow({ member }: { member: Member }) {
  const genderMap: Record<string, string> = { male: "♂", female: "♀", other: "⚥" };
  const gender = member.gender ? (genderMap[member.gender] ?? "") : "";
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm shrink-0">
        {member.first_name[0]}{member.last_name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">
          {member.first_name} {member.last_name} {gender}
          {member.death_date && <span className="ml-1 text-gray-400 font-normal">†</span>}
        </p>
        <p className="text-xs text-gray-400">
          {member.birth_date && <>Né(e) le {new Date(member.birth_date).toLocaleDateString("fr-FR")}{member.birth_place ? ` — ${member.birth_place}` : ""}</>}
          {member.birth_date && member.death_date && " · "}
          {member.death_date && <>Décédé(e) le {new Date(member.death_date).toLocaleDateString("fr-FR")}</>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {member.death_date && (
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Décédé(e)</span>
        )}
        {member.is_private && (
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Privé</span>
        )}
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ── Formulaire : ajouter un membre ────────────────────────────────
function AddMemberForm({ onSuccess, onError }: { onSuccess: () => void; onError: (m: string) => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<AddMemberInput>({
    resolver: zodResolver(addMemberSchema),
  });

  const onSubmit = async (data: AddMemberInput) => {
    const body = { ...data, gender: data.gender || null, birth_date: data.birth_date || null, birth_place: data.birth_place || null, death_date: data.death_date || null };
    const res = await fetch("/api/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { onError((await res.json()).error ?? "Erreur"); return; }
    reset();
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-gray-800">Ajouter un membre</h2>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Prénom" error={errors.first_name?.message}>
          <input {...register("first_name")} placeholder="Marie" className={inputCls} />
        </Field>
        <Field label="Nom" error={errors.last_name?.message}>
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
      <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
        {isSubmitting ? "Ajout…" : "Ajouter le membre"}
      </button>
    </form>
  );
}

// ── Formulaire : définir la parenté ──────────────────────────────
function ParentageForm({ members, onSuccess, onError }: { members: Member[]; onSuccess: () => void; onError: (m: string) => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ParentageInput>({
    resolver: zodResolver(parentageSchema),
  });

  const onSubmit = async (data: ParentageInput) => {
    const body = {
      type: "parentage",
      child_id: data.child_id,
      father_id: data.father_id || null,
      mother_id: data.mother_id || null,
    };
    const res = await fetch("/api/relations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { onError((await res.json()).error ?? "Erreur"); return; }
    reset();
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-gray-800">Définir la parenté</h2>
      <p className="text-sm text-gray-500">Associez un enfant à son père et/ou sa mère.</p>
      <Field label="Enfant *" error={errors.child_id?.message}>
        <select {...register("child_id")} className={inputCls}>
          <option value="">— Sélectionner —</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Père" error={errors.father_id?.message}>
          <select {...register("father_id")} className={inputCls}>
            <option value="">— Sélectionner —</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select>
        </Field>
        <Field label="Mère" error={errors.mother_id?.message}>
          <select {...register("mother_id")} className={inputCls}>
            <option value="">— Sélectionner —</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select>
        </Field>
      </div>
      <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
        {isSubmitting ? "Enregistrement…" : "Définir la parenté"}
      </button>
    </form>
  );
}

// ── Formulaire : créer une union ──────────────────────────────────
function UnionForm({ members, onSuccess, onError }: { members: Member[]; onSuccess: () => void; onError: (m: string) => void }) {
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
    const res = await fetch("/api/relations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { onError((await res.json()).error ?? "Erreur"); return; }
    reset();
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-gray-800">Créer une union</h2>

      {/* Statut */}
      <div className="flex gap-2">
        {(["ensemble", "séparé"] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStatut(s)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              statut === s
                ? s === "ensemble"
                  ? "bg-pink-500 text-white border-pink-500"
                  : "bg-gray-400 text-white border-gray-400"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {s === "ensemble" ? "♥ Ensemble" : "✗ Séparé"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {(["member1_id", "member2_id"] as const).map((name, i) => (
          <Field key={name} label={`Membre ${i + 1} *`} error={errors[name]?.message}>
            <select {...register(name)} className={inputCls}>
              <option value="">— Sélectionner —</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
              ))}
            </select>
          </Field>
        ))}
      </div>

      <Field label={statut === "ensemble" ? "Date de début" : "Date de séparation"}>
        <input {...register("union_date")} type="date" className={inputCls} />
      </Field>

      <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
        {isSubmitting ? "Enregistrement…" : "Créer l'union"}
      </button>
    </form>
  );
}
