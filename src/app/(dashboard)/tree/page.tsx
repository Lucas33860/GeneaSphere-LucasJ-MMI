"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FamilyTree3D } from "@/components/tree/FamilyTree3D";
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
  const [memberError, setMemberError] = useState<string | null>(null);

  // Panneau info / édition
  const [panel, setPanel] = useState<
    { type: "member"; data: Member; editing: boolean } |
    { type: "union";  data: Spouse; editing: boolean } |
    null
  >(null);

  // ── Chargement des membres ─────────────────────────────────────
  useEffect(() => {
    fetch("/api/members")
      .then(r => r.json())
      .then((data: Member[]) => {
        setMembers(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(() => setMemberError("Impossible de charger les membres"));
  }, []);

  const handleSelectMember = (m: Member) => {
    setPanel({ type: "member", data: m, editing: false });
  };

  const legendItems = [
    { picto: "♥",   label: "Couple" },
    { picto: "💔",  label: "Ex-couple" },
    { picto: "💍",  label: "Marié·e" },
    { picto: "💍✗", label: "Divorcé·e" },
    { picto: "†",   label: "Décédé·e" },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="flex h-[calc(100vh-57px)]">

        {/* ── Sidebar gauche : légende ───────────────────────── */}
        <aside className="w-40 shrink-0 bg-white border-r border-gray-100 hidden lg:flex flex-col gap-1 p-4 overflow-y-auto justify-center">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Légende</p>
          {legendItems.map(({ picto, label }) => (
            <span key={label} className="flex items-center gap-2 text-xs text-gray-600 py-0.5">
              <span className="text-base w-6 text-center">{picto}</span>
              {label}
            </span>
          ))}
          <div className="mt-4 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-400">
            <p>Clic → info + expand</p>
            <p>Drag → rotation</p>
            <p>Scroll → zoom</p>
          </div>
        </aside>

        {/* ── Zone principale ───────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* En-tête */}
          <div className="flex flex-wrap items-center gap-3 px-6 py-4 bg-white border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-900">Arbre généalogique 3D</h1>

            {memberError ? (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">{memberError}</p>
            ) : members.length > 0 ? (
              <select
                value={selectedId}
                onChange={e => { setSelectedId(e.target.value); setPanel(null); }}
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
          </div>

          {/* Canvas 3D + panneau info */}
          <div className="flex-1 relative overflow-hidden">

            {/* Canvas 3D plein écran */}
            {selectedId && (
              <FamilyTree3D
                rootId={selectedId}
                onSelectMember={handleSelectMember}
              />
            )}

            {!selectedId && (
              <div className="flex items-center justify-center h-full text-gray-400">
                Sélectionnez un membre pour démarrer.
              </div>
            )}

            {/* ── Panneau info overlay top-left ──────────────── */}
            {panel && (
              <div className="absolute top-4 left-4 z-10 w-72 bg-white rounded-2xl border border-gray-100 shadow-lg p-5 space-y-4">

                {/* Panneau MEMBRE (info) */}
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

                {/* Panneau MEMBRE (édition) */}
                {panel.type === "member" && panel.editing && (
                  <EditMemberForm
                    member={panel.data}
                    onCancel={() => setPanel({ ...panel, editing: false })}
                    onSuccess={updated => {
                      setPanel({ type: "member", data: updated, editing: false });
                      setMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
                    }}
                  />
                )}

                {/* Panneau UNION (info) */}
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

                {/* Panneau UNION (édition) */}
                {panel.type === "union" && panel.editing && (
                  <EditUnionForm
                    union={panel.data}
                    onCancel={() => setPanel({ ...panel, editing: false })}
                    onSuccess={updated => setPanel({ type: "union", data: updated, editing: false })}
                  />
                )}

              </div>
            )}
          </div>
        </div>
      </div>
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
  const sep = !!union.separation_date;
  let picto: string, label: string;
  if (union.union_type === "couple") {
    picto = sep ? "💔" : "♥";
    label = sep ? "Ex-couple" : "Couple";
  } else {
    picto = sep ? "💍✗" : "💍";
    label = sep ? "Divorcé·e" : "Marié·e";
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{picto}</span>
        <div>
          <p className="font-semibold text-gray-900">{label}</p>
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

// ── Union 4 états ─────────────────────────────────────────────────
type UnionState4 = "couple" | "ex-couple" | "marriage" | "divorce";

const UNION_STATE_OPTIONS: { value: UnionState4; picto: string; label: string; bg: string; border: string }[] = [
  { value: "couple",    picto: "♥",   label: "Couple",    bg: "bg-pink-50",   border: "border-pink-400" },
  { value: "ex-couple", picto: "💔",  label: "Ex-couple", bg: "bg-gray-50",   border: "border-gray-400" },
  { value: "marriage",  picto: "💍",  label: "Marié·e",   bg: "bg-yellow-50", border: "border-yellow-400" },
  { value: "divorce",   picto: "💍✗", label: "Divorcé·e", bg: "bg-slate-50",  border: "border-slate-400" },
];

function unionToState4(u: Spouse): UnionState4 {
  if (u.union_type === "couple") return u.separation_date ? "ex-couple" : "couple";
  return u.separation_date ? "divorce" : "marriage";
}

function stateToBody(state: UnionState4, date: string) {
  const isSep = state === "ex-couple" || state === "divorce";
  return {
    union_type:      state === "couple" || state === "ex-couple" ? "couple" : "marriage",
    union_date:      !isSep ? (date || null) : null,
    separation_date: isSep  ? (date || null) : null,
  };
}

function UnionStateSelector({ value, onChange }: { value: UnionState4; onChange: (v: UnionState4) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {UNION_STATE_OPTIONS.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={`flex flex-col items-center py-3 rounded-xl border-2 transition-all text-sm font-medium ${
            value === opt.value ? `${opt.bg} ${opt.border} shadow-sm` : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
          }`}>
          <span className="text-xl mb-1">{opt.picto}</span>
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Formulaire édition union ──────────────────────────────────────
function EditUnionForm({ union, onCancel, onSuccess }: { union: Spouse; onCancel: () => void; onSuccess: (u: Spouse) => void }) {
  const [state, setState] = useState<UnionState4>(unionToState4(union));
  const [saveError, setSaveError] = useState<string | null>(null);

  const isSep = state === "ex-couple" || state === "divorce";
  const existingDate = isSep
    ? (union.separation_date?.slice(0, 10) ?? "")
    : (union.union_date?.slice(0, 10) ?? "");

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { date: existingDate },
  });

  const onSubmit = async (data: { date: string }) => {
    setSaveError(null);
    const res = await fetch(`/api/relations/${union.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stateToBody(state, data.date)),
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
      <UnionStateSelector value={state} onChange={setState} />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {isSep ? "Date de séparation" : "Date de début"}
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
